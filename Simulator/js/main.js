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
  setLabButtonState,
  setWireColorControlState,
  showColorPicker,
  hideColorPicker,
  isColorPickerOpen,
  clearPropertiesPanel,
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
let labModeEnabled = false;
let labPanel = null;
let labLibraryList = null;
let labUploadInput = null;

function svgTextToDataUrl(svgText) {
  const cleaned = String(svgText ?? '').trim();
  return `data:image/svg+xml;utf8,${encodeURIComponent(cleaned)}`;
}

function getLabLibraryItems() {
  return [
    {
      id: 'traffic-light',
      name: 'Semaforo',
      subtitle: 'Semaforo basico',
      width: 120,
      height: 280,
      src: svgTextToDataUrl(`
        <svg xmlns="http://www.w3.org/2000/svg" width="160" height="320" viewBox="0 0 160 320">
          <rect x="40" y="12" width="80" height="212" rx="12" fill="#1f2937"/>
          <circle cx="80" cy="60" r="22" fill="#e5e7eb"/>
          <circle cx="80" cy="120" r="22" fill="#e5e7eb"/>
          <circle cx="80" cy="180" r="22" fill="#e5e7eb"/>
          <rect x="70" y="230" width="20" height="70" fill="#374151"/>
        </svg>
      `),
    },
    {
      id: 'house',
      name: 'Casa',
      subtitle: 'Estrutura simples',
      width: 220,
      height: 180,
      src: svgTextToDataUrl(`
        <svg xmlns="http://www.w3.org/2000/svg" width="220" height="180" viewBox="0 0 220 180">
          <polygon points="110,18 18,86 202,86" fill="#ef4444"/>
          <rect x="40" y="80" width="140" height="88" fill="#f5c27b" stroke="#d97706" stroke-width="4"/>
          <rect x="96" y="112" width="28" height="50" fill="#7c2d12"/>
          <rect x="60" y="100" width="26" height="26" fill="#93c5fd"/>
          <rect x="134" y="100" width="26" height="26" fill="#93c5fd"/>
        </svg>
      `),
    },
    {
      id: 'tank',
      name: 'Reservatorio',
      subtitle: 'Tanque de agua',
      width: 200,
      height: 160,
      src: svgTextToDataUrl(`
        <svg xmlns="http://www.w3.org/2000/svg" width="200" height="160" viewBox="0 0 200 160">
          <rect x="20" y="40" width="160" height="90" rx="12" fill="#38bdf8"/>
          <rect x="20" y="30" width="160" height="24" rx="10" fill="#0284c7"/>
          <rect x="48" y="130" width="104" height="16" rx="8" fill="#0f172a"/>
        </svg>
      `),
    },
  ];
}

let isApplyingHistory = false;
let historySuspended = false;
let examplesList = [];
const EXAMPLE_GROUP = { id: 'examples', name: 'Exemplos' };

function getBlocklyInstance() {
  if (typeof window === 'undefined') return null;
  return window.Blockly ?? null;
}

function clearSimulationSelection() {
  canvasManager?.clearComponentSelection?.();
  canvasManager?.wiringManager?.deselectWire?.();
  clearPropertiesPanel();
}

function clearBlocklySelection() {
  const selected = blocklyWorkspace?.getSelected?.();
  if (selected?.unselect) {
    selected.unselect();
  }
  const Blockly = getBlocklyInstance();
  if (Blockly?.hideChaff) {
    Blockly.hideChaff();
  }
  if (Blockly?.DropDownDiv?.hide) {
    Blockly.DropDownDiv.hide();
  }
  if (Blockly?.Tooltip?.hide) {
    Blockly.Tooltip.hide();
  }
}

function attachCrossSelectionGuards() {
  const blocklyPanel = document.getElementById('blockly-panel');
  const blocklyContainer = document.getElementById('blockly-container');
  const blocklyToggle = document.getElementById('blockly-toggle-button');
  const blocklyOpenTrigger = document.getElementById('blockly-open-trigger');
  const workspaceEl = document.getElementById('workspace');

  const handleGlobalPointer = (event) => {
    const target = event.target;
    if (blocklyPanel?.contains(target) || blocklyContainer?.contains(target) || blocklyToggle === target || blocklyOpenTrigger === target) {
      clearSimulationSelection();
    } else if (workspaceEl?.contains(target)) {
      clearBlocklySelection();
    }
  };

  document.addEventListener('mousedown', handleGlobalPointer, true);
  document.addEventListener('touchstart', handleGlobalPointer, true);
}

