import { availableComponents, componentGroups, getComponentById } from './components.js';
import { CanvasManager } from './canvas.js';
import {
  initUI,
  setPlayState,
  triggerDownload,
  promptFileSelection,
  showAlert,
  toggleSerialMonitor,
  appendSerialLog,
  clearSerialMonitor,
  setTransformControlsState,
} from './ui.js';
import { simulation } from './simulation.js';
import { initBlocklyWorkspace, compileWorkspaceToProgram } from './blockly.js';

const STORAGE_KEY = 'bipes-simulator-state';
const SAVE_DEBOUNCE_MS = 400;

let canvasManager;
let simulationResetNotified = false;
let componentSearchTerm = '';
let componentViewMode = 'grid';
let componentFilterGroup = 'all';
let blocklyWorkspace;
let pendingSaveTimeoutId = null;
let isRestoringState = false;
let simulationInteractionBypass = false;
let openBlocklyPanel = () => {};
let closeBlocklyPanel = () => {};

window.addEventListener('DOMContentLoaded', () => {
  initUI({
    onPlayPause: handlePlayPause,
    onClear: handleClearWorkspace,
    onSave: handleSaveWorkspace,
    onLoad: handleLoadWorkspace,
    onToggleSerialMonitor: handleToggleSerialMonitor,
    onOpenBlockly: handleOpenBlockly,
    onRotateComponent: handleRotateSelectedComponent,
    onFlipComponent: handleFlipSelectedComponent,
  });

  canvasManager = new CanvasManager({
    onInteraction: resetSimulationIfNecessary,
    isInteractionLocked: () => simulation?.isRunning ?? false,
  });

  simulation.configure({
    onStateChange: setPlayState,
    onError: handleSimulationError,
    onLog: handleSerialLog,
  });

  setupComponentSearch();
  setupComponentFilter();
  setupViewToggle();
  renderComponentPalette();
  setupDropZone();
  setupKeyboardShortcuts();
  attachSimulationInteractionBypass();
  blocklyWorkspace = initBlocklyWorkspace();
  setupBlocklyPanelControls();
  attachBlocklyAutoSave();
  restorePersistedState();
  setPlayState(false);
});

function handlePlayPause() {
  if (!canvasManager) return;
  if (simulation.isRunning) {
    simulation.stop();
    setPlayState(false);
    simulationResetNotified = false;
    appendSerialLog({
      message: 'Simulação pausada.',
      timestamp: Date.now(),
    });
    scheduleAutoSave();
    return;
  }

  if (!blocklyWorkspace) {
    showAlert('Editor Blockly não iniciado. Recarregue a página e tente novamente.');
    return;
  }

  const topBlocks = blocklyWorkspace.getTopBlocks(false);
  let programInfo = null;
  if (topBlocks.length) {
    programInfo = compileWorkspaceToProgram(blocklyWorkspace, { allowEmpty: true });
    if (programInfo.error) {
      showAlert(programInfo.error);
      return;
    }
  }

  const program = programInfo?.program ?? null;
  const boardComponent =
    program &&
    canvasManager.components.find(
      (component) => component.type === 'amado-board' || component.type === 'esp32',
    );

  if (program && !boardComponent) {
    showAlert('Adicione a placa Amado ESP32 ao workspace para executar o programa.');
    return;
  }

  simulation.start(canvasManager, {
    program,
    boardComponentId: boardComponent?.id ?? null,
    onProgramError: handleSimulationError,
  });
  simulationResetNotified = false;
  scheduleAutoSave();
}

function handleClearWorkspace() {
  if (!canvasManager) return;
  simulation.stop();
  setPlayState(false);
  canvasManager.clearWorkspace();
  if (blocklyWorkspace && typeof window !== 'undefined' && window.Blockly) {
    blocklyWorkspace.clear();
  }
  clearSerialMonitor();
  toggleSerialMonitor(false);
  clearPersistedState();
  simulationResetNotified = false;
}

