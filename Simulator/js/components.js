const BATTERY_VOLTAGES = ['3', '5', '9', '12'];
const AMADO_BOARD_VIEWBOX = { width: 658.51, height: 761.07 };
const AMADO_BOARD_WIDTH = 192;
const AMADO_BOARD_HEIGHT = AMADO_BOARD_WIDTH * (AMADO_BOARD_VIEWBOX.height / AMADO_BOARD_VIEWBOX.width);
const AMADO_BOARD_SCALE_A = 4.25635687732342;
const AMADO_BOARD_SCALE_B = 85.7174349442379;
const AMADO_BOARD_LEFT_X = 109.56;
const AMADO_BOARD_RIGHT_X = 585.68;
const AMADO_BOARD_RIGHT_TOP_X = 520.55;

const PROTOBOARD_HALF_VIEWBOX = { x: 747.5, y: 257.5, width: 505, height: 650 };
const PROTOBOARD_HALF_BASE_WIDTH = 320;
const PROTOBOARD_HALF_ASPECT_RATIO = PROTOBOARD_HALF_VIEWBOX.height / PROTOBOARD_HALF_VIEWBOX.width;
const PROTOBOARD_HALF_LAYOUT = {
  rows: 30,
  rowStartY: 367.2,
  rowPitch: 15,
  columns: [
    { prefix: '+L', type: 'power', x: 855.3 },
    { prefix: '-L', type: 'ground', x: 870.3 },
    { prefix: 'A', type: 'signal', x: 915.3 },
    { prefix: 'B', type: 'signal', x: 930.3 },
    { prefix: 'C', type: 'signal', x: 945.3 },
    { prefix: 'D', type: 'signal', x: 960.3 },
    { prefix: 'E', type: 'signal', x: 975.3 },
    { prefix: 'F', type: 'signal', x: 1020.3 },
    { prefix: 'G', type: 'signal', x: 1035.3 },
    { prefix: 'H', type: 'signal', x: 1050.3 },
    { prefix: 'I', type: 'signal', x: 1065.3 },
    { prefix: 'J', type: 'signal', x: 1080.3 },
    { prefix: '+R', type: 'power', x: 1125.3 },
    { prefix: '-R', type: 'ground', x: 1140.3 },
  ],
};

function toProtoboardPercent(x, y) {
  const xOffsetPercent = 0.6;
  const yOffsetPercent = -0.35;
  return {
    xPercent:
      ((x - PROTOBOARD_HALF_VIEWBOX.x) / PROTOBOARD_HALF_VIEWBOX.width) * 100 +
      xOffsetPercent,
    yPercent:
      ((y - PROTOBOARD_HALF_VIEWBOX.y) / PROTOBOARD_HALF_VIEWBOX.height) * 100 +
      yOffsetPercent,
  };
}

function generateProtoboardPins() {
  const pins = [];
  const { rows, rowStartY, rowPitch, columns } = PROTOBOARD_HALF_LAYOUT;
  const columnCount = columns.length;

  for (let row = 1; row <= rows; row += 1) {
    const y = rowStartY + (row - 1) * rowPitch;
    columns.forEach((column, columnIndex) => {
      pins.push({
        name: `${column.prefix}${row}`,
        type: column.type,
        position: toProtoboardPercent(column.x, y),
        pinIndex: (row - 1) * columnCount + columnIndex,
      });
    });
  }

  return pins;
}

const PROTOBOARD_HALF_PINS = generateProtoboardPins();

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
  const baseWidth = preview ? 85 : 90;
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

function clampCellCount(raw) {
  const numeric = Number(raw);
  if (!Number.isFinite(numeric)) return 1;
  return Math.max(1, Math.min(4, Math.round(numeric)));
}

