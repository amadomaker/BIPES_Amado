const toolbarElement = document.getElementById('toolbar');
const alertContainer = document.getElementById('alert-container');
const serialMonitorElement = document.getElementById('serial-monitor');
const serialMonitorOutput = document.getElementById('serial-monitor-output');
const serialMonitorClearButton = document.getElementById('serial-monitor-clear');
const serialMonitorCloseButton = document.getElementById('serial-monitor-close');
let propertiesPopover;
let lastPropertiesAnchor = null;

let playPauseButton;
let clearButton;
let saveButton;
let loadButton;
let monitorButton;
let rotateButton;
let flipButton;
let tutorialButton;
let wireColorButton;
let wireColorSwatch;
let labButton;

let currentToolbarHandlers = {
  onPlayPause: null,
  onClear: null,
  onSave: null,
  onLoad: null,
  onExportImage: null,
  onToggleSerialMonitor: null,
  onRotateComponent: null,
  onFlipComponent: null,
  onWireColorPicker: null,
  onToggleLab: null,
};

let contextMenu;
let colorPickerPopover;
let fileInput;
let tutorialOverlay;
let tutorialHighlight;
let tutorialPanel;
let tutorialState = {
  active: false,
  id: null,
  stepIndex: 0,
};

const alertTimers = new Map();
const TOOLBAR_ICON_LABELS = {
  undo: 'Desfazer',
  redo: 'Refazer',
  delete: 'Excluir',
  rotate: 'Rotacionar',
  flip: 'Inverter',
};