function handleSaveWorkspace() {
  if (!canvasManager) return;
  const data = canvasManager.serialize();
  const json = JSON.stringify(data, null, 2);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  triggerDownload(`simulador-${timestamp}.json`, json);
}

function handleLoadWorkspace() {
  promptFileSelection({
    onLoad: (content) => {
      try {
        const data = JSON.parse(content);
        simulation.stop();
        setPlayState(false);
        Promise.resolve(canvasManager.load(data))
          .then(() => {
            simulationResetNotified = false;
            scheduleAutoSave();
          })
          .catch(() => {
            showAlert('Não foi possível carregar o circuito selecionado.');
          });
      } catch (error) {
        showAlert('Arquivo inválido. Verifique o JSON e tente novamente.');
      }
    },
  });
}

function setupBlocklyPanelControls() {
  const canvasArea = document.getElementById('canvas-area');
  const panel = document.getElementById('blockly-panel');
  const closeButton = document.getElementById('blockly-toggle-button');
  const openButton = document.getElementById('blockly-open-trigger');
  if (!canvasArea || !panel || !closeButton || !openButton) {
    openBlocklyPanel = () => {};
    closeBlocklyPanel = () => {};
    return;
  }

  const setOpen = (isOpen) => {
    canvasArea.classList.toggle('blockly-open', isOpen);
    openButton.setAttribute('aria-expanded', String(isOpen));
    openButton.style.display = isOpen ? 'none' : 'inline-flex';
    closeButton.textContent = isOpen ? 'Minimizar' : 'Abrir Blockly';
    closeButton.setAttribute('aria-expanded', String(isOpen));

    if (isOpen && blocklyWorkspace && window.Blockly) {
      window.requestAnimationFrame(() => {
        window.Blockly.svgResize(blocklyWorkspace);
      });
    }
  };

  setOpen(false);

  openButton.addEventListener('click', () => setOpen(true));
  closeButton.addEventListener('click', () => setOpen(false));

  openBlocklyPanel = () => setOpen(true);
  closeBlocklyPanel = () => setOpen(false);
}

function resetSimulationIfNecessary() {
  if (simulation.isRunning && !simulationInteractionBypass) {
    simulation.stop();
    setPlayState(false);
    if (!simulationResetNotified) {
      showAlert('Simulação reiniciada devido a alterações no circuito.');
      appendSerialLog({
        message: 'Simulação interrompida: circuito modificado.',
        timestamp: Date.now(),
      });
      simulationResetNotified = true;
    }
  } else {
    simulationResetNotified = false;
  }
  scheduleAutoSave();
  simulationInteractionBypass = false;
}

function setupComponentSearch() {
  const searchInput = document.getElementById('component-search-input');
  if (!searchInput) return;
  searchInput.addEventListener('input', (event) => {
    componentSearchTerm = event.target.value;
    renderComponentPalette(componentSearchTerm);
  });
}

function setupComponentFilter() {
  const filterSelect = document.getElementById('component-filter-select');
  if (!filterSelect) return;

  filterSelect.innerHTML = '';

  const allOption = document.createElement('option');
  allOption.value = 'all';
  allOption.textContent = 'Todos';
  filterSelect.appendChild(allOption);

  componentGroups.forEach((group) => {
    const option = document.createElement('option');
    option.value = group.id;
    option.textContent = group.name;
    filterSelect.appendChild(option);
  });

  filterSelect.value = componentFilterGroup;
  filterSelect.addEventListener('change', (event) => {
    componentFilterGroup = event.target.value || 'all';
    renderComponentPalette();
  });
}

function setupViewToggle() {
  const buttons = document.querySelectorAll('.view-toggle-button');
  if (!buttons.length) return;

  const updateActive = (activeView) => {
    buttons.forEach((button) => {
      button.classList.toggle('active', button.dataset.view === activeView);
    });
  };

  updateActive(componentViewMode);

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const view = button.dataset.view;
      if (!view || componentViewMode === view) return;
      componentViewMode = view;
      updateActive(view);
      renderComponentPalette();
    });
  });
}

