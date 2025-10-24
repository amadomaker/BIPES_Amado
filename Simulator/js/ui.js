const toolbarElement = document.getElementById('toolbar');
const propertiesContent = document.getElementById('properties-content');
const alertContainer = document.getElementById('alert-container');

let playPauseButton;
let clearButton;
let saveButton;
let loadButton;

let currentToolbarHandlers = {
  onPlayPause: null,
  onClear: null,
  onSave: null,
  onLoad: null,
};

let contextMenu;
let colorPickerPopover;
let fileInput;

const alertTimers = new Map();

export function initUI(handlers) {
  if (!toolbarElement) return;
  currentToolbarHandlers = { ...currentToolbarHandlers, ...handlers };
  renderToolbar();
  ensureGlobalListeners();
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

  toolbarElement.append(
    playPauseButton,
    clearButton,
    saveButton,
    loadButton,
  );
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
  window.addEventListener('resize', () => hideColorPicker());
}

export function setPlayState(isRunning) {
  if (!playPauseButton) return;
  playPauseButton.textContent = isRunning ? '⏸ Pause' : '▶ Play';
}

export function updatePropertiesPanel({ title, fields }) {
  if (!propertiesContent) return;
  if (!title && (!fields || fields.length === 0)) {
    propertiesContent.innerHTML = 'Selecione um componente ou fio para ver os detalhes.';
    return;
  }

  const fragment = document.createDocumentFragment();

  if (title) {
    const titleElement = document.createElement('div');
    titleElement.className = 'properties-title';
    titleElement.textContent = title;
    fragment.appendChild(titleElement);
  }

  if (fields && fields.length) {
    fields.forEach(({ label, value, control }) => {
      const field = document.createElement('div');
      field.className = 'properties-field';

      const labelSpan = document.createElement('span');
      labelSpan.textContent = label;

      field.append(labelSpan);

      if (control) {
        field.classList.add('properties-field-control');
        const controlElement = buildControl(control);
        field.append(controlElement);
      } else {
        const valueSpan = document.createElement('span');
        valueSpan.textContent = value;
        field.append(valueSpan);
      }

      fragment.appendChild(field);
    });
  }

  propertiesContent.innerHTML = '';
  propertiesContent.appendChild(fragment);
}

function buildControl(control) {
  switch (control.type) {
    case 'select': {
      const select = document.createElement('select');
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
    default:
      return document.createTextNode(control.value ?? '');
  }
}

export function clearPropertiesPanel() {
  updatePropertiesPanel({});
}

export function showComponentContextMenu(x, y, { onDelete } = {}) {
  displayContextMenu(x, y, [
    { label: 'Excluir componente', action: onDelete },
  ]);
}

export function showWireContextMenu(x, y, { onDelete, onChangeColor } = {}) {
  displayContextMenu(x, y, [
    { label: 'Mudar cor', action: onChangeColor },
    { label: 'Excluir conexão', action: onDelete },
  ]);
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

export function showColorPicker(x, y, { initialColor = '#00ff00', onSelect } = {}) {
  hideColorPicker();

  colorPickerPopover = document.createElement('div');
  colorPickerPopover.className = 'color-picker-popover';

  const label = document.createElement('label');
  label.textContent = 'Cor do fio';

  const input = document.createElement('input');
  input.type = 'color';
  input.value = initialColor;

  input.addEventListener('input', () => {
    onSelect?.(input.value);
  });

  colorPickerPopover.addEventListener('click', (event) => event.stopPropagation());

  const rect = document.body.getBoundingClientRect();
  const width = 220;
  const height = 60;
  const posX = Math.min(x, rect.right - width - 10);
  const posY = Math.min(y, rect.bottom - height - 10);

  colorPickerPopover.style.left = `${posX}px`;
  colorPickerPopover.style.top = `${posY}px`;

  colorPickerPopover.append(label, input);
  document.body.appendChild(colorPickerPopover);
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
