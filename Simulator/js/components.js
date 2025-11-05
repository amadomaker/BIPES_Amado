const BATTERY_VOLTAGES = ['3', '5', '9', '12'];
const AMADO_BOARD_VIEWBOX = { width: 658.51, height: 761.07 };
const AMADO_BOARD_WIDTH = 192;
const AMADO_BOARD_HEIGHT = AMADO_BOARD_WIDTH * (AMADO_BOARD_VIEWBOX.height / AMADO_BOARD_VIEWBOX.width);
const AMADO_BOARD_SCALE_A = 4.25635687732342;
const AMADO_BOARD_SCALE_B = 85.7174349442379;
const AMADO_BOARD_LEFT_X = 109.56;
const AMADO_BOARD_RIGHT_X = 585.68;
const AMADO_BOARD_RIGHT_TOP_X = 520.55;

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

function createFixedBattery9vElement({ preview = false } = {}) {
  const shell = document.createElement('div');
  shell.className = `battery-9v-fixed${preview ? ' preview' : ''}`;
  shell.title = 'Bateria 9V';
  const baseWidth = preview ? 85 : 170;
  shell.style.width = `${baseWidth}px`;
  shell.style.height = `${(baseWidth * 1594) / 1000}px`;

  const image = document.createElement('img');
  image.src = 'css/components/bateria_9v.svg';
  image.alt = 'Bateria 9V';
  image.draggable = false;

  const positiveTerminal = document.createElement('div');
  positiveTerminal.className = 'battery-terminal battery-terminal-positive';
  positiveTerminal.dataset.pinSelector = 'positive';
  positiveTerminal.style.left = '99.1%';
  positiveTerminal.style.top = '7.2%';

  const negativeTerminal = document.createElement('div');
  negativeTerminal.className = 'battery-terminal battery-terminal-negative';
  negativeTerminal.dataset.pinSelector = 'negative';
  negativeTerminal.style.left = '99.1%';
  negativeTerminal.style.top = '11.8%';

  shell.append(image, positiveTerminal, negativeTerminal);

  return {
    element: shell,
    applyProps: () => {},
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

function createDcMotorElement({ props } = {}) {
  const wrapper = document.createElement('div');
  wrapper.className = 'dc-motor-shell';

  const image = document.createElement('img');
  image.src = 'css/components/motor_dc_reducao.svg';
  image.alt = props?.label ?? 'Motor DC com redução';
  image.draggable = false;
  image.className = 'dc-motor-image';

  const rotor = document.createElement('div');
  rotor.className = 'dc-motor-rotor';
  const spinner = document.createElement('div');
  spinner.className = 'dc-motor-spinner';
  rotor.appendChild(spinner);

  const speedLabel = document.createElement('span');
  speedLabel.className = 'dc-motor-speed';
  speedLabel.textContent = '0 RPM';

  wrapper.append(image, rotor, speedLabel);
  wrapper.__motorVisual = { rotor, spinner, speedLabel };

  const applyProps = (nextProps = {}) => {
    image.alt = nextProps.label ?? 'Motor DC com redução';
    wrapper.title = image.alt;
  };

  applyProps(props ?? {});

  return {
    element: wrapper,
    applyProps,
  };
}

function parseResistanceValue(raw) {
  if (raw === null || typeof raw === 'undefined') return NaN;
  if (typeof raw === 'number') return raw;
  const normalized = String(raw).trim().toLowerCase();
  if (!normalized) return NaN;

  const match = normalized.match(/^([\d.,]+)\s*([a-zµΩ]*)$/i);
  if (!match) {
    const fallback = Number(normalized.replace(',', '.'));
    return Number.isFinite(fallback) ? fallback : NaN;
  }

  const magnitude = Number.parseFloat(match[1].replace(',', '.'));
  if (!Number.isFinite(magnitude)) return NaN;

  const unitRaw = match[2] ?? '';
  const cleanedUnit = unitRaw
    .toLowerCase()
    .replace(/ω|Ω/g, 'ohm')
    .replace(/⁻/g, '-')
    .trim();

  const MULTIPLIERS = new Map([
    ['', 1],
    ['ohm', 1],
    ['ohms', 1],
    ['kohm', 1_000],
    ['k', 1_000],
    ['kiloohm', 1_000],
    ['kilo', 1_000],
    ['mohm', 1_000_000],
    ['megaohm', 1_000_000],
    ['meg', 1_000_000],
    ['m', 1_000_000],
    ['gohm', 1_000_000_000],
    ['g', 1_000_000_000],
    ['µohm', 1e-6],
    ['microohm', 1e-6],
    ['µ', 1e-6],
    ['u', 1e-6],
  ]);

  const multiplier = MULTIPLIERS.get(cleanedUnit) ?? 1;
  return magnitude * multiplier;
}

const PHOTORESISTOR_MIN_OHMS = 500;
const PHOTORESISTOR_MAX_OHMS = 1_000_000;

function photoresistorLevelToOhms(level) {
  const numeric = Math.max(0, Math.min(100, Number(level) || 0));
  const span = PHOTORESISTOR_MAX_OHMS - PHOTORESISTOR_MIN_OHMS;
  const ohms = PHOTORESISTOR_MAX_OHMS - (span * numeric) / 100;
  return Math.round(ohms);
}

function photoresistorOhmsToLevel(ohms) {
  const numeric = parseResistanceValue(ohms);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 50;
  }
  const clamped = Math.min(Math.max(numeric, PHOTORESISTOR_MIN_OHMS), PHOTORESISTOR_MAX_OHMS);
  const span = PHOTORESISTOR_MAX_OHMS - PHOTORESISTOR_MIN_OHMS;
  if (span === 0) return 50;
  const ratio = (PHOTORESISTOR_MAX_OHMS - clamped) / span;
  return Math.round(ratio * 100);
}

function createPhotoresistorInstance({ props } = {}) {
  const sensor = document.createElement('wokwi-photoresistor-sensor');

  const controls = document.createElement('div');
  controls.className = 'photoresistor-controls component-embedded-control';
  controls.style.position = 'absolute';
  controls.style.display = 'none';

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '0';
  slider.max = '100';
  slider.step = '1';
  slider.className = 'photoresistor-slider';

  const valueLabel = document.createElement('span');
  valueLabel.className = 'photoresistor-value';

  controls.append(slider, valueLabel);
  sensor.__controls = controls;
  sensor.__sensorElement = sensor;

  let currentLevel = 50;
  let currentOhms = photoresistorLevelToOhms(currentLevel);

  const updateDisplay = () => {
    slider.value = String(currentLevel);
    valueLabel.textContent = `${currentLevel}%`;
    sensor.setAttribute('resistance', String(currentOhms));
    sensor.setAttribute('ohms', String(currentOhms));
    sensor.resistance = currentOhms;

    const wokwiValue = Math.round((currentLevel / 100) * 4095);
    sensor.setAttribute('value', String(wokwiValue));
    if ('value' in sensor) {
      sensor.value = wokwiValue;
    }
  };

  sensor.__setBrightness = (level, { silent = false } = {}) => {
    const numeric = Math.max(0, Math.min(100, Math.round(Number(level) || 0)));
    currentLevel = numeric;
    currentOhms = photoresistorLevelToOhms(numeric);
    updateDisplay();
    if (!silent) {
      sensor.__onBrightnessChange?.(currentLevel, {
        source: 'external',
        ohms: currentOhms,
      });
    }
  };

  slider.addEventListener('input', () => {
    const level = Math.max(0, Math.min(100, Math.round(Number(slider.value) || 0)));
    currentLevel = level;
    currentOhms = photoresistorLevelToOhms(level);
    updateDisplay();
    sensor.__onBrightnessChange?.(currentLevel, {
      source: 'slider',
      ohms: currentOhms,
    });
  });

  sensor.__onBrightnessChange = null;

  const initialOhms =
    props?.resistance ??
    props?.value ??
    props?.ohms ??
    photoresistorLevelToOhms(currentLevel);
  const initialLevel = photoresistorOhmsToLevel(initialOhms);
  currentLevel = initialLevel;
  currentOhms = photoresistorLevelToOhms(initialLevel);
  updateDisplay();

  return {
    element: sensor,
    applyProps: (nextProps = {}) => {
      let inferredLevel = currentLevel;
      if (typeof nextProps?.value !== 'undefined') {
        const numericValue = Number(nextProps.value);
        if (Number.isFinite(numericValue)) {
          inferredLevel = Math.max(0, Math.min(100, Math.round((numericValue / 4095) * 100)));
        }
      }
      const nextOhms =
        nextProps?.resistance ??
        nextProps?.ohms ??
        photoresistorLevelToOhms(inferredLevel);
      const level = photoresistorOhmsToLevel(nextOhms);
      sensor.__setBrightness?.(level, { silent: true });
    },
  };
}

function createMultimeterElement({ props } = {}) {
  const shell = document.createElement('div');
  shell.className = 'multimeter-shell';

  const header = document.createElement('div');
  header.className = 'multimeter-header';
  header.textContent = 'Multímetro';

  const display = document.createElement('div');
  display.className = 'multimeter-display';
  display.textContent = '---';

  const modeLabel = document.createElement('div');
  modeLabel.className = 'multimeter-mode';
  modeLabel.textContent = (props?.mode ?? 'tensão').toUpperCase();

  const probes = document.createElement('div');
  probes.className = 'multimeter-probes';
  const probePos = document.createElement('div');
  probePos.className = 'multimeter-probe probe-positive';
  const probeNeg = document.createElement('div');
  probeNeg.className = 'multimeter-probe probe-negative';
  probes.append(probePos, probeNeg);

  shell.append(header, display, modeLabel, probes);
  shell.__displayElement = display;
  shell.__modeElement = modeLabel;

  const applyProps = (nextProps = {}) => {
    const mode = (nextProps.mode ?? 'tensão').toUpperCase();
    modeLabel.textContent = mode;
  };

  applyProps(props ?? {});

  return {
    element: shell,
    applyProps,
  };
}

function formatResistanceValue(rawValue) {
  if (rawValue === undefined || rawValue === null) {
    return '';
  }

  const numericValue = Number(rawValue);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return `${rawValue}Ω`;
  }

  if (numericValue >= 1_000_000) {
    return `${(numericValue / 1_000_000).toFixed(numericValue % 1_000_000 === 0 ? 0 : 2)}MΩ`;
  }
  if (numericValue >= 1_000) {
    return `${(numericValue / 1_000).toFixed(numericValue % 1_000 === 0 ? 0 : 2)}kΩ`;
  }
  return `${numericValue}Ω`;
}