function attachSimulationInteractionBypass() {
  window.addEventListener('simulator-pattern-interaction', () => {
    simulationInteractionBypass = true;
  });
}

function handleToggleSerialMonitor(force) {
  toggleSerialMonitor(force);
}

function handleOpenBlockly() {
  openBlocklyPanel?.();
}

function handleRotateSelectedComponent() {
  canvasManager?.rotateSelectedComponent?.();
}

function handleFlipSelectedComponent() {
  canvasManager?.flipSelectedComponent?.();
}

function handleSerialLog(entry) {
  appendSerialLog(entry);
}

window.addEventListener('simulator-selection-change', (event) => {
  const detail = event.detail ?? {};
  setTransformControlsState({
    canRotate: Boolean(detail.canRotate),
    canFlip: Boolean(detail.canFlip),
  });
});

function handleSimulationError(message) {
  showAlert(message);
  appendSerialLog({
    message,
    level: 'error',
    timestamp: Date.now(),
  });
  toggleSerialMonitor(true);
}

function scheduleAutoSave() {
  if (isRestoringState) return;
  if (typeof window === 'undefined' || !window.localStorage) return;
  if (pendingSaveTimeoutId) {
    window.clearTimeout(pendingSaveTimeoutId);
  }
  pendingSaveTimeoutId = window.setTimeout(() => {
    pendingSaveTimeoutId = null;
    persistAppState();
  }, SAVE_DEBOUNCE_MS);
}

function persistAppState() {
  if (!canvasManager) return;
  if (typeof window === 'undefined' || !window.localStorage) return;

  const payload = {
    version: 1,
    savedAt: new Date().toISOString(),
    circuit: canvasManager.serialize(),
    blockly: captureBlocklyState(),
  };

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    // Falha silenciosa (ex.: storage cheio ou indisponível)
  }
}

function captureBlocklyState() {
  if (!blocklyWorkspace || typeof window === 'undefined' || !window.Blockly) {
    return null;
  }

  if (window.Blockly.serialization?.workspaces?.save) {
    try {
      const state = window.Blockly.serialization.workspaces.save(blocklyWorkspace);
      return { format: 'json', data: state };
    } catch {
      // fallback para XML
    }
  }

  if (window.Blockly.Xml?.workspaceToDom) {
    try {
      const xml = window.Blockly.Xml.workspaceToDom(blocklyWorkspace, true);
      return { format: 'xml', data: window.Blockly.Xml.domToText(xml) };
    } catch {
      return null;
    }
  }

  return null;
}

async function restorePersistedState() {
  if (typeof window === 'undefined' || !window.localStorage) return;

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return;

  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return;
  }

  if (!parsed || typeof parsed !== 'object') {
    return;
  }

  isRestoringState = true;

  try {
    if (parsed.circuit && canvasManager) {
      await canvasManager.load(parsed.circuit);
    }

    const blocklyData = parsed.blockly;
    if (blocklyData && blocklyWorkspace && typeof window !== 'undefined' && window.Blockly) {
      try {
        if (
          blocklyData.format === 'json' &&
          window.Blockly.serialization?.workspaces?.load &&
          blocklyData.data &&
          typeof blocklyData.data !== 'string'
        ) {
          blocklyWorkspace.clear();
          window.Blockly.serialization.workspaces.load(blocklyData.data, blocklyWorkspace);
        } else {
          const xmlString =
            blocklyData.format === 'xml' && typeof blocklyData.data === 'string'
              ? blocklyData.data
              : typeof blocklyData === 'string'
              ? blocklyData
              : null;
          if (xmlString && window.Blockly.Xml?.textToDom) {
            const xml = window.Blockly.Xml.textToDom(xmlString);
            blocklyWorkspace.clear();
            window.Blockly.Xml.domToWorkspace(xml, blocklyWorkspace);
          }
        }
      } catch {
        // Ignora erros ao restaurar blocos corrompidos
      }
    }
  } finally {
    isRestoringState = false;
    scheduleAutoSave();
  }
}