window.addEventListener('DOMContentLoaded', () => {
  initUI({
    onPlayPause: handlePlayPause,
    onClear: handleClearWorkspace,
    onSave: handleSaveWorkspace,
    onLoad: handleLoadWorkspace,
    onExportImage: handleExportImage,
    onToggleSerialMonitor: handleToggleSerialMonitor,
    onOpenBlockly: handleOpenBlockly,
    onRotateComponent: handleRotateSelectedComponent,
    onFlipComponent: handleFlipSelectedComponent,
    onWireColorPicker: handleWireColorPicker,
    onToggleLab: toggleLabMode,
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
  setupLabPanel();
  blocklyWorkspace = initBlocklyWorkspace();
  setupBlocklyPanelControls();
  attachBlocklyAutoSave();
  attachCrossSelectionGuards();
  initializeHistoryBaseline();
  restorePersistedState().finally(() => {
    initializeHistoryBaseline();
  });
  loadExamplesList().catch(() => {});
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
        await applyWorkspaceSnapshot(snapshot);
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

async function applyWorkspaceSnapshot(snapshot) {
  if (!snapshot || !snapshot.circuit || !Array.isArray(snapshot.circuit.components)) {
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
    closeButton.textContent = isOpen ? 'Minimizar' : 'Código';
    closeButton.setAttribute('aria-expanded', String(isOpen));

    if (isOpen && blocklyWorkspace && window.Blockly) {
      window.requestAnimationFrame(() => {
        window.Blockly.svgResize(blocklyWorkspace);
      });
    } else if (!isOpen) {
      clearBlocklySelection();
      clearSimulationSelection();
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

  const rebuildOptions = () => {
    const current = filterSelect.value || componentFilterGroup;
    filterSelect.innerHTML = '';

    const allOption = document.createElement('option');
    allOption.value = 'all';
    allOption.textContent = 'Todos';
    filterSelect.appendChild(allOption);

    getPaletteGroups().forEach((group) => {
      const option = document.createElement('option');
      option.value = group.id;
      option.textContent = group.name;
      filterSelect.appendChild(option);
    });

    filterSelect.value = current;
  };

  rebuildOptions();

  filterSelect.value = componentFilterGroup;
  filterSelect.addEventListener('change', (event) => {
    componentFilterGroup = event.target.value || 'all';
    renderComponentPalette();
  });

  // Atualiza opções quando exemplos forem carregados
  filterSelect.__refreshOptions = rebuildOptions;
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

async function handleExportImage() {
  if (!canvasManager) return;
  try {
    const blob = await exportWorkspaceImage(canvasManager);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'diagrama.png';
    anchor.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    showAlert('Não foi possível exportar a imagem do diagrama.');
  }
}

function handleWireColorPicker() {
  const wiringManager = canvasManager?.wiringManager;
  if (isColorPickerOpen()) {
    hideColorPicker();
    return;
  }
  const wire = wiringManager?.selectedWire ?? null;
  const initialColor = wire?.color ?? wiringManager?.preferredWireColor ?? '#0ea5e9';
  const button = document.querySelector('.wire-color-button');
  const rect = button?.getBoundingClientRect?.();
  const anchorX = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
  const anchorY = rect ? rect.bottom + 6 : window.innerHeight / 2;
  showColorPicker(anchorX, anchorY, {
    initialColor,
    onSelect: (newColor) => {
      if (wire) {
        wiringManager.applyWireColor?.(wire, newColor);
      }
      wiringManager?.setPreferredWireColor?.(newColor);
      setWireColorControlState({ enabled: true, color: newColor });
    },
  });
}

function setLabMode(isEnabled) {
  labModeEnabled = Boolean(isEnabled);
  document.body.classList.toggle('lab-mode', labModeEnabled);
  if (labPanel) {
    labPanel.setAttribute('aria-hidden', labModeEnabled ? 'false' : 'true');
  }
  if (!labModeEnabled && canvasManager?.selectedComponentId) {
    const selected = canvasManager.getComponentById?.(canvasManager.selectedComponentId);
    if (selected?.type === 'lab-prop') {
      clearSimulationSelection();
    }
  }
  setLabButtonState(labModeEnabled);
}

function toggleLabMode() {
  setLabMode(!labModeEnabled);
}

function getWorkspaceCenterPosition() {
  if (!canvasManager?.workspace) return { x: 0, y: 0 };
  const rect = canvasManager.workspace.getBoundingClientRect();
  return canvasManager.clientToWorkspace(rect.left + rect.width / 2, rect.top + rect.height / 2);
}

async function addLabProp({ name, src, width = 200, height = 200 } = {}) {
  if (!canvasManager || !src) return;
  const center = getWorkspaceCenterPosition();
  const posX = center.x - width / 2;
  const posY = center.y - height / 2;
  await canvasManager.addComponent('lab-prop', posX, posY, {
    props: {
      label: name ?? 'Elemento visual',
      src,
      width,
      height,
      opacity: 1,
    },
    zIndex: 2,
  });
  setLabMode(true);
}

function renderLabLibrary() {
  if (!labLibraryList) return;
  const items = getLabLibraryItems();
  labLibraryList.innerHTML = '';
  items.forEach((item) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'lab-item-card';
    card.addEventListener('click', () => {
      addLabProp({
        name: item.name,
        src: item.src,
        width: item.width,
        height: item.height,
      });
    });

    const preview = document.createElement('div');
    preview.className = 'lab-item-preview';
    const img = document.createElement('img');
    img.src = item.src;
    img.alt = item.name;
    preview.appendChild(img);

    const info = document.createElement('div');
    info.className = 'lab-item-info';
    const title = document.createElement('div');
    title.className = 'lab-item-title';
    title.textContent = item.name;
    const subtitle = document.createElement('div');
    subtitle.className = 'lab-item-subtitle';
    subtitle.textContent = item.subtitle ?? 'Elemento visual';
    info.append(title, subtitle);

    card.append(preview, info);
    labLibraryList.appendChild(card);
  });
}

function ensureLabUploadInput() {
  if (labUploadInput) return labUploadInput;
  labUploadInput = document.createElement('input');
  labUploadInput.type = 'file';
  labUploadInput.accept = 'image/*,.svg';
  labUploadInput.style.display = 'none';
  document.body.appendChild(labUploadInput);
  return labUploadInput;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error ?? new Error('Falha ao ler arquivo.'));
    reader.readAsDataURL(file);
  });
}

function handleLabUpload() {
  const input = ensureLabUploadInput();
  input.value = '';
  input.onchange = async (event) => {
    const [file] = event.target.files ?? [];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showAlert('Selecione um arquivo de imagem valido.');
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const name = file.name.replace(/\.[^.]+$/, '') || 'Imagem';
      await addLabProp({ name, src: dataUrl, width: 240, height: 240 });
    } catch {
      showAlert('Nao foi possivel carregar a imagem.');
    }
  };
  input.click();
}

function setupLabPanel() {
  labPanel = document.getElementById('lab-panel');
  if (!labPanel) return;
  labLibraryList = labPanel.querySelector('.lab-library-list');
  const closeButton = labPanel.querySelector('#lab-panel-close');
  const uploadButton = labPanel.querySelector('#lab-upload-button');
  closeButton?.addEventListener('click', () => setLabMode(false));
  uploadButton?.addEventListener('click', handleLabUpload);
  renderLabLibrary();
  setLabMode(false);
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
  if (detail.componentId) {
    setWireColorControlState({
      enabled: true,
      color: canvasManager?.wiringManager?.preferredWireColor ?? '#0ea5e9',
    });
  }
});

window.addEventListener('simulator-wire-selection-change', (event) => {
  const detail = event.detail ?? {};
  setWireColorControlState({
    enabled: true,
    color:
      detail.color ??
      canvasManager?.wiringManager?.preferredWireColor ??
      '#0ea5e9',
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

function exportWorkspaceImage(manager) {
  const bounds = collectDiagramBounds(manager);
  if (!bounds) {
    return Promise.reject(new Error('Nenhum componente para exportar.'));
  }

  const padding = 20;
  const width = Math.ceil(bounds.maxX - bounds.minX + padding * 2);
  const height = Math.ceil(bounds.maxY - bounds.minY + padding * 2);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return Promise.reject(new Error('Canvas indisponível.'));
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  const cssText = collectDocumentStyles();
  return renderComponentsToCanvas(ctx, manager, bounds, padding, cssText)
    .then(() => renderWiresToCanvas(ctx, manager, bounds, padding, width, height))
    .then(() =>
      new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Falha ao gerar imagem.'));
            return;
          }
          resolve(blob);
        }, 'image/png');
      }),
    );
}

