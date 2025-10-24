import { availableComponents, componentGroups, getComponentById } from './components.js';
import { CanvasManager } from './canvas.js';
import {
  initUI,
  setPlayState,
  triggerDownload,
  promptFileSelection,
  showAlert,
} from './ui.js';
import { simulation } from './simulation.js';
import { initBlocklyWorkspace, compileWorkspaceToProgram } from './blockly.js';

let canvasManager;
let simulationResetNotified = false;
let componentSearchTerm = '';
let blocklyWorkspace;

window.addEventListener('DOMContentLoaded', () => {
  initUI({
    onPlayPause: handlePlayPause,
    onClear: handleClearWorkspace,
    onSave: handleSaveWorkspace,
    onLoad: handleLoadWorkspace,
  });

  canvasManager = new CanvasManager({
    onInteraction: resetSimulationIfNecessary,
  });

  simulation.configure({
    onStateChange: setPlayState,
    onError: showAlert,
  });

  setupComponentSearch();
  renderComponentPalette();
  setupDropZone();
  setupKeyboardShortcuts();
  blocklyWorkspace = initBlocklyWorkspace();
  setupBlocklyPanelControls();
  setPlayState(false);
});

function handlePlayPause() {
  if (!canvasManager) return;
  if (simulation.isRunning) {
    simulation.stop();
    simulationResetNotified = false;
    return;
  }

  if (!blocklyWorkspace) {
    showAlert('Editor Blockly não iniciado. Recarregue a página e tente novamente.');
    return;
  }

  const boardComponent = canvasManager.components.find(
    (component) => component.type === 'amado-board' || component.type === 'esp32',
  );

  if (!boardComponent) {
    showAlert('Adicione a placa Amado ESP32 ao workspace para executar o programa.');
    return;
  }

  const { program, error } = compileWorkspaceToProgram(blocklyWorkspace);
  if (error) {
    showAlert(error);
    return;
  }

  simulation.start(canvasManager, {
    program,
    boardComponentId: boardComponent.id,
    onProgramError: (message) => showAlert(message),
  });
  simulationResetNotified = false;
}

function handleClearWorkspace() {
  if (!canvasManager) return;
  simulation.stop();
  setPlayState(false);
  canvasManager.clearWorkspace();
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
        canvasManager.load(data);
        simulationResetNotified = false;
      } catch (error) {
        showAlert('Arquivo inválido. Verifique o JSON e tente novamente.');
      }
    },
  });
}

function setupBlocklyPanelControls() {
  const panel = document.getElementById('blockly-panel');
  const toggleButton = document.getElementById('blockly-toggle-button');
  if (!panel || !toggleButton) return;

  toggleButton.addEventListener('click', () => {
    const isCollapsed = panel.classList.toggle('blockly-panel-collapsed');
    toggleButton.textContent = isCollapsed ? 'Expandir' : 'Minimizar';
    toggleButton.setAttribute('aria-expanded', String(!isCollapsed));

    window.setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
      if (blocklyWorkspace && window.Blockly) {
        window.Blockly.svgResize(blocklyWorkspace);
      }
    }, 0);
  });
}

function resetSimulationIfNecessary() {
  if (simulation.isRunning) {
    simulation.stop();
    setPlayState(false);
    if (!simulationResetNotified) {
      showAlert('Simulação reiniciada devido a alterações no circuito.');
      simulationResetNotified = true;
    }
  } else {
    simulationResetNotified = false;
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

function renderComponentPalette(filterText = componentSearchTerm) {
  componentSearchTerm = filterText;
  const componentsList = document.querySelector('.components-list');
  componentsList.innerHTML = '';

  const searchTerm = filterText.trim().toLowerCase();

  componentGroups.forEach((group) => {
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
    groupList.className = 'component-group-list';

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
  card.className = 'component-card';
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