function attachBlocklyAutoSave() {
  if (!blocklyWorkspace || typeof window === 'undefined' || !window.Blockly) return;

  blocklyWorkspace.addChangeListener((event) => {
    if (isRestoringState) return;
    if (!event || event.type === window.Blockly.Events.UI) return;
    scheduleAutoSave();
  });
}

function clearPersistedState() {
  if (typeof window === 'undefined' || !window.localStorage) return;
  if (pendingSaveTimeoutId) {
    window.clearTimeout(pendingSaveTimeoutId);
    pendingSaveTimeoutId = null;
  }
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignora erros ao limpar o storage (quota, modo privado, etc.)
  }
}

function renderComponentPalette(filterText = componentSearchTerm) {
  componentSearchTerm = filterText;
  const componentsList = document.querySelector('.components-list');
  componentsList.innerHTML = '';

  const searchTerm = filterText.trim().toLowerCase();

  componentGroups.forEach((group) => {
    if (componentFilterGroup !== 'all' && componentFilterGroup !== group.id) {
      return;
    }

    const groupComponents = availableComponents.filter(
      (component) =>
        component.group === group.id &&
        (!searchTerm ||
          component.name.toLowerCase().includes(searchTerm) ||
          component.description?.toLowerCase().includes(searchTerm)),
    );

    if (!groupComponents.length) {
      return;
    }

    const groupContainer = document.createElement('div');
    groupContainer.className = 'component-group';

    const groupTitle = document.createElement('div');
    groupTitle.className = 'component-group-title';
    groupTitle.textContent = group.name;

    const groupList = document.createElement('div');
    groupList.className = `component-group-list component-view-${componentViewMode}`;

    groupComponents.forEach((component) => {
      const card = createComponentCard(component);
      groupList.appendChild(card);
    });

    groupContainer.append(groupTitle, groupList);
    componentsList.appendChild(groupContainer);
  });

  if (!componentsList.children.length) {
    const emptyMessage = document.createElement('div');
    emptyMessage.className = 'component-empty-state';
    emptyMessage.textContent = 'Nenhum componente encontrado.';
    componentsList.appendChild(emptyMessage);
  }
}

function createComponentCard(component) {
  const card = document.createElement('div');
  card.className = `component-card component-view-${componentViewMode}`;
  card.draggable = true;
  card.dataset.componentId = component.id;

  const previewWrapper = document.createElement('div');
  previewWrapper.className = 'component-card-preview';
  const previewContent = component.createPreview?.();
  if (previewContent) {
    previewWrapper.appendChild(previewContent);
  } else {
    const placeholder = document.createElement('span');
    placeholder.textContent = component.name.charAt(0);
    previewWrapper.appendChild(placeholder);
  }

  const info = document.createElement('div');
  info.className = 'component-card-info';

  const name = document.createElement('div');
  name.className = 'component-card-name';
  name.textContent = component.name;

  const description = document.createElement('div');
  description.className = 'component-card-description';
  if (component.description) {
    description.textContent = component.description;
  } else {
    description.style.display = 'none';
  }

  info.append(name, description);
  card.append(previewWrapper, info);

  card.addEventListener('dragstart', (event) => {
    event.dataTransfer.setData('componentId', component.id);
    event.dataTransfer.effectAllowed = 'copy';
  });

  return card;
}

function setupDropZone() {
  const workspace = document.getElementById('workspace');

  workspace.addEventListener('dragover', (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    workspace.classList.add('drag-over');
  });

  workspace.addEventListener('dragleave', () => {
    workspace.classList.remove('drag-over');
  });

  workspace.addEventListener('drop', (event) => {
    event.preventDefault();
    workspace.classList.remove('drag-over');

    const componentId = event.dataTransfer.getData('componentId');
    const component = getComponentById(componentId);
    if (!component || !canvasManager) return;

    const rect = workspace.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    canvasManager.addComponent(component, x, y);
  });
}

function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Delete' && canvasManager) {
      if (canvasManager.deleteSelectedComponent()) return;
      canvasManager.wiringManager.deleteSelectedWire();
    }
  });
}