function collectDiagramBounds(manager) {
  const wiringManager = manager?.wiringManager;
  if (!manager || !wiringManager) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const addPoint = (x, y) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };

  manager.components.forEach((component) => {
    const wrapper = component.visualWrapper ?? component.container;
    if (!wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    const topLeft = manager.clientToWorkspace(rect.left, rect.top);
    const bottomRight = manager.clientToWorkspace(rect.right, rect.bottom);
    addPoint(topLeft.x, topLeft.y);
    addPoint(bottomRight.x, bottomRight.y);
  });

  wiringManager.connections.forEach((connection) => {
    const points = wiringManager.getConnectionPoints(connection);
    points.forEach((point) => addPoint(point.x, point.y));
  });

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return null;
  }

  return { minX, minY, maxX, maxY };
}

function collectDocumentStyles() {
  let cssText = '';
  const sheets = Array.from(document.styleSheets || []);
  sheets.forEach((sheet) => {
    try {
      const rules = sheet.cssRules;
      if (!rules) return;
      Array.from(rules).forEach((rule) => {
        cssText += `${rule.cssText}\n`;
      });
    } catch {
      // Ignora folhas de estilo inacessíveis
    }
  });
  return cssText;
}

function svgToDataUrl(svgElement) {
  if (!svgElement) return null;
  const clone = svgElement.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const serializer = new XMLSerializer();
  const svgText = serializer.serializeToString(clone);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;
}

