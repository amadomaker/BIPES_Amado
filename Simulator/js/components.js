const BATTERY_VOLTAGES = ['3', '5', '9', '12'];
const AMADO_BOARD_VIEWBOX = { width: 1087, height: 859.9 };
const AMADO_BOARD_WIDTH = 420;
const AMADO_BOARD_HEIGHT = AMADO_BOARD_WIDTH * (AMADO_BOARD_VIEWBOX.height / AMADO_BOARD_VIEWBOX.width);
const AMADO_BOARD_SCALE_A = 4.25635687732342;
const AMADO_BOARD_SCALE_B = 133.5274349442379;
const AMADO_BOARD_LEFT_X = 289.16;
const AMADO_BOARD_RIGHT_X = 765.28;
const AMADO_BOARD_RIGHT_TOP_X = 700.15;

function createBatteryShell({ voltage, preview = false } = {}) {
  const shell = document.createElement('div');
  shell.className = `battery-shell${preview ? ' preview' : ''}`;

  const positiveTerminal = document.createElement('div');
  positiveTerminal.className = 'battery-terminal battery-terminal-positive';
  positiveTerminal.dataset.pinSelector = 'positive';

  const body = document.createElement('div');
  body.className = 'battery-body';
  body.textContent = '';

  const negativeTerminal = document.createElement('div');
  negativeTerminal.className = 'battery-terminal battery-terminal-negative';
  negativeTerminal.dataset.pinSelector = 'negative';

  const voltageLabel = document.createElement('div');
  voltageLabel.className = 'battery-voltage';
  voltageLabel.textContent = `${voltage}V`;

  shell.append(positiveTerminal, body, negativeTerminal, voltageLabel);

  return {
    shell,
    voltageLabel,
    terminals: { positiveTerminal, negativeTerminal },
  };
}

function createWokwiPreview(elementTag, props = {}) {
  const wrapper = document.createElement('div');
  wrapper.className = 'preview-scale';
  const element = document.createElement(elementTag);
  Object.entries(props).forEach(([key, value]) => element.setAttribute(key, value));
  wrapper.appendChild(element);
  return wrapper;
}

function classifyPinType(name) {
  if (/GND/i.test(name)) return 'ground';
  if (/3V|VIN|5V/i.test(name)) return 'power';
  return 'signal';
}

const esp32PinLayout = [
  { name: 'EN', side: 'left', y: 24.0 },
  { name: 'VP', side: 'left', y: 34.0 },
  { name: 'VN', side: 'left', y: 44.0 },
  { name: 'D34', side: 'left', y: 53.1 },
  { name: 'D35', side: 'left', y: 62.9 },
  { name: 'D32', side: 'left', y: 72.2 },
  { name: 'D33', side: 'left', y: 81.7 },
  { name: 'D25', side: 'left', y: 91.3 },
  { name: 'D26', side: 'left', y: 101.0 },
  { name: 'D27', side: 'left', y: 110.8 },
  { name: 'D14', side: 'left', y: 120.0 },
  { name: 'D12', side: 'left', y: 130.4 },
  { name: 'D13', side: 'left', y: 139.5 },
  { name: 'GND.2', side: 'left', y: 149.0 },
  { name: 'VIN', side: 'left', y: 158.5 },
  { name: 'D23', side: 'right-top', y: 24.0 },
  { name: 'D22', side: 'right', y: 34.0 },
  { name: 'TX0', side: 'right', y: 44.0 },
  { name: 'RX0', side: 'right', y: 53.1 },
  { name: 'D21', side: 'right', y: 62.9 },
  { name: 'D19', side: 'right', y: 72.2 },
  { name: 'D18', side: 'right', y: 81.7 },
  { name: 'D5', side: 'right', y: 91.3 },
  { name: 'TX2', side: 'right', y: 101.0 },
  { name: 'RX2', side: 'right', y: 110.8 },
  { name: 'D4', side: 'right', y: 120.0 },
  { name: 'D2', side: 'right', y: 130.4 },
  { name: 'D15', side: 'right', y: 139.5 },
  { name: 'GND.1', side: 'right', y: 149.0 },
  { name: '3V3', side: 'right', y: 158.5 },
];

const amadoBoardCoordinates = {
  EN: { xPercent: 26.6, yPercent: 27.4 },
  VP: { xPercent: 26.6, yPercent: 32.4 },
  VN: { xPercent: 26.6, yPercent: 37.3 },
  D34: { xPercent: 26.6, yPercent: 41.8 },
  D35: { xPercent: 70.4, yPercent: 101 },
  D32: { xPercent: 26.6, yPercent: 51.3 },
  D33: { xPercent: 26.6, yPercent: 55.9 },
  D25: { xPercent: 26.6, yPercent: 60.7 },
  D23: { xPercent: 64.4, yPercent: 27.4 },
  D22: { xPercent: 70.4, yPercent: 32.4 },
  TX0: { xPercent: 70.4, yPercent: 37.3 },
  RX0: { xPercent: 70.4, yPercent: 41.8 },
  D21: { xPercent: 70.4, yPercent: 46.7 },
  // Continue adicionando os demais pinos seguindo este padrão...
};