const LED_COLOR_VARIANTS = {
  red: {
    label: 'Vermelho',
    forwardVoltageMin: 1.8,
    forwardVoltageMax: 2.2,
    maxCurrent: 0.02,
  },
  green: {
    label: 'Verde',
    forwardVoltageMin: 2.0,
    forwardVoltageMax: 3.0,
    maxCurrent: 0.02,
  },
  blue: {
    label: 'Azul',
    forwardVoltageMin: 2.8,
    forwardVoltageMax: 3.5,
    maxCurrent: 0.02,
  },
  yellow: {
    label: 'Amarelo',
    forwardVoltageMin: 2.0,
    forwardVoltageMax: 2.4,
    maxCurrent: 0.02,
  },
  white: {
    label: 'Branco',
    forwardVoltageMin: 3.0,
    forwardVoltageMax: 3.4,
    maxCurrent: 0.02,
  },
};

const LED_COLOR_SELECT_OPTIONS = Object.entries(LED_COLOR_VARIANTS).map(
  ([value, info]) => ({
    label: `${info.label} (${info.forwardVoltageMin.toFixed(1)}-${info.forwardVoltageMax.toFixed(1)} V · ${(info.maxCurrent * 1000).toFixed(0)} mA máx)`,
    value,
  }),
);

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
  EN: { xPercent: 16.6348, yPercent: 24.6761 },
  VP: { xPercent: 16.6348, yPercent: 30.3254 },
  VN: { xPercent: 16.6348, yPercent: 35.8617 },
  D34: { xPercent: 16.6348, yPercent: 40.9461 },
  D35: { xPercent: 88.9353, yPercent: 107.8336 },
  D32: { xPercent: 16.6348, yPercent: 51.6797 },
  D33: { xPercent: 16.6348, yPercent: 56.877 },
  D25: { xPercent: 16.6348, yPercent: 62.3004 },
  D23: { xPercent: 79.0311, yPercent: 24.6761 },
  D22: { xPercent: 88.9353, yPercent: 30.3254 },
  TX0: { xPercent: 88.9353, yPercent: 35.8617 },
  RX0: { xPercent: 88.9353, yPercent: 40.9461 },
  D21: { xPercent: 88.9353, yPercent: 46.4824 },
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
  { id: 'controls', name: 'Controles' },
  { id: 'sensors', name: 'Sensores' },
  { id: 'actuators', name: 'Atuadores' },
  { id: 'outputs', name: 'Saídas' },
  { id: 'active', name: 'Ativos' },
  { id: 'microcontroller', name: 'Microcontrolador' },
  { id: 'tools', name: 'Instrumentos' },
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
    id: 'battery-9v',
    name: 'Bateria 9V (SVG)',
    element: null,
    description: 'Bateria de 9V com visual realistico e tensão fixa.',
    group: 'sources',
    defaultProps: { voltage: '9' },
    pins: [
      { name: 'VCC (+)', type: 'power', selector: '.battery-terminal-positive' },
      { name: 'GND (-)', type: 'ground', selector: '.battery-terminal-negative' },
    ],
    getLabel: () => 'Bateria 9V',
    createInstance: () => createFixedBattery9vElement({ preview: false }),
    createPreview: () => createFixedBattery9vElement({ preview: true }).element,
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
    getLabel: (props = {}) => {
      const info = getLedColorInfo(props.color);
      return info ? `LED (${info.label})` : 'LED';
    },
    propertyControls: [
      {
        label: 'Cor',
        formatValue: (value) => {
          const info = getLedColorInfo(value);
          if (!info) return String(value ?? '');
          const voltageText = `${info.forwardVoltageMin.toFixed(1)}-${info.forwardVoltageMax.toFixed(1)} V`;
          const currentText = `${(info.maxCurrent * 1000).toFixed(0)} mA máx`;
          return `${info.label} (${voltageText} · ${currentText})`;
        },
        control: {
          type: 'select',
          options: LED_COLOR_SELECT_OPTIONS,
          propKey: 'color',
        },
      },
    ],
    createPreview: () => createWokwiPreview('wokwi-led', { color: 'red' }),
  },
  {
    id: 'multimeter',
    name: 'Multímetro',
    element: null,
    description: 'Instrumento para leitura de tensão entre dois pontos.',
    group: 'tools',
    defaultProps: { mode: 'tensão' },
    pins: [
      { name: 'V+', type: 'signal', position: { xPercent: 25, yPercent: 100 } },
      { name: 'V-', type: 'signal', position: { xPercent: 75, yPercent: 100 } },
    ],
    createInstance: ({ props }) => createMultimeterElement({ props }),
    createPreview: () => {
      const preview = createMultimeterElement({ props: { mode: 'tensão' } });
      preview.element.classList.add('multimeter-preview');
      return preview.element;
    },
    propertyControls: [
      {
        label: 'Modo',
        formatValue: (value) => {
          const normalized = String(value ?? '').toLowerCase();
          if (normalized === 'resistência') return 'Resistência';
          if (normalized === 'corrente') return 'Corrente';
          return 'Tensão';
        },
        control: {
          type: 'select',
          propKey: 'mode',
          options: [
            { label: 'Tensão (V)', value: 'tensão' },
            { label: 'Resistência (Ω)', value: 'resistência' },
            { label: 'Corrente (A)', value: 'corrente' },
          ],
        },
      },
    ],
  },
  {
    id: 'resistor',
    name: 'Resistor',
    element: 'wokwi-resistor',
    description: 'Componente passivo para limitar corrente.',
    group: 'passives',
    defaultProps: { value: '220' },
    createPreview: () => createWokwiPreview('wokwi-resistor', { value: '220' }),
    propertyControls: [
      {
        label: 'Resistência',
        formatValue: (value) => formatResistanceValue(value),
        control: {
          type: 'number',
          min: 1,
          step: 1,
          propKey: 'value',
        },
      },
    ],
  },
  {
    id: 'dc-motor',
    name: 'Motor DC',
    element: null,
    description: 'Motor DC com dois terminais de alimentação.',
    group: 'actuators',
    defaultProps: {
      resistance: '30',
      label: 'Motor DC 3-6V',
    },
    pins: [
      { name: 'V+', type: 'power', position: { xPercent: 9, yPercent: 32 } },
      { name: 'V-', type: 'ground', position: { xPercent: 9, yPercent: 68 } },
    ],
    createInstance: ({ props }) => createDcMotorElement({ props }),
    createPreview: () => createDcMotorElement({ props: { label: 'Motor DC' } }).element,
    propertyControls: [
      {
        label: 'Resistência interna',
        formatValue: (value) => formatResistanceValue(value),
        control: {
          type: 'text',
          propKey: 'resistance',
          placeholder: '30Ω',
        },
      },
      {
        label: 'Rótulo',
        control: {
          type: 'text',
          propKey: 'label',
          placeholder: 'Motor DC',
        },
      },
    ],
  },
  {
    id: 'switch',
    name: 'Chave ON/OFF',
    element: 'wokwi-slide-switch',
    description: 'Interruptor simples de dois terminais.',
    group: 'controls',
    defaultProps: { initialState: 'off' },
    createInstance: ({ props }) => {
      const element = document.createElement('wokwi-slide-switch');
      const applyProps = (nextProps = {}) => {
        const state = String(nextProps.initialState ?? 'off').toLowerCase();
        if (state === 'on') {
          element.setAttribute('checked', '');
          if ('checked' in element) {
            element.checked = true;
          }
        } else {
          element.removeAttribute('checked');
          if ('checked' in element) {
            element.checked = false;
          }
        }
      };
      applyProps(props);
      return { element, applyProps };
    },
    createPreview: () => createWokwiPreview('wokwi-slide-switch', {}),
    propertyControls: [
      {
        label: 'Estado inicial',
        formatValue: (value) => (String(value).toLowerCase() === 'on' ? 'Ligado' : 'Desligado'),
        control: {
          type: 'select',
          propKey: 'initialState',
          options: [
            { label: 'Desligado', value: 'off' },
            { label: 'Ligado', value: 'on' },
          ],
        },
      },
    ],
  },
  {
    id: 'photoresistor',
    name: 'Sensor LDR',
    element: null,
    description: 'Resistor dependente de luz.',
    group: 'sensors',
    defaultProps: { resistance: '10k' },
    createInstance: ({ props }) => createPhotoresistorInstance({ props }),
    createPreview: () => createWokwiPreview('wokwi-photoresistor-sensor', {}),
  },
  {
    id: 'buzzer',
    name: 'Buzzer',
    element: 'wokwi-buzzer',
    description: 'Transdutor piezoelétrico para alertas sonoros.',
    group: 'outputs',
    defaultProps: {},
    createPreview: () => createWokwiPreview('wokwi-buzzer', {}),
  },
  {
    id: 'ir-receiver',
    name: 'Sensor IR',
    element: 'wokwi-ir-receiver',
    description: 'Receptor infravermelho com saída digital.',
    group: 'sensors',
    defaultProps: { state: 'low' },
    createPreview: () => createWokwiPreview('wokwi-ir-receiver', {}),
    propertyControls: [
      {
        label: 'Saída',
        formatValue: (value) => (String(value).toLowerCase() === 'high' ? 'Alto (1)' : 'Baixo (0)'),
        control: {
          type: 'select',
          propKey: 'state',
          options: [
            { label: 'Baixo (0)', value: 'low' },
            { label: 'Alto (1)', value: 'high' },
          ],
          dispatchInteractionEvent: true,
          interactionEventDetail: { source: 'component-property' },
        },
      },
    ],
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
    defaultProps: { value: '50', resistance: '10k' },
    getLabel: (props = {}) => {
      const resistance = props.resistance ? formatResistanceValue(props.resistance) : null;
      return resistance ? `Potenciômetro (${resistance})` : 'Potenciômetro';
    },
    propertyControls: [
      {
        label: 'Resistência',
        formatValue: (value) => formatResistanceValue(value),
        control: {
          type: 'text',
          propKey: 'resistance',
          placeholder: 'Ex.: 10k',
        },
      },
    ],
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

export function getLedColorInfo(color) {
  if (!color) return null;
  const info = LED_COLOR_VARIANTS[color];
  if (!info) return null;
  return {
    ...info,
    forwardVoltage: `${info.forwardVoltageMin.toFixed(1)}-${info.forwardVoltageMax.toFixed(1)} V`,
    maxCurrentLabel: `${(info.maxCurrent * 1000).toFixed(0)} mA`,
  };
}