function getShadowSvgDataUrl(element, { stripFilters = false, fixRotating = false } = {}) {
  const shadow = element?.shadowRoot;
  if (!shadow) return null;
  const svg = shadow.querySelector('svg');
  if (!svg) return null;
  const clone = svg.cloneNode(true);
  const styles = shadow.querySelectorAll('style');
  if (styles.length) {
    const styleNode = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    const combined = Array.from(styles)
      .map((style) => style.textContent || '')
      .join('\n');
    let filtered = combined;
    if (stripFilters) {
      filtered = filtered.replace(/filter:\s*url\([^)]*\);?/g, '');
    }
    if (fixRotating) {
      filtered = filtered.replace(/#rotating\s*\{[^}]*\}/g, (match) =>
        match
          .replace(/transform-origin:[^;]*;?/g, '')
          .replace(/transform:[^;]*;?/g, ''),
      );
    }
    styleNode.textContent = filtered;
    clone.insertBefore(styleNode, clone.firstChild);
  }
  if (stripFilters) {
    clone.querySelectorAll('filter').forEach((node) => node.remove());
    clone.querySelectorAll('[filter]').forEach((node) => node.removeAttribute('filter'));
  }
  if (fixRotating) {
    const originalRotating = shadow.querySelector('#rotating');
    const cloneRotating = clone.querySelector('#rotating');
    if (originalRotating && cloneRotating) {
      const computed = window.getComputedStyle(originalRotating);
      const transform = computed.transform;
      if (transform && transform !== 'none') {
        cloneRotating.style.transform = transform.replace(/matrix\(([^)]+)\)/, (full, vals) => {
          const normalized = vals.split(',').map((value) => value.trim()).join(' ');
          return `matrix(${normalized})`;
        });
        if (computed.transformOrigin) {
          cloneRotating.style.transformOrigin = computed.transformOrigin;
        }
      }
    }
  }
  return svgToDataUrl(clone);
}