export const amadoBoardPins = esp32PinLayout.map((pin, index) => {
  const manualPosition = amadoBoardCoordinates[pin.name];

  if (manualPosition) {
    return {
      name: pin.name,
      type: classifyPinType(pin.name),
      pinIndex: index,
      position: manualPosition,
    };
  }

  const boardX =
    pin.side === 'left'
      ? AMADO_BOARD_LEFT_X
      : pin.side === 'right'
      ? AMADO_BOARD_RIGHT_X
      : AMADO_BOARD_RIGHT_TOP_X;
  const boardY = AMADO_BOARD_SCALE_A * pin.y + AMADO_BOARD_SCALE_B;

  return {
    name: pin.name,
    type: classifyPinType(pin.name),
    pinIndex: index,
    position: {
      xPercent: (boardX / AMADO_BOARD_VIEWBOX.width) * 100,
      yPercent: (boardY / AMADO_BOARD_VIEWBOX.height) * 100,
    },
  };
});

function createAmadoBoardElement({ preview = false } = {}) {
  const container = document.createElement('div');
  container.className = `amado-board${preview ? ' amado-board-preview' : ''}`;
  container.style.width = `${preview ? AMADO_BOARD_WIDTH * 0.45 : AMADO_BOARD_WIDTH}px`;
  container.style.height = `${preview ? AMADO_BOARD_HEIGHT * 0.45 : AMADO_BOARD_HEIGHT}px`;
  container.dataset.board = 'amado';

  const image = document.createElement('img');
  image.src = 'css/assets/amadoboard-legendas.svg';
  image.alt = 'Placa Amado ESP32';
  container.appendChild(image);

  if (preview) {
    return container;
  }

  return {
    element: container,
    applyProps: () => {},
  };
}

export const componentGroups = [
  { id: 'sources', name: 'Fontes' },
  { id: 'passives', name: 'Passivos' },
  { id: 'active', name: 'Ativos' },
  { id: 'microcontroller', name: 'Microcontrolador' },
];

export const availableComponents = [
  {
    id: 'battery',
    name: 'Bateria DC',
    element: null,
    description: 'Fonte contínua com tensão ajustável.',
    group: 'sources',
    defaultProps: { voltage: '9' },
    pins: [
      { name: 'VCC (+)', type: 'power', selector: '.battery-terminal-positive' },
      { name: 'GND (-)', type: 'ground', selector: '.battery-terminal-negative' },
    ],
    getLabel: (props) => `Bateria DC (${props.voltage ?? '9'}V)`,
    createInstance: ({ props }) => {
      const { shell, voltageLabel } = createBatteryShell({ voltage: props.voltage ?? '9' });
      return {
        element: shell,
        applyProps: (nextProps) => {
          const value = nextProps.voltage ?? '9';
          voltageLabel.textContent = `${value}V`;
        },
      };
    },
    createPreview: () => {
      const { shell } = createBatteryShell({ voltage: '9', preview: true });
      return shell;
    },
    propertyControls: [
      {
        label: 'Voltagem',
        formatValue: (value) => `${value}V`,
        control: {
          type: 'select',
          options: BATTERY_VOLTAGES.map((value) => ({
            label: `${value}V`,
            value,
          })),
          propKey: 'voltage',
        },
      },
    ],
  },
  {
    id: 'amado-board',
    name: 'Placa Amado ESP32',
    element: null,
    description: 'Placa personalizada baseada no ESP32 DevKit.',
    group: 'microcontroller',
    defaultProps: {},
    getLabel: () => 'Amado ESP32',
    pins: amadoBoardPins.map((pin) => ({
      name: pin.name,
      type: pin.type,
      position: pin.position,
      pinIndex: pin.pinIndex,
    })),
    createInstance: () => createAmadoBoardElement({ preview: false }),
    createPreview: () => createAmadoBoardElement({ preview: true }),
  },
  {
    id: 'led',
    name: 'LED',
    element: 'wokwi-led',
    description: 'Diodo emissor de luz com cores configuráveis.',
    group: 'active',
    defaultProps: { color: 'red' },
    createPreview: () => createWokwiPreview('wokwi-led', { color: 'red' }),
  },
  {
    id: 'resistor',
    name: 'Resistor',
    element: 'wokwi-resistor',
    description: 'Componente passivo para limitar corrente.',
    group: 'passives',
    defaultProps: { value: '220' },
    createPreview: () => createWokwiPreview('wokwi-resistor', { value: '220' }),
  },
  {
    id: 'pushbutton',
    name: 'Botão',
    element: 'wokwi-pushbutton',
    description: 'Chave momentânea de 4 terminais.',
    group: 'active',
    defaultProps: { color: 'green' },
    createPreview: () => createWokwiPreview('wokwi-pushbutton', { color: 'green' }),
  },
  {
    id: 'potentiometer',
    name: 'Potenciômetro',
    element: 'wokwi-potentiometer',
    description: 'Resistor variável de três terminais.',
    group: 'passives',
    defaultProps: { value: '50' },
    createPreview: () => createWokwiPreview('wokwi-potentiometer', { value: '50' }),
  },
  {
    id: 'esp32',
    name: 'ESP32',
    element: 'wokwi-esp32-devkit-v1',
    description: 'Placa de desenvolvimento ESP32 com Wi-Fi/Bluetooth.',
    group: 'microcontroller',
    defaultProps: {},
    createPreview: () => createWokwiPreview('wokwi-esp32-devkit-v1', {}),
  },
];

export function getComponentById(id) {
  return availableComponents.find((component) => component.id === id) ?? null;
}