function createAaaBatteryPackElement({ props, preview = false } = {}) {
  const shell = document.createElement('div');
  shell.className = `battery-aaa-pack${preview ? ' preview' : ''}`;
  shell.title = 'Pacote de pilhas AAA';

  const positiveTerminal = document.createElement('div');
  positiveTerminal.className = 'battery-aaa-pack-terminal battery-aaa-pack-terminal-positive';
  positiveTerminal.dataset.pinSelector = 'positive';

  const negativeTerminal = document.createElement('div');
  negativeTerminal.className = 'battery-aaa-pack-terminal battery-aaa-pack-terminal-negative';
  negativeTerminal.dataset.pinSelector = 'negative';

  const cellsWrapper = document.createElement('div');
  cellsWrapper.className = 'battery-aaa-pack-cells';

  shell.append(positiveTerminal, negativeTerminal, cellsWrapper);

  const renderCells = (count, cellWidth) => {
    cellsWrapper.innerHTML = '';
    for (let index = 0; index < count; index += 1) {
      const cell = document.createElement('div');
      cell.className = 'battery-aaa-pack-cell';
      cell.style.width = `${cellWidth}px`;
      const labelSpan = document.createElement('span');
      labelSpan.className = 'battery-aaa-pack-cell-label';
      labelSpan.textContent = 'AA 1.5V';
      cell.appendChild(labelSpan);
      cellsWrapper.appendChild(cell);
    }
    cellsWrapper.dataset.count = String(count);
  };

  const applyProps = (nextProps = {}) => {
    const count = clampCellCount(nextProps.cells ?? props?.cells);
    const voltageTotal = count * 1.5;
    const cellWidth = 44;
    const cellGap = 4;
    const framePadding = 16;
    const innerWidth = count * cellWidth + (count - 1) * cellGap;
    const totalWidth = innerWidth + framePadding;
    const totalHeight = 140;
    const terminalSpacing = 14; // distância fixa entre os terminais

    shell.style.width = `${totalWidth}px`;
    shell.style.height = `${totalHeight}px`;
    shell.dataset.cells = String(count);
    shell.title = `Pacote AAA (${count} × 1,5V)`;

    const centerShift = 5;
    positiveTerminal.style.left = `calc(50% - ${centerShift}px + ${terminalSpacing / 2}px)`;
    negativeTerminal.style.left = `calc(50% - ${centerShift}px - ${terminalSpacing / 2}px)`;
    positiveTerminal.style.top = '-8px';
    negativeTerminal.style.top = '-8px';

    shell.style.setProperty('--cells', String(count));
    shell.style.setProperty('--cell-gap', `${cellGap}px`);
    cellsWrapper.style.width = `${innerWidth}px`;
    cellsWrapper.style.margin = '0 auto';
    renderCells(count, cellWidth);

    if (props) {
      props.cells = String(count);
      props.voltage = voltageTotal.toFixed(2).replace(/\.?0+$/, '');
    }
  };

  applyProps(props ?? {});

  return {
    element: shell,
    applyProps,
  };
}