function resolveComponentImageSource(component) {
  const element = component.element;
  const wrapper = component.visualWrapper ?? component.container;

  const shadowSvg = getShadowSvgDataUrl(element, {
    stripFilters: component.type === 'potentiometer',
    fixRotating: component.type === 'potentiometer',
  });
  if (shadowSvg) return shadowSvg;

  const shadowImg = element?.shadowRoot?.querySelector?.('img');
  if (shadowImg?.src) return shadowImg.src;

  if (element?.tagName === 'IMG' && element.src) {
    return element.src;
  }

  const img = wrapper?.querySelector?.('img');
  if (img?.src) return img.src;

  const svg = wrapper?.querySelector?.('svg');
  if (svg) {
    return svgToDataUrl(svg);
  }

  return null;
}

function buildPotentiometerSvgDataUrl(component, width, height) {
  const element = component?.element;
  const shadow = element?.shadowRoot;
  const svg = shadow?.querySelector?.('svg');
  if (!svg) return null;

  const clone = svg.cloneNode(true);
  const viewBox = clone.getAttribute('viewBox') || '0 0 20 20';
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  clone.setAttribute('viewBox', viewBox);

  clone.querySelectorAll('filter').forEach((node) => node.remove());
  clone.querySelectorAll('[filter]').forEach((node) => node.removeAttribute('filter'));

  clone.querySelectorAll('style').forEach((style) => {
    style.textContent = (style.textContent || '')
      .replace(/filter:\s*url\([^)]*\);?/g, '')
      .replace(/#rotating\s*\{[^}]*\}/g, '');
  });

  const min = Number(element?.min ?? 0);
  const max = Number(element?.max ?? 1023);
  const rawValue =
    Number(element?.value ?? element?.getAttribute?.('value')) ||
    Number(component?.props?.value ?? 0);
  const safeMax = Number.isFinite(max) && max !== min ? max : 1023;
  const safeMin = Number.isFinite(min) ? min : 0;
  const percent = Math.max(0, Math.min(1, (rawValue - safeMin) / (safeMax - safeMin)));
  const startDeg = Number(element?.startDegree ?? -135);
  const endDeg = Number(element?.endDegree ?? 135);
  const knobDeg = (endDeg - startDeg) * percent + startDeg;

  const styleNode = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  styleNode.textContent = `#rotating{transform-origin:10px 8px;transform:rotate(${knobDeg}deg);}`;
  clone.insertBefore(styleNode, clone.firstChild);

  return svgToDataUrl(clone);
}

