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
const HISTORY_LIMIT = 50;

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
let undoStack = [];
let redoStack = [];
let lastSnapshot = null;
let lastSnapshotHash = null;
let isApplyingHistory = false;
let historySuspended = false;

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
    onUndo: () => {
      Promise.resolve(performUndo()).catch(() => {});
    },
    onRedo: () => {
      Promise.resolve(performRedo()).catch(() => {});
    },
    onDelete: handleDeleteSelection,
  });

  canvasManager = new CanvasManager({
    onInteraction: handleCanvasInteraction,
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
  initializeHistoryBaseline();
  restorePersistedState().finally(() => {
    initializeHistoryBaseline();
  });
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
  prepareHistoryForExternalChange();
  runWithHistorySuspended(() => {
    simulation.stop();
    setPlayState(false);
    canvasManager.clearWorkspace();
    if (blocklyWorkspace && typeof window !== 'undefined' && window.Blockly) {
      blocklyWorkspace.clear();
    }
    clearSerialMonitor();
    toggleSerialMonitor(false);
    clearPersistedState();
  });
  simulationResetNotified = false;
  refreshHistoryBaseline();
  scheduleAutoSave();
}

function handleSaveWorkspace() {
  if (!canvasManager) return;
  const payload = {
    version: 1,
    savedAt: new Date().toISOString(),
    circuit: canvasManager.serialize(),
    blockly: captureBlocklyState(),
  };

  if (!payload.blockly) {
    delete payload.blockly;
  }

  const json = JSON.stringify(payload, null, 2);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  triggerDownload(`simulador-${timestamp}.json`, json);
}

function handleLoadWorkspace() {
  promptFileSelection({
    onLoad: async (content) => {
      let snapshot = null;
      let loadedSuccessfully = false;

      try {
        const data = JSON.parse(content);
        snapshot = normalizeWorkspaceSnapshot(data);
        if (!snapshot.circuit || !Array.isArray(snapshot.circuit.components)) {
          throw new Error('Invalid circuit data');
        }

        const previousEntry =
          lastSnapshot && lastSnapshotHash
            ? { snapshot: lastSnapshot, hash: lastSnapshotHash }
            : null;
        simulation.stop();
        setPlayState(false);
        isRestoringState = true;

        await runWithHistorySuspended(async () => {
          await canvasManager.load(snapshot.circuit);

          if (snapshot.hasBlockly) {
            restoreBlocklyState(snapshot.blockly ?? null, { clearWhenMissing: true });
          }

          canvasManager.focusViewportOnContent();
        });

        if (previousEntry) {
          undoStack.push(previousEntry);
          if (undoStack.length > HISTORY_LIMIT) {
            undoStack.shift();
          }
        }
        redoStack = [];
        refreshHistoryBaseline();

        simulationResetNotified = false;
        loadedSuccessfully = true;
      } catch (error) {
        showAlert('Arquivo inválido. Verifique o JSON e tente novamente.');
        return;
      } finally {
        isRestoringState = false;
        if (loadedSuccessfully) {
          scheduleAutoSave();
        }
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

function handleCanvasInteraction() {
  resetSimulationIfNecessary();
  recordHistorySnapshot();
}

function hashSnapshot(snapshot) {
  try {
    return JSON.stringify(snapshot);
  } catch {
    return null;
  }
}

function getCurrentWorkspaceSnapshot() {
  if (!canvasManager) {
    return { circuit: null, blockly: null };
  }
  return {
    circuit: canvasManager.serialize(),
    blockly: captureBlocklyState(),
  };
}

function initializeHistoryBaseline() {
  if (!canvasManager) return;
  lastSnapshot = getCurrentWorkspaceSnapshot();
  lastSnapshotHash = hashSnapshot(lastSnapshot);
  undoStack = [];
  redoStack = [];
}

function refreshHistoryBaseline() {
  if (!canvasManager) return;
  lastSnapshot = getCurrentWorkspaceSnapshot();
  lastSnapshotHash = hashSnapshot(lastSnapshot);
}

function recordHistorySnapshot() {
  if (
    !canvasManager ||
    isRestoringState ||
    isApplyingHistory ||
    historySuspended
  ) {
    return;
  }
  if (!lastSnapshot) {
    initializeHistoryBaseline();
    return;
  }
  const currentSnapshot = getCurrentWorkspaceSnapshot();
  const currentHash = hashSnapshot(currentSnapshot);
  if (currentHash === lastSnapshotHash) {
    return;
  }
  undoStack.push({ snapshot: lastSnapshot, hash: lastSnapshotHash });
  if (undoStack.length > HISTORY_LIMIT) {
    undoStack.shift();
  }
  redoStack = [];
  lastSnapshot = currentSnapshot;
  lastSnapshotHash = currentHash;
}

function prepareHistoryForExternalChange() {
  if (!canvasManager || isRestoringState || isApplyingHistory) {
    return;
  }
  if (!lastSnapshot) {
    initializeHistoryBaseline();
    return;
  }
  undoStack.push({ snapshot: lastSnapshot, hash: lastSnapshotHash });
  if (undoStack.length > HISTORY_LIMIT) {
    undoStack.shift();
  }
  redoStack = [];
}

function runWithHistorySuspended(callback) {
  const previousValue = historySuspended;
  historySuspended = true;
  try {
    const result = callback();
    if (result && typeof result.then === 'function') {
      return result.finally(() => {
        historySuspended = previousValue;
      });
    }
    historySuspended = previousValue;
    return result;
  } catch (error) {
    historySuspended = previousValue;
    throw error;
  }
}

async function applyHistorySnapshot(entry) {
  if (!entry || !canvasManager) return;
  const targetSnapshot = entry.snapshot ?? entry;
  isApplyingHistory = true;
  const previousViewport = canvasManager?.viewportState
    ? {
        scale: canvasManager.viewportState.scale,
        panX: canvasManager.viewportState.panX,
        panY: canvasManager.viewportState.panY,
      }
    : null;
  try {
    await runWithHistorySuspended(async () => {
      simulation.stop();
      setPlayState(false);
      await canvasManager.load(targetSnapshot.circuit ?? { components: [], wires: [] });
      restoreBlocklyState(targetSnapshot.blockly ?? null, { clearWhenMissing: true });
      simulationResetNotified = false;
    });
    if (previousViewport) {
      Object.assign(canvasManager.viewportState, previousViewport);
      canvasManager.applyViewportTransform();
    }
    refreshHistoryBaseline();
    scheduleAutoSave();
  } finally {
    isApplyingHistory = false;
  }
}

async function performUndo() {
  if (!undoStack.length || !canvasManager || isApplyingHistory || isRestoringState) {
    return;
  }
  const entry = undoStack.pop();
  const currentSnapshot = getCurrentWorkspaceSnapshot();
  const currentHash = hashSnapshot(currentSnapshot);
  redoStack.push({ snapshot: currentSnapshot, hash: currentHash });
  if (redoStack.length > HISTORY_LIMIT) {
    redoStack.shift();
  }
  try {
    await applyHistorySnapshot(entry);
  } catch (error) {
    undoStack.push(entry);
    redoStack.pop();
    throw error;
  }
}

async function performRedo() {
  if (!redoStack.length || !canvasManager || isApplyingHistory || isRestoringState) {
    return;
  }
  const entry = redoStack.pop();
  const currentSnapshot = getCurrentWorkspaceSnapshot();
  const currentHash = hashSnapshot(currentSnapshot);
  undoStack.push({ snapshot: currentSnapshot, hash: currentHash });
  if (undoStack.length > HISTORY_LIMIT) {
    undoStack.shift();
  }
  try {
    await applyHistorySnapshot(entry);
  } catch (error) {
    redoStack.push(entry);
    undoStack.pop();
    throw error;
  }
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

function restoreBlocklyState(blocklyData, { clearWhenMissing = false } = {}) {
  if (!blocklyWorkspace || typeof window === 'undefined' || !window.Blockly) return;

  if (!blocklyData) {
    if (clearWhenMissing) {
      blocklyWorkspace.clear();
    }
    return;
  }

  try {
    if (
      blocklyData.format === 'json' &&
      window.Blockly.serialization?.workspaces?.load &&
      blocklyData.data &&
      typeof blocklyData.data !== 'string'
    ) {
      blocklyWorkspace.clear();
      window.Blockly.serialization.workspaces.load(blocklyData.data, blocklyWorkspace);
      return;
    }

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
      return;
    }
  } catch {
    // Ignora falhas de restauração específicas
  }

  if (clearWhenMissing) {
    blocklyWorkspace.clear();
  }
}

function normalizeWorkspaceSnapshot(raw) {
  if (!raw || typeof raw !== 'object') {
    return {
      circuit: null,
      blockly: null,
      hasBlockly: false,
    };
  }

  if (Array.isArray(raw.components)) {
    return {
      circuit: raw,
      blockly: null,
      hasBlockly: false,
    };
  }

  const hasBlockly = Object.prototype.hasOwnProperty.call(raw, 'blockly');
  const circuit = raw.circuit && typeof raw.circuit === 'object' ? raw.circuit : null;

  return {
    circuit: circuit ?? (Array.isArray(raw.components) ? raw : null),
    blockly: hasBlockly ? raw.blockly ?? null : null,
    hasBlockly,
  };
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

    restoreBlocklyState(parsed.blockly ?? null);
  } finally {
    isRestoringState = false;
    scheduleAutoSave();
  }
}

function attachBlocklyAutoSave() {
  if (!blocklyWorkspace || typeof window === 'undefined' || !window.Blockly) return;

  blocklyWorkspace.addChangeListener((event) => {
    if (isRestoringState || isApplyingHistory || historySuspended) return;
    if (!event || event.type === window.Blockly.Events.UI) return;
    scheduleAutoSave();
    recordHistorySnapshot();
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

    const point = canvasManager.clientToWorkspace(event.clientX, event.clientY);
    canvasManager.addComponent(component, point.x, point.y);
  });
}

function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Delete' && canvasManager) {
      if (handleDeleteSelection()) return;
      return;
    }

    const modifier = event.ctrlKey || event.metaKey;
    if (!modifier || event.altKey) return;

    const key = event.key.toLowerCase();
    if (key === 'z') {
      event.preventDefault();
      const action = event.shiftKey ? performRedo : performUndo;
      Promise.resolve(action()).catch(() => {});
      return;
    }

    if (key === 'y') {
      event.preventDefault();
      Promise.resolve(performRedo()).catch(() => {});
    }
  });
}

function handleDeleteSelection() {
  if (!canvasManager) return false;
  if (canvasManager.deleteSelectedComponent()) {
    recordHistorySnapshot();
    return true;
  }
  if (canvasManager.wiringManager.deleteSelectedWire()) {
    recordHistorySnapshot();
    return true;
  }
  return false;
}