const TOOLBAR_ICON_SVGS = {
  undo: `
    <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="#1f2937">
      <path fill-rule="evenodd" d="M9.53 2.47a.75.75 0 0 1 0 1.06L6.31 6.75H14a7.75 7.75 0 1 1 0 15.5h-2a.75.75 0 0 1 0-1.5h2a6.25 6.25 0 1 0 0-12.5H6.31l3.22 3.22a.75.75 0 1 1-1.06 1.06l-4.5-4.5a.75.75 0 0 1 0-1.06l4.5-4.5a.75.75 0 0 1 1.06 0Z" clip-rule="evenodd"/>
    </svg>
  `,
  redo: `
    <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="#1f2937">
      <path fill-rule="evenodd" d="M14.47 2.47a.75.75 0 0 1 1.06 0l4.5 4.5a.75.75 0 0 1 0 1.06l-4.5 4.5a.75.75 0 1 1-1.06-1.06l3.22-3.22H10a6.25 6.25 0 1 0 0 12.5h2a.75.75 0 0 1 0 1.5h-2a7.75 7.75 0 1 1 0-15.5h7.69l-3.22-3.22a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd"/>
    </svg>
  `,
  delete: `
    <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 6h16" stroke="#1f2937" stroke-width="2" stroke-linecap="round"/>
      <path d="M9 11v6" stroke="#1f2937" stroke-width="2" stroke-linecap="round"/>
      <path d="M15 11v6" stroke="#1f2937" stroke-width="2" stroke-linecap="round"/>
      <path d="M10 6V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2" fill="none" stroke="#1f2937" stroke-width="2" stroke-linecap="round"/>
      <path d="M6 6h12v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z" fill="#f8fafc" stroke="#1f2937" stroke-width="2" stroke-linejoin="round"/>
    </svg>
  `,
  rotate: `
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
      <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>

  `,
  flip: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
      <path d="M16 16V12L21 17L16 22V18H4V16H16ZM8 2V5.999L20 6V8H8V12L3 7L8 2Z"></path>
    </svg>
  `,
};
const WIRE_COLOR_PRESETS = [
  '#1f2937', // grafite
  '#000000', // preto
  '#6b7280', // cinza
  '#ef4444', // vermelho
  '#f97316', // laranja
  '#facc15', // amarelo
  '#22c55e', // verde
  '#0ea5e9', // ciano
  '#3b82f6', // azul
  '#6366f1', // azul violeta
  '#a855f7', // roxo
  '#ec4899', // rosa
  '#ffffff', // branco
  '#d1d5db', // cinza claro
  '#b45309', // marrom
];

export function initUI(handlers) {
  if (!toolbarElement) return;
  currentToolbarHandlers = { ...currentToolbarHandlers, ...handlers };
  renderToolbar();
  ensureGlobalListeners();
  initSerialMonitorControls();
}

function renderToolbar() {
  if (!toolbarElement) return;
  toolbarElement.innerHTML = '';

  playPauseButton = createToolbarButton('▶ Play', () => {
    currentToolbarHandlers.onPlayPause?.();
  }, 'btn-play');

  clearButton = createToolbarButton('🗑️ Limpar tudo', () => {
    currentToolbarHandlers.onClear?.();
  }, 'btn-clear');

  saveButton = createToolbarButton('💾 Salvar projeto', () => {
    currentToolbarHandlers.onSave?.();
  }, 'btn-save');

  loadButton = createToolbarButton('📂 Carregar', () => {
    currentToolbarHandlers.onLoad?.();
  }, 'btn-load');

  const exportButton = createToolbarButton('🖼️ Salvar diagrama', () => {
    currentToolbarHandlers.onExportImage?.();
  }, 'btn-export-image');
  exportButton.title = 'Salvar diagrama como imagem';

  monitorButton = createToolbarButton('🖥 Console', () => {
    currentToolbarHandlers.onToggleSerialMonitor?.();
  }, 'btn-console');
  monitorButton.setAttribute('aria-pressed', 'false');

  rotateButton = createToolbarIconButton('rotate', () => {
    currentToolbarHandlers.onRotateComponent?.();
  }, 'btn-rotate');
  rotateButton.disabled = true;
  rotateButton.title = 'Rotacionar componente selecionado';

  flipButton = createToolbarIconButton('flip', () => {
    currentToolbarHandlers.onFlipComponent?.();
  }, 'btn-flip');
  flipButton.disabled = true;
  flipButton.title = 'Inverter componente selecionado';

  wireColorButton = createWireColorButton(() => {
    currentToolbarHandlers.onWireColorPicker?.();
  });
  wireColorButton.title = 'Cor do fio selecionado';

  const undoButton = createToolbarIconButton('undo', () => {
    currentToolbarHandlers.onUndo?.();
  }, 'btn-undo');
  undoButton.title = 'Desfazer (Ctrl+Z)';

  const redoButton = createToolbarIconButton('redo', () => {
    currentToolbarHandlers.onRedo?.();
  }, 'btn-redo');
  redoButton.title = 'Refazer (Ctrl+Shift+Z)';

  const deleteButton = createToolbarIconButton('delete', () => {
    currentToolbarHandlers.onDelete?.();
  }, 'btn-delete');
  deleteButton.title = 'Excluir seleção (Delete)';

  tutorialButton = createToolbarButton('📘 Tutorial', () => {
    startTutorial('onboarding');
  }, 'btn-tutorial');
  tutorialButton.title = 'Abrir tutorial guiado';

  labButton = createToolbarButton('🧪 Laboratorio', () => {
    currentToolbarHandlers.onToggleLab?.();
  }, 'btn-lab');
  labButton.title = 'Abrir laboratorio visual';
  labButton.setAttribute('aria-pressed', 'false');

  toolbarElement.append(
    playPauseButton,
    clearButton,
    saveButton,
    loadButton,
    exportButton,
    monitorButton,
    undoButton,
    redoButton,
    deleteButton,
    rotateButton,
    flipButton,
    wireColorButton,
    tutorialButton,
    labButton,
  );

  setTransformControlsState({ canRotate: false, canFlip: false });
}

function createToolbarButton(label, handler, id) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  if (id) button.id = id;
  button.addEventListener('click', handler);
  return button;
}

function createToolbarIconButton(iconName, handler, id) {
  const button = document.createElement('button');
  button.type = 'button';
  button.classList.add('toolbar-icon');
  if (id) button.id = id;
  button.addEventListener('click', handler);
  if (TOOLBAR_ICON_LABELS[iconName]) {
    button.setAttribute('aria-label', TOOLBAR_ICON_LABELS[iconName]);
  }

  if (TOOLBAR_ICON_SVGS[iconName]) {
    button.innerHTML = TOOLBAR_ICON_SVGS[iconName];
  }

  return button;
}

function createWireColorButton(handler) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'wire-color-button';
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    handler();
  });

  wireColorSwatch = document.createElement('span');
  wireColorSwatch.className = 'wire-color-swatch';
  wireColorSwatch.style.backgroundColor = '#1f2937';

  const arrow = document.createElement('span');
  arrow.className = 'wire-color-arrow';

  button.append(wireColorSwatch, arrow);
  return button;
}

function ensureGlobalListeners() {
  document.addEventListener('click', () => hideContextMenu());
  window.addEventListener('blur', () => hideContextMenu());
  window.addEventListener('resize', () => {
    hideColorPicker();
    if (propertiesPopover?.style.display === 'block') {
      positionPropertiesPopover(lastPropertiesAnchor);
    }
    if (tutorialState.active) {
      renderTutorialStep();
    }
  });
}

function ensurePropertiesPopover() {
  if (propertiesPopover) return;
  propertiesPopover = document.createElement('div');
  propertiesPopover.className = 'properties-popover';
  document.body.appendChild(propertiesPopover);
}

function positionPropertiesPopover(anchor) {
  if (!propertiesPopover) return;

  const margin = 12;
  const { offsetWidth: width, offsetHeight: height } = propertiesPopover;
  const canvasArea = document.getElementById('canvas-area');
  const canvasRect = canvasArea?.getBoundingClientRect();

  // Alinha no canto superior direito da área do canvas, com leve margem
  const rightEdge = (canvasRect?.right ?? window.innerWidth) - margin;
  const topEdge = (canvasRect?.top ?? 0) + margin;
  const left = Math.max(margin, rightEdge - width);

  // Mantém o topo dentro da viewport, mas prioriza a faixa superior do canvas
  const viewportHeight = window.innerHeight;
  let top = Math.max(margin, topEdge);
  if (anchor && typeof anchor === 'object') {
    const rectTop = Number(anchor.top) || 0;
    const desired = rectTop - margin; // ligeiramente acima do componente
    top = Math.max(top, Math.min(desired, viewportHeight - height - margin));
  }

  propertiesPopover.style.left = `${Math.round(left)}px`;
  propertiesPopover.style.top = `${Math.round(top)}px`;
}

export function setPlayState(isRunning) {
  if (!playPauseButton) return;
  playPauseButton.textContent = isRunning ? '⏸ Pause' : '▶ Play';
}

export function updatePropertiesPanel({ title, fields, anchor } = {}) {
  if (!title && (!fields || fields.length === 0)) {
    clearPropertiesPanel();
    return;
  }

  ensurePropertiesPopover();

  const fragment = document.createDocumentFragment();

  if (title) {
    const titleElement = document.createElement('div');
    titleElement.className = 'properties-popover-title';
    titleElement.textContent = title;
    fragment.appendChild(titleElement);
  }

  if (fields && fields.length) {
    const fieldsContainer = document.createElement('div');
    fieldsContainer.className = 'properties-popover-fields';

    fields.forEach(({ label, value, control }) => {
      const field = document.createElement('div');
      field.className = 'properties-popover-field';

      const labelSpan = document.createElement('span');
      labelSpan.textContent = label;
      field.append(labelSpan);

      if (control) {
        const controlWrapper = document.createElement('span');
        controlWrapper.appendChild(buildControl(control));
        field.append(controlWrapper);
      } else {
        const valueSpan = document.createElement('span');
        valueSpan.textContent = value;
        field.append(valueSpan);
      }

      fieldsContainer.appendChild(field);
    });

    fragment.appendChild(fieldsContainer);
  }

  propertiesPopover.innerHTML = '';
  propertiesPopover.appendChild(fragment);
  propertiesPopover.style.display = 'block';
  lastPropertiesAnchor = anchor ?? null;
  positionPropertiesPopover(anchor);
}

function buildControl(control) {
  switch (control.type) {
    case 'select': {
      const select = document.createElement('select');
      select.className = 'properties-popover-input';
      control.options?.forEach(({ label, value }) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        select.appendChild(option);
      });
      if (control.value !== undefined) {
        select.value = control.value;
      }
      if (control.onChange) {
        select.addEventListener('change', (event) => control.onChange(event.target.value));
      }
      return select;
    }
    case 'number':
    case 'text': {
      const input = document.createElement('input');
      input.type = control.type;
      input.className = 'properties-popover-input';
      if (control.placeholder) {
        input.placeholder = control.placeholder;
      }
      if (control.min !== undefined) {
        input.min = String(control.min);
      }
      if (control.max !== undefined) {
        input.max = String(control.max);
      }
      if (control.step !== undefined) {
        input.step = String(control.step);
      }
      if (control.value !== undefined && control.value !== null) {
        input.value = String(control.value);
      }
      if (control.onChange) {
        input.addEventListener('change', (event) => control.onChange(event.target.value));
      }
      return input;
    }
    default:
      return document.createTextNode(control.value ?? '');
  }
}

export function clearPropertiesPanel() {
  if (!propertiesPopover) return;
  propertiesPopover.style.display = 'none';
  propertiesPopover.innerHTML = '';
  lastPropertiesAnchor = null;
}

export function showComponentContextMenu(
  x,
  y,
  { onDelete, onBringToFront, onSendToBack } = {},
) {
  const items = [];
  if (onBringToFront) {
    items.push({ label: 'Trazer para frente', action: onBringToFront });
  }
  if (onSendToBack) {
    items.push({ label: 'Enviar para tras', action: onSendToBack });
  }
  if (onDelete) {
    items.push({ label: 'Excluir componente', action: onDelete });
  }
  displayContextMenu(x, y, items);
}

export function showWireContextMenu(x, y, { onDelete, onChangeColor } = {}) {
  const items = [];
  if (onChangeColor) {
    items.push({ label: 'Mudar cor', action: onChangeColor });
  }
  if (onDelete) {
    items.push({ label: 'Excluir conexão', action: onDelete });
  }
  displayContextMenu(x, y, items);
}

function displayContextMenu(x, y, items) {
  hideContextMenu();
  if (!items || !items.length) return;

  contextMenu = document.createElement('div');
  contextMenu.className = 'context-menu';

  const rect = document.body.getBoundingClientRect();
  const menuWidth = 180;
  const menuHeight = items.length * 36;
  const posX = Math.min(x, rect.right - menuWidth - 10);
  const posY = Math.min(y, rect.bottom - menuHeight - 10);

  contextMenu.style.left = `${posX}px`;
  contextMenu.style.top = `${posY}px`;
  contextMenu.addEventListener('click', (event) => event.stopPropagation());

  items.forEach(({ label, action }) => {
    const item = document.createElement('div');
    item.className = 'context-menu-item';
    item.textContent = label;
    item.addEventListener('click', (event) => {
      event.stopPropagation();
      hideContextMenu();
      action?.();
    });
    contextMenu.appendChild(item);
  });

  document.body.appendChild(contextMenu);
}

export function hideContextMenu() {
  if (contextMenu?.parentElement) {
    contextMenu.parentElement.removeChild(contextMenu);
  }
  contextMenu = null;
  hideColorPicker();
}

function initSerialMonitorControls() {
  if (!serialMonitorElement) return;
  serialMonitorElement.setAttribute('aria-hidden', 'true');

  serialMonitorClearButton?.addEventListener('click', () => {
    clearSerialMonitor();
  });

  serialMonitorCloseButton?.addEventListener('click', () => {
    toggleSerialMonitor(false);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      toggleSerialMonitor(false);
    }
  });
}

export function toggleSerialMonitor(force) {
  if (!serialMonitorElement) return;
  const isOpen = serialMonitorElement.classList.contains('serial-monitor-open');
  const shouldOpen = typeof force === 'boolean' ? force : !isOpen;
  if (shouldOpen === isOpen) return;

  serialMonitorElement.classList.toggle('serial-monitor-open', shouldOpen);
  serialMonitorElement.setAttribute('aria-hidden', String(!shouldOpen));
  monitorButton?.classList.toggle('active', shouldOpen);
  monitorButton?.setAttribute('aria-pressed', String(shouldOpen));

  if (shouldOpen && serialMonitorOutput) {
    window.requestAnimationFrame(() => {
      serialMonitorOutput.scrollTo({
        top: serialMonitorOutput.scrollHeight,
        behavior: 'auto',
      });
    });
  }
}

export function clearSerialMonitor() {
  if (!serialMonitorOutput) return;
  serialMonitorOutput.innerHTML = '';
}

export function appendSerialLog(entry) {
  if (!serialMonitorOutput) return;

  const { message, args, timestamp, level } = normalizeLogEntry(entry);
  if (!message && !args.length) return;

  const line = document.createElement('div');
  line.className = 'serial-monitor-line';

  const time = document.createElement('span');
  time.className = 'serial-monitor-time';
  time.textContent = formatTimestamp(timestamp);

  const text = document.createElement('span');
  text.className = 'serial-monitor-text';
  text.textContent = [message, ...args].filter(Boolean).join(' ');
  if (level === 'error') {
    text.style.color = '#ff5252';
  }

  line.append(time, text);
  serialMonitorOutput.appendChild(line);
  serialMonitorOutput.scrollTop = serialMonitorOutput.scrollHeight;
}

export function setTransformControlsState(state = {}) {
  const canRotate = Boolean(state.canRotate);
  const canFlip = Boolean(state.canFlip);
  if (rotateButton) {
    rotateButton.disabled = !canRotate;
  }
  if (flipButton) {
    flipButton.disabled = !canFlip;
  }
}

export function setLabButtonState(isActive) {
  if (!labButton) return;
  labButton.classList.toggle('active', Boolean(isActive));
  labButton.setAttribute('aria-pressed', String(Boolean(isActive)));
}

export function setWireColorControlState({ enabled = false, color = null } = {}) {
  if (!wireColorButton) return;
  if (wireColorSwatch && color) {
    wireColorSwatch.style.backgroundColor = color;
  }
}

function normalizeLogEntry(entry) {
  if (typeof entry === 'string') {
    return {
      message: entry,
      args: [],
      timestamp: Date.now(),
      level: 'info',
    };
  }

  if (Array.isArray(entry)) {
    return {
      message: '',
      args: entry.map(formatLogValue),
      timestamp: Date.now(),
      level: 'info',
    };
  }

  if (entry && typeof entry === 'object') {
    const arrArgs = Array.isArray(entry.args)
      ? entry.args.map(formatLogValue)
      : [];
    return {
      message: entry.message ? formatLogValue(entry.message) : '',
      args: arrArgs,
      timestamp: entry.timestamp ?? Date.now(),
      level: entry.level ?? 'info',
    };
  }

  return {
    message: formatLogValue(entry),
    args: [],
    timestamp: Date.now(),
    level: 'info',
  };
}

function formatTimestamp(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatLogValue(value) {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && !Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '[Objeto]';
    }
  }
  return String(value);
}

const normalizeHex = (value) => {
  if (typeof value !== 'string') return '';
  const hex = value.trim().toLowerCase();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/.test(hex)) {
    if (hex.length === 4) {
      return (
        '#' +
        hex
          .slice(1)
          .split('')
          .map((char) => char + char)
          .join('')
      );
    }
    return hex;
  }
  return '';
};

const isLightColor = (hexColor) => {
  const hex = normalizeHex(hexColor).replace('#', '');
  if (hex.length !== 6) return false;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 200;
};

export function showColorPicker(x, y, { initialColor = '#00ff00', onSelect } = {}) {
  hideColorPicker();

  colorPickerPopover = document.createElement('div');
  colorPickerPopover.className = 'color-picker-popover';
  colorPickerPopover.setAttribute('role', 'dialog');
  colorPickerPopover.setAttribute('aria-label', 'Selecionar cor do fio');

  const title = document.createElement('span');
  title.className = 'color-picker-title';
  title.textContent = 'Cor do fio';

  const grid = document.createElement('div');
  grid.className = 'color-picker-grid';

  const normalizedInitial = normalizeHex(initialColor) || '#00ff00';
  let initialHandled = false;

  const createSwatch = (color, { highlight = false, labelText = null } = {}) => {
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className = 'color-picker-swatch';
    swatch.style.setProperty('--swatch-color', color);
    swatch.title = labelText ? `${labelText} (${color.toUpperCase()})` : color.toUpperCase();
    swatch.setAttribute('aria-label', labelText ? `${labelText} ${color}` : `Cor ${color}`);
    if (highlight) {
      swatch.classList.add('is-selected');
    }
    if (isLightColor(color)) {
      swatch.classList.add('is-light');
    }
    swatch.addEventListener('click', () => {
      onSelect?.(color);
      hideColorPicker();
    });
    return swatch;
  };

  WIRE_COLOR_PRESETS.forEach((presetColor) => {
    const normalized = normalizeHex(presetColor);
    const isActive = normalized === normalizedInitial;
    if (isActive) {
      initialHandled = true;
    }
    grid.appendChild(createSwatch(normalized, { highlight: isActive }));
  });

  if (!initialHandled && normalizedInitial) {
    grid.appendChild(createSwatch(normalizedInitial, { highlight: true, labelText: 'Cor atual' }));
  }

  const customInput = document.createElement('input');
  customInput.type = 'color';
  customInput.value = normalizedInitial;
  customInput.className = 'color-picker-native-input';
  customInput.addEventListener('input', () => {
    onSelect?.(normalizeHex(customInput.value));
    hideColorPicker();
  });

  const customButton = document.createElement('button');
  customButton.type = 'button';
  customButton.className = 'color-picker-custom';
  customButton.textContent = 'Mais cores...';
  customButton.addEventListener('click', () => {
    customInput.click();
  });

  colorPickerPopover.addEventListener('click', (event) => event.stopPropagation());

  colorPickerPopover.style.left = '-9999px';
  colorPickerPopover.style.top = '-9999px';

  colorPickerPopover.append(title, grid, customButton, customInput);
  document.body.appendChild(colorPickerPopover);

  window.requestAnimationFrame(() => {
    const rect = document.body.getBoundingClientRect();
    const pickerRect = colorPickerPopover.getBoundingClientRect();
    const posX = Math.min(x, rect.right - pickerRect.width - 10);
    const posY = Math.min(y, rect.bottom - pickerRect.height - 10);
    const finalX = Math.max(rect.left + 10, posX);
    const finalY = Math.max(rect.top + 10, posY);
    colorPickerPopover.style.left = `${finalX}px`;
    colorPickerPopover.style.top = `${finalY}px`;
  });
}

export function hideColorPicker() {
  if (colorPickerPopover?.parentElement) {
    colorPickerPopover.parentElement.removeChild(colorPickerPopover);
  }
  colorPickerPopover = null;
}

export function isColorPickerOpen() {
  return Boolean(colorPickerPopover);
}

export function showAlert(message, duration = 4000) {
  if (!alertContainer) return;

  const alert = document.createElement('div');
  alert.className = 'alert-message';
  alert.textContent = message;

  alertContainer.appendChild(alert);

  if (alertTimers.has(alert)) {
    clearTimeout(alertTimers.get(alert));
  }

  const timer = window.setTimeout(() => {
    if (alert.parentElement) {
      alert.parentElement.removeChild(alert);
    }
    alertTimers.delete(alert);
  }, duration);

  alertTimers.set(alert, timer);
}

export function triggerDownload(filename, data) {
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function promptFileSelection({ onLoad } = {}) {
  if (!fileInput) {
    fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'application/json';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);
  }

  fileInput.value = '';
  fileInput.onchange = async (event) => {
    const [file] = event.target.files ?? [];
    if (!file) return;
    const text = await file.text();
    onLoad?.(text);
  };

  fileInput.click();
}

const tutorialScripts = {
  onboarding: {
    title: 'Primeiros passos',
    steps: [
      {
        title: 'Bem-vindo',
        description:
          'Bem-vindo! Vamos apresentar as áreas e recursos principais da simulação para você começar rápido.',
        targetSelector: '#toolbar',
      },
      {
        title: 'Barra de ferramentas',
        description:
          'Aqui ficam os botões principais. Vamos passar por cada um rapidamente.',
        targetSelector: '#toolbar',
      },
      {
        title: 'Play/Pause',
        description: 'Roda ou pausa a simulação quando seu circuito e blocos estiverem prontos.',
        targetSelector: '#btn-play',
      },
      {
        title: 'Limpar',
        description: 'Remove tudo do canvas para começar do zero.',
        targetSelector: '#btn-clear',
      },
      {
        title: 'Salvar / Carregar',
        description: 'Guarde seu projeto em JSON ou carregue um salvo anteriormente.',
        targetSelector: '#btn-save',
      },
      {
        title: 'Console',
        description: 'Abre/fecha o console para ver logs do seu programa.',
        targetSelector: '#btn-console',
      },
      {
        title: 'Desfazer / Refazer / Excluir',
        description: 'Volte atrás, refaça ações ou exclua o que estiver selecionado.',
        targetSelector: '#btn-undo',
      },
      {
        title: 'Rotacionar / Inverter',
        description: 'Ajuste a orientação do componente selecionado.',
        targetSelector: '#btn-rotate',
      },
      {
        title: 'Categorias e modo de visualização',
        description: 'Use as categorias para filtrar componentes e alterne entre grade ou lista.',
        targetSelector: '.component-controls',
      },
      {
        title: 'Grade / Lista',
        description: 'Escolha a visualização que preferir para navegar nos componentes.',
        targetSelector: '.component-view-toggle',
      },
      {
        title: 'Escolha um componente',
        description: 'Clique em um item e arraste para o canvas para começar a montar.',
        targetSelector: '.components-list',
      },
      {
        title: 'Área de montagem',
        description:
          'Aqui você monta o circuito. Selecione um componente para ver propriedades e mover/rotacionar.',
        targetSelector: '#workspace',
      },
      {
        title: 'Editor de blocos (Código)',
        description:
          'Use o botão Código para abrir os blocos e montar sua programação arrastando-os na área lateral.',
        targetSelector: '#blockly-open-trigger',
      },
      {
        title: 'Próximo passo',
        description:
          'Pronto! Agora você conhece os controles. Clique em Próximo para seguir para um projeto rápido.',
        targetSelector: '#workspace',
      },
    ],
    nextTutorial: 'led-basic',
  },
  'led-basic': {
    title: 'Meu primeiro projeto',
    steps: [
      {
        title: 'Visão geral',
        description: 'Vamos montar um LED com resistor e bateria 9V. Siga os passos para arrastar cada um.',
        targetSelector: '.components-list',
      },
      {
        title: 'Adicionar bateria',
        description: 'Arraste a bateria de 9V para o canvas.',
        targetSelector: '.component-card[data-component-id="battery-9v"]',
      },
      {
        title: 'Adicionar LED',
        description: 'Agora arraste um LED para o canvas.',
        targetSelector: '.component-card[data-component-id="led"]',
      },
      {
        title: 'Adicionar resistor',
        description: 'Arraste também um resistor para a área.',
        targetSelector: '.component-card[data-component-id="resistor"]',
      },
      {
        title: 'Ajuste de zoom',
        description: 'Use a roda do mouse ou gesto de pinça para dar zoom e enxergar melhor os pinos.',
        targetSelector: '#canvas-area',
      },
      {
        title: 'Fazer as ligações',
        description:
          'Conecte VCC da bateria → resistor → terminal positivo do LED (perna maior). Depois GND da bateria → terminal negativo do LED. Siga na ordem para facilitar.',
        targetSelector: '#workspace',
      },
      {
        title: 'Valor do resistor',
        description: 'Selecione o resistor e ajuste o valor se quiser limitar mais a corrente.',
        targetSelector: '#workspace',
      },
      {
        title: 'Rodar a simulação',
        description: 'Clique em Play para ligar o circuito. Se não acender, revise as conexões.',
        targetSelector: '#btn-play',
      },
    ],
    nextTutorial: null,
  },
};

function ensureTutorialOverlay() {
  if (tutorialOverlay) return;
  tutorialOverlay = document.createElement('div');
  tutorialOverlay.id = 'tutorial-overlay';
  tutorialOverlay.className = 'tutorial-overlay hidden';

  const backdrop = document.createElement('div');
  backdrop.className = 'tutorial-backdrop';
  tutorialOverlay.appendChild(backdrop);

  tutorialHighlight = document.createElement('div');
  tutorialHighlight.className = 'tutorial-highlight';
  tutorialOverlay.appendChild(tutorialHighlight);

  tutorialPanel = document.createElement('div');
  tutorialPanel.className = 'tutorial-panel';
  tutorialOverlay.appendChild(tutorialPanel);

  document.body.appendChild(tutorialOverlay);
}

function renderTutorialStep() {
  if (!tutorialState.active || !tutorialOverlay) return;
  const script = tutorialScripts[tutorialState.id];
  if (!script) return stopTutorial();
  const step = script.steps[tutorialState.stepIndex];
  if (!step) return stopTutorial();

  tutorialOverlay.classList.remove('hidden');
  tutorialPanel.innerHTML = '';

  const title = document.createElement('div');
  title.className = 'tutorial-title';
  title.textContent = script.title;

  const subtitle = document.createElement('div');
  subtitle.className = 'tutorial-step-title';
  subtitle.textContent = step.title;

  const description = document.createElement('div');
  description.className = 'tutorial-description';
  description.textContent = step.description;

  const actions = document.createElement('div');
  actions.className = 'tutorial-actions';

    const prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.textContent = 'Anterior';
    prevBtn.disabled = tutorialState.stepIndex === 0;
    prevBtn.addEventListener('click', () => goToPrevStep());

    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    const isLast = tutorialState.stepIndex === script.steps.length - 1;
    nextBtn.textContent = isLast ? (script.nextTutorial ? 'Próximo tutorial' : 'Concluir') : 'Próximo';
    if (isLast && script.nextTutorial) {
      nextBtn.classList.add('tutorial-next');
    }
    nextBtn.addEventListener('click', () => goToNextStep());

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.textContent = 'Fechar';
  closeBtn.addEventListener('click', () => stopTutorial());

  actions.append(prevBtn, nextBtn, closeBtn);
  tutorialPanel.append(title, subtitle, description, actions);

  positionTutorialHighlight(step.targetSelector);
}

function positionTutorialHighlight(selector) {
  if (!tutorialHighlight) return;
  if (!selector) {
    tutorialHighlight.classList.add('hidden');
    return;
  }
  const target = document.querySelector(selector);
  if (!target) {
    tutorialHighlight.classList.add('hidden');
    return;
  }
  const rect = target.getBoundingClientRect();
  if (!rect?.width || !rect?.height) {
    tutorialHighlight.classList.add('hidden');
    return;
  }
  const padding = 6;
  tutorialHighlight.classList.remove('hidden');
  tutorialHighlight.style.left = `${rect.left - padding}px`;
  tutorialHighlight.style.top = `${rect.top - padding}px`;
  tutorialHighlight.style.width = `${rect.width + padding * 2}px`;
  tutorialHighlight.style.height = `${rect.height + padding * 2}px`;
}

function goToPrevStep() {
  const script = tutorialScripts[tutorialState.id];
  if (!script) return stopTutorial();
  tutorialState.stepIndex = Math.max(0, tutorialState.stepIndex - 1);
  renderTutorialStep();
}

function goToNextStep() {
  const script = tutorialScripts[tutorialState.id];
  if (!script) return stopTutorial();
  const isLast = tutorialState.stepIndex >= script.steps.length - 1;
  if (isLast) {
    if (script.nextTutorial) {
      startTutorial(script.nextTutorial);
      return;
    }
    stopTutorial();
    return;
  }
  tutorialState.stepIndex = Math.min(script.steps.length - 1, tutorialState.stepIndex + 1);
  renderTutorialStep();
}

function stopTutorial() {
  tutorialState = { active: false, id: null, stepIndex: 0 };
  if (tutorialOverlay) {
    tutorialOverlay.classList.add('hidden');
  }
}

function startTutorial(id) {
  if (!tutorialScripts[id]) return;
  ensureTutorialOverlay();
  tutorialState = { active: true, id, stepIndex: 0 };
  renderTutorialStep();
}