function renderHtmlElementToImage(element, width, height, cssText, margin = 12) {
  return new Promise((resolve) => {
    if (!element || !width || !height) {
      resolve(null);
      return;
    }

    const paddedWidth = Math.max(1, width + margin * 2);
    const paddedHeight = Math.max(1, height + margin * 2);

    const root = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
    root.style.width = `${paddedWidth}px`;
    root.style.height = `${paddedHeight}px`;
    root.style.position = 'relative';
    root.style.overflow = 'visible';
    root.style.padding = `${margin}px`;
    root.style.boxSizing = 'border-box';

    const styleTag = document.createElement('style');
    styleTag.textContent = cssText;

    const clone = element.cloneNode(true);
    if (clone.style) {
      clone.style.transform = 'none';
      clone.style.position = 'relative';
      clone.style.left = '0';
      clone.style.top = '0';
      clone.style.margin = '0';
    }

    root.append(styleTag, clone);

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.setAttribute('width', String(paddedWidth));
    svg.setAttribute('height', String(paddedHeight));
    svg.setAttribute('viewBox', `0 0 ${paddedWidth} ${paddedHeight}`);

    const foreignObject = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
    foreignObject.setAttribute('x', '0');
    foreignObject.setAttribute('y', '0');
    foreignObject.setAttribute('width', String(paddedWidth));
    foreignObject.setAttribute('height', String(paddedHeight));
    foreignObject.appendChild(root);
    svg.appendChild(foreignObject);

    const dataUrl = svgToDataUrl(svg);
    if (!dataUrl) {
      resolve(null);
      return;
    }

    loadImage(dataUrl)
      .then((img) => resolve({ img, width: paddedWidth, height: paddedHeight }))
      .catch(() => resolve(null));
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    if (!src) {
      reject(new Error('Fonte de imagem inválida.'));
      return;
    }
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function renderComponentsToCanvas(ctx, manager, bounds, padding, cssText) {
  const components = [...manager.components].sort((a, b) => {
    const zA = Number.parseInt(a.container?.style?.zIndex ?? '0', 10) || 0;
    const zB = Number.parseInt(b.container?.style?.zIndex ?? '0', 10) || 0;
    return zA - zB;
  });

  for (const component of components) {
    const wrapper = component.visualWrapper ?? component.container;
    if (!wrapper) continue;
    const rect = wrapper.getBoundingClientRect();
    if (!rect.width || !rect.height) continue;

    const topLeft = manager.clientToWorkspace(rect.left, rect.top);
    const bottomRight = manager.clientToWorkspace(rect.right, rect.bottom);
    const width = bottomRight.x - topLeft.x;
    const height = bottomRight.y - topLeft.y;
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      continue;
    }

    let img = null;
    let drawWidth = width;
    let drawHeight = height;
    let applyContain = false;
    if (component.type === 'potentiometer') {
      const potSrc = buildPotentiometerSvgDataUrl(component, drawWidth, drawHeight);
      if (potSrc) {
        img = await loadImage(potSrc).catch(() => null);
        applyContain = false;
      }
    }
    if (!img) {
      const src = resolveComponentImageSource(component);
      if (src) {
        img = await loadImage(src).catch(() => null);
        applyContain = Boolean(img);
      }
    }
    if (!img) {
      const rendered = await renderHtmlElementToImage(component.element, width, height, cssText);
      if (rendered?.img) {
        img = rendered.img;
        drawWidth = rendered.width;
        drawHeight = rendered.height;
        applyContain = false;
      }
    }
    if (!img) continue;

    if (
      applyContain &&
      typeof img.naturalWidth === 'number' &&
      typeof img.naturalHeight === 'number' &&
      img.naturalWidth &&
      img.naturalHeight
    ) {
      const imgAspect = img.naturalWidth / img.naturalHeight;
      const boxAspect = drawWidth / drawHeight;
      if (boxAspect > imgAspect) {
        drawHeight = drawHeight;
        drawWidth = drawHeight * imgAspect;
      } else {
        drawWidth = drawWidth;
        drawHeight = drawWidth / imgAspect;
      }
    }

    const centerX = topLeft.x + width / 2;
    const centerY = topLeft.y + height / 2;
    const rotation = (component.transform?.rotation ?? 0) * (Math.PI / 180);
    const flipped = Boolean(component.transform?.flipped);

    ctx.save();
    ctx.translate(centerX - bounds.minX + padding, centerY - bounds.minY + padding);
    if (rotation) {
      ctx.rotate(rotation);
    }
    if (flipped) {
      ctx.scale(-1, 1);
    }
    ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    ctx.restore();
  }
}

async function renderWiresToCanvas(ctx, manager, bounds, padding, width, height) {
  const wiringManager = manager?.wiringManager;
  if (!wiringManager || !wiringManager.connections.length) return;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.setAttribute(
    'viewBox',
    `${bounds.minX - padding} ${bounds.minY - padding} ${width} ${height}`,
  );
  wiringManager.connections.forEach((connection) => {
    svg.appendChild(connection.line.cloneNode(true));
  });
  const svgUrl = svgToDataUrl(svg);
  if (!svgUrl) return;
  const img = await loadImage(svgUrl).catch(() => null);
  if (!img) return;
  ctx.drawImage(img, 0, 0, width, height);
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

function getPaletteGroups() {
  const groups = [...componentGroups];
  if (examplesList.length) {
    groups.push(EXAMPLE_GROUP);
  }
  return groups;
}

function renderComponentPalette(filterText = componentSearchTerm) {
  componentSearchTerm = filterText;
  const componentsList = document.querySelector('.components-list');
  componentsList.innerHTML = '';

  const searchTerm = filterText.trim().toLowerCase();

  const groups = getPaletteGroups();

  groups.forEach((group) => {
    const isExampleGroup = group.id === EXAMPLE_GROUP.id;
    if (componentFilterGroup === 'all' && isExampleGroup) {
      return;
    }
    if (componentFilterGroup !== 'all' && componentFilterGroup !== group.id) {
      return;
    }

    const items = isExampleGroup
      ? examplesList
      : availableComponents.filter(
          (component) =>
            component.group === group.id &&
            (!searchTerm ||
              component.name.toLowerCase().includes(searchTerm) ||
              component.description?.toLowerCase().includes(searchTerm)),
        );

    const filteredItems = isExampleGroup
      ? items.filter(
          (example) =>
            !searchTerm ||
            example.name.toLowerCase().includes(searchTerm) ||
            example.description?.toLowerCase().includes(searchTerm),
        )
      : items;

    if (!filteredItems.length) {
      return;
    }

    const groupContainer = document.createElement('div');
    groupContainer.className = 'component-group';

    const groupTitle = document.createElement('div');
    groupTitle.className = 'component-group-title';
    groupTitle.textContent = group.name;

    const groupList = document.createElement('div');
    groupList.className = `component-group-list component-view-${componentViewMode}`;

    filteredItems.forEach((item) => {
      const card = isExampleGroup ? createExampleCard(item) : createComponentCard(item);
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

function createExampleCard(example) {
  const card = document.createElement('div');
  card.className = `component-card component-view-${componentViewMode} component-example-card`;
  card.draggable = false;
  card.dataset.exampleId = example.id;

  const previewWrapper = document.createElement('div');
  previewWrapper.className = 'component-card-preview';
  if (example.preview) {
    const img = document.createElement('img');
    img.src = example.preview;
    img.alt = example.name;
    img.loading = 'lazy';
    previewWrapper.appendChild(img);
  } else {
    const placeholder = document.createElement('span');
    placeholder.textContent = example.name?.charAt?.(0) ?? 'E';
    previewWrapper.appendChild(placeholder);
  }

  const info = document.createElement('div');
  info.className = 'component-card-info';

  const name = document.createElement('div');
  name.className = 'component-card-name';
  name.textContent = example.name ?? 'Exemplo';

  const description = document.createElement('div');
  description.className = 'component-card-description';
  if (example.description) {
    description.textContent = example.description;
  } else {
    description.style.display = 'none';
  }

  info.append(name, description);
  card.append(previewWrapper, info);

  card.addEventListener('click', () => {
    loadExampleById(example.id).catch(() => {});
  });

  return card;
}

async function loadExamplesList() {
  if (typeof fetch !== 'function') return;
  try {
    const response = await fetch('examples/index.json', { cache: 'no-store' });
    if (!response.ok) return;
    const data = await response.json();
    if (!Array.isArray(data)) return;
    examplesList = data
      .filter((item) => item && item.id && item.name && item.file)
      .map((item) => {
        const file = item.file.startsWith('examples/') ? item.file : `examples/${item.file}`;
        const preview = item.preview
          ? item.preview.startsWith('examples/')
            ? item.preview
            : `examples/${item.preview}`
          : null;
        return {
          id: item.id,
          name: item.name,
          description: item.description ?? '',
          file,
          preview,
        };
      });
    const filterSelect = document.getElementById('component-filter-select');
    if (filterSelect?.__refreshOptions) {
      filterSelect.__refreshOptions();
    }
    renderComponentPalette();
  } catch {
    // ignora falha de carregamento de exemplos
  }
}

async function loadExampleById(exampleId) {
  const entry = examplesList.find((item) => item.id === exampleId);
  if (!entry) {
    showAlert('Exemplo não encontrado.');
    return;
  }
  if (typeof fetch !== 'function') {
    showAlert('Navegador não suporta carregamento de exemplos.');
    return;
  }
  try {
    const response = await fetch(entry.file, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('Arquivo de exemplo não encontrado.');
    }
    const data = await response.json();
    const snapshot = normalizeWorkspaceSnapshot(data);
    await applyWorkspaceSnapshot(snapshot);
    scheduleAutoSave();
    showAlert(`Exemplo "${entry.name}" carregado.`);
  } catch (error) {
    showAlert('Falha ao carregar o exemplo.');
    // eslint-disable-next-line no-console
    console.error(error);
  } finally {
    isRestoringState = false;
  }
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
