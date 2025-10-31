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

let currentToolbarHandlers = {
  onPlayPause: null,
  onClear: null,
  onSave: null,
  onLoad: null,
  onToggleSerialMonitor: null,
  onRotateComponent: null,
  onFlipComponent: null,
};

let contextMenu;
let colorPickerPopover;
let fileInput;

const alertTimers = new Map();
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
  });

  clearButton = createToolbarButton('🗑️ Limpar tudo', () => {
    currentToolbarHandlers.onClear?.();
  });

  saveButton = createToolbarButton('💾 Salvar (JSON)', () => {
    currentToolbarHandlers.onSave?.();
  });

  loadButton = createToolbarButton('📂 Carregar', () => {
    currentToolbarHandlers.onLoad?.();
  });

  monitorButton = createToolbarButton('🖥 Monitor Serial', () => {
    currentToolbarHandlers.onToggleSerialMonitor?.();
  });
  monitorButton.setAttribute('aria-pressed', 'false');

  rotateButton = createToolbarButton('⟳ Rotacionar', () => {
    currentToolbarHandlers.onRotateComponent?.();
  });
  rotateButton.disabled = true;
  rotateButton.title = 'Rotacionar componente selecionado';

  flipButton = createToolbarButton('⇆ Inverter', () => {
    currentToolbarHandlers.onFlipComponent?.();
  });
  flipButton.disabled = true;
  flipButton.title = 'Inverter componente selecionado';

  toolbarElement.append(
    playPauseButton,
    clearButton,
    saveButton,
    loadButton,
    monitorButton,
    rotateButton,
    flipButton,
  );

  setTransformControlsState({ canRotate: false, canFlip: false });
}

function createToolbarButton(label, handler) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.addEventListener('click', handler);
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
  const viewportHeight = window.innerHeight;
  let top = margin;

  if (anchor && typeof anchor === 'object') {
    const rectTop = Number(anchor.top) || 0;
    const rectHeight = Number(anchor.height) || 0;
    const desiredTop = rectTop + rectHeight / 2 - height / 2;
    if (!Number.isNaN(desiredTop)) {
      top = Math.max(margin, Math.min(desiredTop, viewportHeight - height - margin));
    }
  }

  const left = window.innerWidth - width - margin;

  propertiesPopover.style.left = `${Math.round(Math.max(margin, left))}px`;
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

export function showComponentContextMenu(x, y, { onDelete } = {}) {
  displayContextMenu(x, y, [
    { label: 'Excluir componente', action: onDelete },
  ]);
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