function createProtoboardElement({ preview = false } = {}) {
  const container = document.createElement('div');
  container.className = `protoboard-shell${preview ? ' protoboard-preview' : ''}`;
  const width = preview ? PROTOBOARD_HALF_BASE_WIDTH * 0.45 : PROTOBOARD_HALF_BASE_WIDTH;
  container.style.width = `${width}px`;
  container.style.height = `${width * PROTOBOARD_HALF_ASPECT_RATIO}px`;

  const image = document.createElement('img');
  image.src = 'css/components/protoboard_svg.svg';
  image.alt = 'Protoboard half-size (400 pontos)';
  image.draggable = false;

  container.appendChild(image);

  return {
    element: container,
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

function createDcMotorElement({ props, isPump = false } = {}) {
  const wrapper = document.createElement('div');
  wrapper.className = `dc-motor-shell${isPump ? ' pump-shell' : ''}`;

  const image = document.createElement('img');
  image.src = isPump ? 'css/components/bomba_svg.svg' : 'css/components/motor_dc_reducao.svg';
  image.alt = props?.label ?? (isPump ? 'Bomba d\'água' : 'Motor DC com redução');
  image.draggable = false;
  image.className = `dc-motor-image${isPump ? ' pump-image' : ''}`;

  const rotor = document.createElement('div');
  rotor.className = `dc-motor-rotor${isPump ? ' pump-rotor' : ''}`;
  const spinner = document.createElement('div');
  spinner.className = `dc-motor-spinner${isPump ? ' pump-spinner' : ''}`;
  rotor.appendChild(spinner);
  if (isPump) {
    rotor.style.display = 'none';
  }

  const water = document.createElement('div');
  water.className = 'pump-water';
  water.innerHTML = `
    <div class="stream"></div>
    <div class="drops">
      ${Array.from({ length: 24 })
        .map((_, idx) => `<div class="drop drop-${idx + 1}"></div>`)
        .join('')}
    </div>
  `;

  const speedLabel = document.createElement('span');
  speedLabel.className = 'dc-motor-speed';
  speedLabel.textContent = '0 RPM';

  wrapper.append(image, rotor, water, speedLabel);
  wrapper.__motorVisual = { rotor, spinner, speedLabel, water };

  const applyProps = (nextProps = {}) => {
    image.alt = nextProps.label ?? (isPump ? 'Bomba d\'água' : 'Motor DC com redução');
    wrapper.title = image.alt;
  };

  applyProps(props ?? {});

  return {
    element: wrapper,
    applyProps,
  };
}

function createOledDisplayElement({ preview = false } = {}) {
  const container = document.createElement('div');
  container.className = `oled-display${preview ? ' oled-display-preview' : ''}`;
  container.title = 'Display OLED 128x64';

  const image = document.createElement('img');
  image.src = 'css/components/display_oled.svg';
  image.alt = 'Display OLED 128x64';
  image.draggable = false;

  container.appendChild(image);

  if (!preview) {
    const screen = document.createElement('div');
    screen.className = 'oled-display-screen';
    const screenContent = document.createElement('div');
    screenContent.className = 'oled-display-screen-content';
    screen.appendChild(screenContent);
    container.appendChild(screen);
    container.__oledScreen = screenContent;
  }

  let rootElement = container;
  if (preview) {
    const wrapper = document.createElement('div');
    wrapper.className = 'preview-scale';
    wrapper.appendChild(container);
    rootElement = wrapper;
  }

  return {
    element: rootElement,
    applyProps: () => {},
  };
}

function createUltrasonicSensorElement({ props, preview = false } = {}) {
  const wrapper = document.createElement('div');
  wrapper.className = 'ultrasonic-shell';
  wrapper.title = '';

  const sensor = document.createElement('wokwi-hc-sr04');
  const baseWidth = preview ? 140 : 160;
  const baseHeight = preview ? 70 : 80;
  wrapper.style.width = `${baseWidth}px`;
  wrapper.style.height = `${baseHeight}px`;
  sensor.style.width = '100%';
  sensor.style.height = '100%';
  sensor.style.display = 'block';
  wrapper.appendChild(sensor);

  if (preview) {
    return wrapper;
  }

  const controls = document.createElement('div');
  controls.className = 'ultrasonic-controls component-embedded-control';
  controls.style.position = 'absolute';
  controls.style.display = 'none';
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '2';
  slider.max = '400';
  slider.step = '1';
  const valueLabel = document.createElement('span');
  valueLabel.className = 'value';
  controls.append(slider, valueLabel);

  let distanceCm = Number(props?.distance ?? 100);
  const minDistance = Number(slider.min);
  const maxDistance = Number(slider.max);

  const clampDistance = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return distanceCm;
    return Math.max(minDistance, Math.min(maxDistance, numeric));
  };

  const updateUI = () => {
    const normalized = clampDistance(distanceCm);
    distanceCm = normalized;
    slider.value = String(normalized);
    valueLabel.textContent = `${normalized.toFixed(0)} cm`;
    wrapper.__distanceCm = normalized;
    sensor.setAttribute('distance', String(normalized));
  };

  const setDistance = (value) => {
    distanceCm = clampDistance(value);
    updateUI();
  };

  slider.addEventListener('input', () => setDistance(slider.value));
  slider.addEventListener('pointerdown', (event) => event.stopPropagation());

  setDistance(distanceCm);

  wrapper.__controls = controls;
  wrapper.__sensorElement = sensor;

  return {
    element: wrapper,
    applyProps: (nextProps = {}) => {
      if (typeof nextProps.distance !== 'undefined') {
        setDistance(nextProps.distance);
      }
    },
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
  if (/3V|VIN|5V|VS/i.test(name)) return 'power';
  return 'signal';
}

const esp32PinLayout = [
  { name: 'D36', side: 'left', y: 18.0 },
  { name: 'D39', side: 'left', y: 26.0 },
  { name: 'D16', side: 'left', y: 34.0 },
  { name: 'D15', side: 'right', y: 34.0 },
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
  { name: 'D23 / MOSI', side: 'right-top', y: 24.0 },
  { name: 'D22 / SCL', side: 'right', y: 34.0 },
  { name: 'D21 / SDA', side: 'right', y: 44.0 },
  { name: 'D19 / MISO', side: 'right', y: 53.1 },
  { name: 'D18 / CLK', side: 'right', y: 62.9 },
  { name: 'D17', side: 'right', y: 72.2 },
  { name: 'D5 / CS', side: 'right', y: 81.7 },
  { name: 'D4', side: 'right', y: 110.8 },
  { name: 'D2', side: 'right', y: 120.0 },
  { name: 'D15', side: 'right', y: 130.4 },
  { name: 'GND.3', side: 'left', y: 168.0 },
  { name: '3V3.2', side: 'right', y: 168.0 },
  { name: 'GND.4', side: 'left', y: 170.0 },
  { name: 'GND.5', side: 'left', y: 176.0 },
  { name: 'GND.6', side: 'left', y: 182.0 },
  { name: 'GND.7', side: 'right', y: 170.0 },
  { name: 'GND.8', side: 'right', y: 176.0 },
  { name: 'GND.9', side: 'right', y: 182.0 },
  { name: '3V3.3', side: 'left', y: 164.0 },
  { name: '3V3.4', side: 'right', y: 164.0 },
  { name: '3V3.5', side: 'left', y: 194.0 },
  { name: '3V3.6', side: 'right', y: 194.0 },
  { name: '3V3.7', side: 'left', y: 200.0 },
  { name: '5V.1', side: 'left', y: 206.0 },
  { name: '5V.2', side: 'right', y: 206.0 },
  { name: 'VS1', side: 'left', y: 212.0 },
  { name: 'VS2', side: 'right', y: 212.0 },
  { name: 'VS3', side: 'left', y: 218.0 },
];

const amadoBoardCoordinates = {
  D36: { xPercent: 77.3, yPercent: 24.4 }, //Feito
  D39: { xPercent: 21.6, yPercent: 35.2 }, //Feito
  D34: { xPercent: 49, yPercent: 4.1 }, //Feito
  D35: { xPercent: 21.6, yPercent: 24 }, //Feito
  D32: { xPercent: 35, yPercent: 51.6797 },
  D33: { xPercent: 35, yPercent: 56.877 },
  D25: { xPercent: 16.6348, yPercent: 62.3004 },
  'D23 / MOSI': { xPercent: 21.6, yPercent: 64.7 }, //Feito
  D16: { xPercent: 21.6, yPercent: 46.2 }, //Feito
  D15: { xPercent: 28.57, yPercent: 46.2 }, //Feito
  'D22 / SCL': { xPercent: 77.3, yPercent: 34.45 }, //Feito
  'D21 / SDA': { xPercent: 77.3, yPercent: 37.2 }, //Feito
  'D19 / MISO': { xPercent: 21.6, yPercent: 59.3 }, //Feito
  'D18 / CLK': { xPercent: 21.6, yPercent: 61.9 }, //Feito
  'D5 / CS': { xPercent: 21.6, yPercent: 67.4 }, //Feito
  D17: { xPercent: 52.8 , yPercent: 4.1 }, //Feito
  'GND.2': { xPercent: 21.6, yPercent: 56.8 }, //GND dos pinos do RFID
  'GND.3': { xPercent: 77.3, yPercent: 22.0 }, //GND do pino 34
  'GND.4': { xPercent: 77.3, yPercent: 28.5 },  //GND do pino 36
  'GND.5': { xPercent: 45, yPercent: 4.1 }, //GND do sensor ultrassônico
  'GND.6': { xPercent: 21.6, yPercent: 29.7 }, //GND do pino 39
  'GND.7': { xPercent: 21.6, yPercent: 21.3 }, //GND do pino 35
  'GND.8': { xPercent: 21.6, yPercent: 40.6 }, //GND do pino 16 (servo motor)
  'GND.9': { xPercent: 28.57, yPercent: 40.6 }, //GND do pino 15 (servo motor)
  '3V3.2': { xPercent: 77.3, yPercent: 19 }, //3.3 do pino 34
  '3V3.3': { xPercent: 77.3, yPercent: 31.5 }, //3.3 do pino 36
  '3V3.4': { xPercent: 21.6, yPercent: 32.4 }, //3.3 do pino 39
  '3V3.5': { xPercent: 21.6, yPercent: 18.3 }, //3.3 do pino 35
  '3V3.6': { xPercent: 28.4, yPercent: 51.2 }, //3.3 do pino de alimentação dos servos
  '3V3.7': { xPercent: 21.6, yPercent: 70.4 }, //3.3 dos pinos do RFID
  '5V.1': { xPercent: 57, yPercent: 4.1 }, //5V do sensor ultrassônico
  '5V.2': { xPercent: 21.6, yPercent: 51.2 }, //5V do pino de alimentação dos servos
  VS1: { xPercent: 25, yPercent: 51.2 }, //VS do pino de alimentação dos servos
  VS2: { xPercent: 28.57, yPercent: 43.4 }, //VS do pino 15 (servo motor)
  VS3: { xPercent: 21.6, yPercent: 43.4 }, //VS do pino 16 (servo motor)
  //Pinos referente ao driver de motor
  D26: { xPercent: 16.6348, yPercent: 67.5402 },
  D27: { xPercent: 16.6348, yPercent: 72.7799 },
  D14: { xPercent: 16.6348, yPercent: 78.0197 },
  D12: { xPercent: 16.6348, yPercent: 83.2594 },
  D13: { xPercent: 16.6348, yPercent: 88.4992 },
  'MOTOR_A+': { xPercent: 23, yPercent: 5.5 },
  'MOTOR_A-': { xPercent: 23, yPercent: 11.3 },
  'MOTOR_B+': { xPercent: 76.444, yPercent: 5.5 },
  'MOTOR_B-': { xPercent: 76.44, yPercent: 11.55 },
  'GND.3': { xPercent: 77.3, yPercent: 22.0 }, //GND do pino 34
  '3V3.2': { xPercent: 77.3, yPercent: 19 }, //3.3 do pino 34
};

const MOTOR_DRIVER_SIGNAL_PINS = new Set(['D25', 'D26', 'D27', 'D12', 'D13', 'D14']);

const baseAmadoBoardPins = esp32PinLayout.map((pin, index) => {
  const manualPosition = amadoBoardCoordinates[pin.name];

  if (manualPosition) {
    return {
      name: pin.name,
      type: classifyPinType(pin.name),
      pinIndex: index,
      position: manualPosition,
      hidden: MOTOR_DRIVER_SIGNAL_PINS.has(pin.name),
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
    hidden: MOTOR_DRIVER_SIGNAL_PINS.has(pin.name),
  };
});

const motorOutputPins = [
  {
    name: 'MOTOR_A+',
    type: 'signal',
    pinIndex: baseAmadoBoardPins.length,
    position: amadoBoardCoordinates['MOTOR_A+'],
  },
  {
    name: 'MOTOR_A-',
    type: 'signal',
    pinIndex: baseAmadoBoardPins.length + 1,
    position: amadoBoardCoordinates['MOTOR_A-'],
  },
  {
    name: 'MOTOR_B+',
    type: 'signal',
    pinIndex: baseAmadoBoardPins.length + 2,
    position: amadoBoardCoordinates['MOTOR_B+'],
  },
  {
    name: 'MOTOR_B-',
    type: 'signal',
    pinIndex: baseAmadoBoardPins.length + 3,
    position: amadoBoardCoordinates['MOTOR_B-'],
  },
];

export const amadoBoardPins = [...baseAmadoBoardPins, ...motorOutputPins];

function createAmadoBoardElement({ preview = false } = {}) {
  const container = document.createElement('div');
  container.className = `amado-board${preview ? ' amado-board-preview' : ''}`;
  const previewScale = 0.22;
  container.style.width = `${preview ? AMADO_BOARD_WIDTH * previewScale : AMADO_BOARD_WIDTH}px`;
  container.style.height = `${preview ? AMADO_BOARD_HEIGHT * previewScale : AMADO_BOARD_HEIGHT}px`;
  container.dataset.board = 'amado';

  const image = document.createElement('img');
  image.src = 'css/assets/amadoboard-legendas.svg';
  image.alt = 'Placa Amado ESP32';
  container.appendChild(image);

  if (preview) {
    const wrapper = document.createElement('div');
    wrapper.className = 'preview-scale amado-preview-wrapper';
    wrapper.appendChild(container);
    return wrapper;
  }

  const indicators = document.createElement('div');
  indicators.className = 'amado-indicators';
  const indicatorPins = [
    { pin: 'D2', color: 'blue', xPercent: 23.4, yPercent: 22.35 },
    { pin: 'D32', color: 'red', xPercent: 23.4, yPercent:25.5 },
    { pin: 'D33', color: 'green', xPercent: 23.4, yPercent: 29.1 },
  ];
  const indicatorMap = new Map();
  indicatorPins.forEach(({ pin, color, xPercent, yPercent }) => {
    const wrapper = document.createElement('div');
    wrapper.className = `amado-indicator ${color}`;
    wrapper.style.left = `calc(${xPercent}% + 10px)`;
    wrapper.style.top = `${yPercent}%`;
    const dot = document.createElement('div');
    dot.className = 'dot';
    wrapper.append(dot);
    indicators.appendChild(wrapper);
    indicatorMap.set(pin.toUpperCase(), wrapper);
  });
  container.appendChild(indicators);
  container.__pinIndicators = indicatorMap;

  const buzzerIndicator = document.createElement('div');
  buzzerIndicator.className = 'amado-buzzer-indicator';
  const buzzerPos = { xPercent: 72.5, yPercent: 71 };
  buzzerIndicator.style.left = `calc(${buzzerPos.xPercent}% + 0px)`;
  buzzerIndicator.style.top = `${buzzerPos.yPercent}%`;
  buzzerIndicator.innerHTML = `
    <div class="icon"></div>
    <div class="wave wave-1"></div>
    <div class="wave wave-2"></div>
  `;
  container.appendChild(buzzerIndicator);
  container.__buzzerIndicator = buzzerIndicator;

  return {
    element: container,
    applyProps: () => {},
  };
}

export const componentGroups = [
  { id: 'basic', name: 'Básico' },
  { id: 'sources', name: 'Fontes' },
  { id: 'passives', name: 'Passivos' },
  { id: 'controls', name: 'Controles' },
  { id: 'sensors', name: 'Sensores' },
  { id: 'actuators', name: 'Atuadores' },
  { id: 'outputs', name: 'Telas' },
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
    group: 'basic',
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
    group: 'basic',
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
    id: 'battery-aaa-pack',
    name: 'Pacote AAA 1,5V',
    element: null,
    description: 'Agrupamento configurável de pilhas AAA (1,5V por célula).',
    group: 'basic',
    defaultProps: { cells: '1', voltage: '1.5' },
    pins: [
      {
        name: 'VCC (+)',
        type: 'power',
        selector: '.battery-aaa-pack-terminal-positive',
      },
      {
        name: 'GND (-)',
        type: 'ground',
        selector: '.battery-aaa-pack-terminal-negative',
      },
    ],
    getLabel: (props = {}) => {
      const count = clampCellCount(props.cells);
      const total = (count * 1.5).toFixed(1).replace('.0', '');
      return `Pacote AAA (${total}V)`;
    },
    createInstance: ({ props }) => createAaaBatteryPackElement({ props }),
    createPreview: () =>
      createAaaBatteryPackElement({ props: { cells: '1', voltage: '1.5' }, preview: true }).element,
    propertyControls: [
      {
        label: 'Quantidade de pilhas',
        formatValue: (value) => {
          const count = clampCellCount(value);
          const total = (count * 1.5).toFixed(1).replace('.0', '');
          return `${count} × 1,5V = ${total}V`;
        },
        control: {
          type: 'select',
          propKey: 'cells',
          options: [
            { label: '1 pilha (1,5V)', value: '1' },
            { label: '2 pilhas (3,0V)', value: '2' },
            { label: '3 pilhas (4,5V)', value: '3' },
            { label: '4 pilhas (6,0V)', value: '4' },
          ],
        },
      },
    ],
  },
  {
    id: 'protoboard-half',
    name: 'Protoboard 400 pontos',
    element: null,
    description: 'Placa de ensaio half-size (400 pontos).',
    group: 'tools',
    defaultProps: {},
    pins: PROTOBOARD_HALF_PINS,
    createInstance: () => createProtoboardElement({ preview: false }),
    createPreview: () => createProtoboardElement({ preview: true }).element,
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
    group: 'basic',
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
    group: 'basic',
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
      { name: 'V+', type: 'power', position: { xPercent: 20.5, yPercent: 33 } },
      { name: 'V-', type: 'ground', position: { xPercent: 20.5, yPercent: 67 } },
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
    id: 'water-pump',
    name: 'Bomba d\'água',
    element: null,
    description: 'Bomba d\'água DC de dois terminais.',
    group: 'actuators',
    defaultProps: {
      resistance: '30',
      label: 'Bomba d\'água',
    },
    pins: [
      { name: 'V+', type: 'power', position: { xPercent: 13.8, yPercent: 57.5 } },
      { name: 'V-', type: 'ground', position: { xPercent: 13.8, yPercent: 55 } },
    ],
    createInstance: ({ props }) => createDcMotorElement({ props, isPump: true }),
    createPreview: () => createDcMotorElement({ props: { label: 'Bomba' }, isPump: true }).element,
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
          placeholder: 'Bomba d\'água',
        },
      },
    ],
  },
  {
    id: 'switch',
    name: 'Chave ON/OFF',
    element: 'wokwi-slide-switch',
    description: 'Interruptor simples de dois terminais.',
    group: 'basic',
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
    id: 'ultrasonic-sensor',
    name: 'Sensor Ultrassônico HC-SR04',
    element: null,
    description: 'Medição de distância por ultrassom.',
    group: 'sensors',
    defaultProps: { distance: 100 },
    pins: [
      { name: 'VCC', type: 'power', position: { xPercent: 45, yPercent: 113 } },
      { name: 'TRIG', type: 'signal', position: { xPercent: 51, yPercent: 113 } },
      { name: 'ECHO', type: 'signal', position: { xPercent: 57, yPercent: 113 } },
      { name: 'GND', type: 'ground', position: { xPercent: 63, yPercent: 113 } },
    ],
    createInstance: ({ props }) => createUltrasonicSensorElement({ props, preview: false }),
    createPreview: () => createUltrasonicSensorElement({ preview: true }),
  },
  {
    id: 'buzzer',
    name: 'Buzzer',
    element: 'wokwi-buzzer',
    description: 'Transdutor piezoelétrico para alertas sonoros.',
    group: 'actuators',
    defaultProps: {},
    createPreview: () => createWokwiPreview('wokwi-buzzer', {}),
  },
  {
    id: 'oled-display',
    name: 'Display OLED 128x64',
    description: 'Display gráfico I2C de 0,96" com 128x64 pixels.',
    group: 'outputs',
    defaultProps: {},
    pins: [
      { name: 'VCC', type: 'power', position: { xPercent: 35.74, yPercent: 10.32 } },
      { name: 'GND', type: 'ground', position: { xPercent: 45.15, yPercent: 10.32 } },
      { name: 'SCL', type: 'signal', position: { xPercent: 54.66, yPercent: 10.32 } },
      { name: 'SDA', type: 'signal', position: { xPercent: 64.06, yPercent: 10.32 } },
    ],
    createInstance: () => createOledDisplayElement({ preview: false }),
    createPreview: () => createOledDisplayElement({ preview: true }).element,
  },
  {
    id: 'servo',
    name: 'Servo Motor',
    element: 'wokwi-servo',
    description: 'Servo rotativo padrão controlado por PWM.',
    group: 'actuators',
    defaultProps: {},
    createPreview: () => createWokwiPreview('wokwi-servo', { angle: 0 }),
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
    group: 'basic',
    defaultProps: { color: 'green' },
    createPreview: () => createWokwiPreview('wokwi-pushbutton', { color: 'green' }),
  },
  {
    id: 'potentiometer',
    name: 'Potenciômetro',
    element: 'wokwi-potentiometer',
    description: 'Resistor variável de três terminais.',
    group: 'basic',
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
