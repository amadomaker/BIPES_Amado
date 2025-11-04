import { getLedColorInfo } from './components.js';

const ADC_MAX_VALUE = 4095;
const DEFAULT_SUPPLY_VOLTAGE = 3.3;
const LED_INTERNAL_RESISTANCE = 120; // Ohms – aproxima resistência interna / fios
const DC_MOTOR_DEFAULT_RESISTANCE = 30; // Ohms
const DC_MOTOR_KV = 9 / 269; // ≈0.0335 V por RPM => 9 V ≈ 269 RPM
const DC_MOTOR_MAX_RPM = 400;
const DC_MOTOR_MIN_DRIVE_VOLTAGE = 0.2;
const DC_MOTOR_MIN_DRIVE_CURRENT = 0.005;
const CURRENT_WARNING_FACTOR = 1.3;
const CURRENT_DANGER_FACTOR = 2.5;
const VOLTAGE_WARNING_FACTOR = 1.15;
const VOLTAGE_DANGER_FACTOR = 1.6;
const PHOTORESISTOR_MIN_OHMS = 500;
const PHOTORESISTOR_MAX_OHMS = 1_000_000;

const MIN_RESISTANCE = 1e-3;
const BUZZER_DEFAULT_RESISTANCE = 100;
const BATTERY_INTERNAL_RESISTANCE = 0.5; // Ohms – mantém fontes estáveis em paralelo
const SOLVER_EPSILON = 1e-9;

class CircuitSnapshot {
  constructor(canvasManager, boardPinStates = new Map(), options = {}) {
    this.canvasManager = canvasManager;
    this.boardPinStates = boardPinStates;
    this.boardAnalogLevels = options.boardAnalogLevels ?? new Map();
    this.powerEnabled = options.powerEnabled ?? true;

    this.pinNodes = new Map();
    this.pinNodesByComponentPin = new Map();
    this.pinNodesByComponentIndex = new Map();
    this.nodeVoltageCache = new Map();

    this.nodeIdToNetId = new Map();
    this.nets = [];
    this.fixedNetVoltages = new Map();
    this.resistiveElements = [];
    this.voltageSources = [];
    this.netVoltages = new Map();
    this.elementCurrents = new Map();
    this.voltageSourceCurrents = new Map();
    this.voltageSourceDescriptors = [];
    this.virtualNetCounter = 0;
    this.solverWarnings = [];
    this.highestVoltageMagnitude = DEFAULT_SUPPLY_VOLTAGE;

    this.buildPinNodes();
    this.buildConnections();
    this.buildNets();
    this.buildElementModels();
    this.determineFixedNetVoltages();
    this.solveCircuit();
  }

  buildPinNodes() {
    this.canvasManager.components.forEach((component) => {
      const pins = this.canvasManager.wiringManager.getPinsForComponent(component.id) ?? [];
      pins.forEach((pinElement) => {
        const key = this.getPinKey(pinElement);
        const node = {
          id: key,
          pinElement,
          component,
          componentId: component.id,
          componentType: component.type,
          pinIndex: Number(pinElement.dataset.pinIndex),
          pinType: pinElement.dataset.pinType,
          pinName: pinElement.dataset.pinName,
          voltageState: this.getBoardPinState(component.id, pinElement.dataset.pinName),
          analogLevel: this.getBoardPinAnalogLevel(component.id, pinElement.dataset.pinName),
          connections: new Set(),
          netId: null,
        };
        const overrideState = this.getComponentPinVoltageOverride(component, node.pinName);
        if (overrideState) {
          node.voltageState = overrideState;
        }
        this.pinNodes.set(key, node);

        const mapKey = this.getComponentPinKey(component.id, node.pinName);
        if (mapKey) {
          this.pinNodesByComponentPin.set(mapKey, node);
        }

        let indexMap = this.pinNodesByComponentIndex.get(component.id);
        if (!indexMap) {
          indexMap = new Map();
          this.pinNodesByComponentIndex.set(component.id, indexMap);
        }
        indexMap.set(node.pinIndex, node);
      });
    });
  }

  buildConnections() {
    this.canvasManager.wiringManager.connections.forEach((connection) => {
      const node1 = this.pinNodes.get(this.getPinKey(connection.pin1));
      const node2 = this.pinNodes.get(this.getPinKey(connection.pin2));
      if (node1 && node2) {
        node1.connections.add(node2);
        node2.connections.add(node1);
      }
    });
    this.applyInternalComponentConnections();
  }

  buildNets() {
    const visited = new Set();
    let counter = 0;
    this.pinNodes.forEach((node) => {
      if (visited.has(node.id)) {
        return;
      }
      const queue = [node];
      const members = [];
      visited.add(node.id);
      while (queue.length) {
        const current = queue.shift();
        members.push(current);
        current.connections.forEach((neighbor) => {
          if (!visited.has(neighbor.id)) {
            visited.add(neighbor.id);
            queue.push(neighbor);
          }
        });
      }
      const netId = `N${counter}`;
      counter += 1;
      members.forEach((member) => {
        member.netId = netId;
        this.nodeIdToNetId.set(member.id, netId);
      });
      this.nets.push({ id: netId, nodes: members });
    });
  }

  createVirtualNet() {
    const netId = `VN${this.virtualNetCounter++}`;
    this.nets.push({ id: netId, nodes: [] });
    return netId;
  }

  buildNetComponents() {
    const adjacency = new Map();
    const ensureNet = (netId) => {
      if (!netId) return;
      if (!adjacency.has(netId)) {
        adjacency.set(netId, new Set());
      }
    };

    this.nets.forEach((net) => ensureNet(net.id));

    this.resistiveElements.forEach((element) => {
      const { netA, netB } = element;
      if (!netA || !netB || netA === netB) return;
      ensureNet(netA);
      ensureNet(netB);
      adjacency.get(netA).add(netB);
      adjacency.get(netB).add(netA);
    });

    this.voltageSources.forEach((source) => {
      const { positiveNet, negativeNet } = source;
      if (!positiveNet || !negativeNet || positiveNet === negativeNet) return;
      ensureNet(positiveNet);
      ensureNet(negativeNet);
      adjacency.get(positiveNet).add(negativeNet);
      adjacency.get(negativeNet).add(positiveNet);
    });

    const visited = new Set();
    const components = [];

    this.nets.forEach((net) => {
      if (visited.has(net.id)) return;
      const queue = [net.id];
      visited.add(net.id);
      const nets = [];
      while (queue.length) {
        const current = queue.shift();
        nets.push(current);
        const neighbors = adjacency.get(current);
        if (!neighbors) continue;
        neighbors.forEach((neighbor) => {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        });
      }
      components.push({ nets });
    });

    return components;
  }

  getGroundReferencePriority(net) {
    let priority = Infinity;
    net.nodes.forEach((node) => {
      const componentType = node.component?.type ?? node.componentId;
      if (componentType === 'amado-board' || componentType === 'esp32') {
        if (node.pinType === 'ground') {
          priority = Math.min(priority, 0);
        } else if (node.pinType === 'signal' && node.voltageState === 'low') {
          priority = Math.min(priority, 1);
        }
      } else if (componentType === 'battery') {
        if (node.pinType === 'ground') {
          priority = Math.min(priority, 2);
        }
      } else if (node.voltageState === 'low') {
        priority = Math.min(priority, 3);
      }
    });
    return Number.isFinite(priority) ? priority : null;
  }

  determineFixedNetVoltages() {
    this.fixedNetVoltages = new Map();
    const groundCandidates = new Map();

    this.nets.forEach((net) => {
      let forcedVoltage = null;
      let forcedFound = false;
      net.nodes.forEach((node) => {
        const candidate = this.getNodeForcedVoltage(node);
        if (candidate === null) return;
        if (!forcedFound || Math.abs(candidate - forcedVoltage) <= 0.5) {
          forcedVoltage = candidate;
        } else {
          forcedVoltage = candidate;
        }
        forcedFound = true;
      });
      if (forcedFound && forcedVoltage !== null) {
        this.fixedNetVoltages.set(net.id, forcedVoltage);
      }

      const priority = this.getGroundReferencePriority(net);
      if (priority !== null) {
        groundCandidates.set(net.id, priority);
      }
    });

    const components = this.buildNetComponents();
    components.forEach((component) => {
      const alreadyFixed = component.nets.some((netId) => this.fixedNetVoltages.has(netId));
      if (alreadyFixed) return;

      let chosenNet = null;
      let bestPriority = Infinity;
      component.nets.forEach((netId) => {
        const priority = groundCandidates.get(netId);
        if (priority !== undefined && priority < bestPriority) {
          bestPriority = priority;
          chosenNet = netId;
        }
      });

      if (!chosenNet) {
        chosenNet = component.nets[0];
      }

      if (!this.fixedNetVoltages.has(chosenNet)) {
        this.fixedNetVoltages.set(chosenNet, 0);
      }
    });
  }

  buildElementModels() {
    this.resistiveElements = [];
    this.voltageSources = [];

    this.canvasManager.components.forEach((component) => {
      switch (component.type) {
        case 'resistor':
          this.addResistiveTwoTerminal(component, {
            resistance: this.parseResistanceValue(
              component.props?.resistance ?? component.props?.value ?? component.props?.ohms,
            ),
            type: 'resistor',
          });
          break;
        case 'photoresistor':
          this.addResistiveTwoTerminal(component, {
            resistance: this.parseResistanceValue(
              component.state?.resistance ??
                component.props?.resistance ??
                component.props?.value ??
                component.props?.ohms,
            ),
            type: 'photoresistor',
          });
          break;
        case 'potentiometer':
          this.addPotentiometerElements(component);
          break;
        case 'dc-motor':
          this.addResistiveTwoTerminal(component, {
            resistance:
              this.parseResistanceValue(
                component.props?.resistance ?? component.props?.value ?? component.props?.ohms,
              ) ?? DC_MOTOR_DEFAULT_RESISTANCE,
            type: 'dc-motor',
          });
          break;
        case 'buzzer': {
          const parsed = this.parseResistanceValue(component.props?.resistance);
          const buzzerResistance = Number.isFinite(parsed) && parsed > 0
            ? parsed
            : BUZZER_DEFAULT_RESISTANCE;
          this.addResistiveTwoTerminal(component, {
            resistance: buzzerResistance,
            type: 'buzzer',
          });
          break;
        }
        case 'led':
          this.addLedElement(component);
          break;
        case 'battery':
          this.addBatteryElement(component);
          break;
        default:
          break;
      }
    });
  }

  solveCircuit() {
    const fixed = new Map(this.fixedNetVoltages);
    const candidateUnknowns = this.nets
      .map((net) => net.id)
      .filter((netId) => !fixed.has(netId));

    const connectedCandidates = new Set();
    this.resistiveElements.forEach((element) => {
      if (!fixed.has(element.netA)) connectedCandidates.add(element.netA);
      if (!fixed.has(element.netB)) connectedCandidates.add(element.netB);
    });
    this.voltageSources.forEach((source) => {
      if (!fixed.has(source.positiveNet)) connectedCandidates.add(source.positiveNet);
      if (!fixed.has(source.negativeNet)) connectedCandidates.add(source.negativeNet);
    });
    candidateUnknowns
      .filter((netId) => !connectedCandidates.has(netId))
      .forEach((netId) => fixed.set(netId, 0));

    const unknownNetIds = this.nets
      .map((net) => net.id)
      .filter((netId) => !fixed.has(netId));
    const netIndex = new Map();
    unknownNetIds.forEach((netId, idx) => netIndex.set(netId, idx));

    const activeVoltageSources = [];
    this.voltageSources.forEach((source) => {
      const posKnown = fixed.has(source.positiveNet);
      const negKnown = fixed.has(source.negativeNet);
      if (posKnown && negKnown) {
        const expected = (fixed.get(source.positiveNet) ?? 0) - (fixed.get(source.negativeNet) ?? 0);
        if (Math.abs(expected - source.voltage) > 1e-3) {
          this.registerSolverWarning(
            `Fonte ${source.component?.id ?? source.meta?.type ?? 'desconhecida'} possui tensão conflitante.`,
          );
        }
        return;
      }
      activeVoltageSources.push(source);
      this.highestVoltageMagnitude = Math.max(
        this.highestVoltageMagnitude,
        Math.abs(source.voltage),
      );
    });

    const variableCount = unknownNetIds.length + activeVoltageSources.length;
    if (variableCount === 0) {
      this.nets.forEach((net) => {
        const value = fixed.get(net.id) ?? 0;
        this.netVoltages.set(net.id, value);
      });
      return;
    }

    const matrix = Array.from({ length: variableCount }, () => Array(variableCount).fill(0));
    const rhs = new Array(variableCount).fill(0);

    this.resistiveElements.forEach((element) => {
      const { netA, netB, resistance } = element;
      if (!netA || !netB) return;
      const conductance = resistance > 0 ? 1 / resistance : 0;
      if (!Number.isFinite(conductance) || conductance <= 0) return;
      const idxA = netIndex.get(netA);
      const idxB = netIndex.get(netB);
      const hasA = idxA !== undefined;
      const hasB = idxB !== undefined;
      const voltageA = fixed.get(netA);
      const voltageB = fixed.get(netB);

      if (hasA && hasB) {
        matrix[idxA][idxA] += conductance;
        matrix[idxB][idxB] += conductance;
        matrix[idxA][idxB] -= conductance;
        matrix[idxB][idxA] -= conductance;
      } else if (hasA && voltageB !== undefined) {
        matrix[idxA][idxA] += conductance;
        rhs[idxA] += conductance * voltageB;
      } else if (hasB && voltageA !== undefined) {
        matrix[idxB][idxB] += conductance;
        rhs[idxB] += conductance * voltageA;
      }
    });

    activeVoltageSources.forEach((source, sourceIndex) => {
      const row = unknownNetIds.length + sourceIndex;
      rhs[row] = source.voltage;

      const posIdx = netIndex.get(source.positiveNet);
      const negIdx = netIndex.get(source.negativeNet);
      const posKnown = fixed.get(source.positiveNet);
      const negKnown = fixed.get(source.negativeNet);

      if (posIdx !== undefined) {
        matrix[posIdx][row] += 1;
        matrix[row][posIdx] += 1;
      } else if (posKnown !== undefined) {
        rhs[row] -= posKnown;
      }

      if (negIdx !== undefined) {
        matrix[negIdx][row] -= 1;
        matrix[row][negIdx] -= 1;
      } else if (negKnown !== undefined) {
        rhs[row] += negKnown;
      }
    });

    const solution = this.solveLinearSystem(matrix, rhs);
    if (!solution) {
      this.nets.forEach((net) => {
        const fallback = fixed.get(net.id) ?? 0;
        this.netVoltages.set(net.id, fallback);
      });
      return;
    }

    unknownNetIds.forEach((netId, idx) => {
      this.netVoltages.set(netId, solution[idx]);
    });
    fixed.forEach((value, netId) => {
      this.netVoltages.set(netId, value);
    });
    this.nets.forEach((net) => {
      if (!this.netVoltages.has(net.id)) {
        this.netVoltages.set(net.id, 0);
      }
    });

    this.elementCurrents = new Map();
    this.resistiveElements.forEach((element) => {
      const voltageA = this.netVoltages.get(element.netA) ?? 0;
      const voltageB = this.netVoltages.get(element.netB) ?? 0;
      const current = element.resistance > 0 ? (voltageA - voltageB) / element.resistance : 0;
      if (element.component?.id) {
        const entry = this.elementCurrents.get(element.component.id);
        if (!entry) {
          this.elementCurrents.set(element.component.id, [{ current, voltage: voltageA - voltageB }]);
        } else {
          entry.push({ current, voltage: voltageA - voltageB });
        }
      }
    });

    this.voltageSourceCurrents = new Map();
    this.voltageSourceDescriptors.forEach((descriptor) => {
      const externalVoltage = this.netVoltages.get(descriptor.externalPositiveNet) ?? 0;
      const internalVoltage = this.netVoltages.get(descriptor.internalNet) ?? 0;
      const resistance = this.sanitizeResistance(descriptor.internalResistance);
      const current = (internalVoltage - externalVoltage) / resistance;
      if (descriptor.component?.id) {
        this.voltageSourceCurrents.set(descriptor.component.id, current);
      }
    });

    const parallelGroups = new Map();
    parallelGroups.forEach((entries) => {
      if (entries.length <= 1) return;
      entries.forEach((entry) => {
        if (entry.component?.id) {
          const voltage = this.netVoltages.get(entry.internalNet) ?? 0;
          this.nodeVoltageCache.set(`battery:${entry.component.id}:virtual`, voltage);
        }
      });
    });
  }

  solveLinearSystem(matrix, rhs) {
    const size = matrix.length;
    if (!size) return [];
    const A = matrix.map((row) => row.slice());
    const b = rhs.slice();

    for (let pivot = 0; pivot < size; pivot += 1) {
      let maxRow = pivot;
      let maxValue = Math.abs(A[pivot][pivot]);
      for (let row = pivot + 1; row < size; row += 1) {
        const value = Math.abs(A[row][pivot]);
        if (value > maxValue) {
          maxValue = value;
          maxRow = row;
        }
      }

      if (maxValue < SOLVER_EPSILON) {
        return null;
      }

      if (maxRow !== pivot) {
        const tempRow = A[pivot];
        A[pivot] = A[maxRow];
        A[maxRow] = tempRow;
        const tempValue = b[pivot];
        b[pivot] = b[maxRow];
        b[maxRow] = tempValue;
      }

      for (let row = pivot + 1; row < size; row += 1) {
        const factor = A[row][pivot] / A[pivot][pivot];
        if (Math.abs(factor) < SOLVER_EPSILON) continue;
        for (let col = pivot; col < size; col += 1) {
          A[row][col] -= factor * A[pivot][col];
        }
        b[row] -= factor * b[pivot];
      }
    }

    const solution = new Array(size).fill(0);
    for (let row = size - 1; row >= 0; row -= 1) {
      let sum = b[row];
      for (let col = row + 1; col < size; col += 1) {
        sum -= A[row][col] * solution[col];
      }
      solution[row] = sum / A[row][row];
    }
    return solution;
  }

  evaluateLEDs() {
    const results = [];

    this.canvasManager.components
      .filter((component) => component.type === 'led')
      .forEach((component) => {
        const pins = this.getPinsForComponent(component.id);
        if (pins.length < 2) {
          results.push({
            component,
            lightsUp: false,
            brightness: 0,
            voltageDrop: 0,
            supplyVoltage: 0,
            seriesResistance: null,
            effectiveResistance: null,
            currentEstimate: 0,
            damageEvent: false,
            damageReason: null,
            warnings: null,
            reasons: ['LED sem conexões suficientes'],
          });
          return;
        }

        const anode = pins.find((pin) => pin.pinType === 'power') ?? pins[0];
        const cathode = pins.find((pin) => pin.pinType === 'ground') ?? pins[1];
        const voltageAnode = this.getNodeVoltage(anode);
        const voltageCathode = this.getNodeVoltage(cathode);
        const voltageDrop = voltageAnode - voltageCathode;

        const state = component.state ?? (component.state = {});
        const colorInfo = getLedColorInfo(component.props?.color) ?? {
          label: 'Padrão',
          forwardVoltageMin: 1.8,
          forwardVoltageMax: 2.2,
          maxCurrent: 0.02,
        };

        const forwardVoltageMin = Math.max(colorInfo.forwardVoltageMin ?? 0, 0);
        const forwardVoltageMax = Math.max(
          colorInfo.forwardVoltageMax ?? forwardVoltageMin,
          forwardVoltageMin,
        );
        const effectiveResistance = this.estimateLedResistance(component);

        let currentEstimate = 0;
        if (effectiveResistance > 0 && !state.burned) {
          currentEstimate = voltageDrop / effectiveResistance;
        }
        const currentAbs = Math.max(0, currentEstimate);

        const maxCurrent = colorInfo.maxCurrent || 0.02;
        let brightness = 0;
        if (!state.burned) {
          brightness = Math.max(0, Math.min(1, maxCurrent > 0 ? currentAbs / maxCurrent : 0));
        }

        const voltageWarning =
          voltageDrop > forwardVoltageMax * VOLTAGE_WARNING_FACTOR;
        const voltageDanger =
          voltageDrop > forwardVoltageMax * VOLTAGE_DANGER_FACTOR;
        const currentWarning =
          currentAbs > (colorInfo.maxCurrent || 0.02) * CURRENT_WARNING_FACTOR;
        const currentDanger =
          currentAbs > (colorInfo.maxCurrent || 0.02) * CURRENT_DANGER_FACTOR;

        let damageEvent = false;
        if (!state.burned && (voltageDanger || currentDanger)) {
          state.burned = true;
          state.burnedAt = Date.now();
          state.burnReason = currentDanger ? 'sobrecorrente' : 'sobretensão';
          damageEvent = true;
        }

        const isBurned = Boolean(state.burned);
        if (isBurned) {
          brightness = 0;
        }
        const lightsUp = brightness > 0.01;

        const reasons = [];
        if (!Number.isFinite(voltageDrop) || Math.abs(voltageDrop) < 1e-3) {
          reasons.push('Sem diferença de potencial');
        }
        if (voltageDrop < 0 && !isBurned) {
          reasons.push('LED polarizado inversamente');
        }
        if (!lightsUp && voltageDrop >= 0 && voltageDrop < forwardVoltageMin) {
          reasons.push('Tensão insuficiente para polarizar o LED');
        }
        if (lightsUp && voltageDrop < forwardVoltageMin) {
          reasons.push('Queda de tensão abaixo do ideal para o LED');
        }
        if (
          !isBurned &&
          lightsUp &&
          !this.hasSeriesProtectionResistor(component, anode.netId, cathode.netId)
        ) {
          reasons.push('Falta resistor em série (corrente limitada apenas pelo LED)');
        }
        if (isBurned) {
          const reasonLabel = state.burnReason === 'sobrecorrente' ? 'sobre-corrente' : 'sobre-tensão';
          reasons.push(`LED danificado por ${reasonLabel}`);
        } else {
          if (voltageWarning) {
            reasons.push(`Aviso: queda de tensão ${voltageDrop.toFixed(2)} V acima do ideal`);
          }
          if (currentWarning && Number.isFinite(currentAbs) && currentAbs > 0) {
            reasons.push(`Aviso: corrente ${(currentAbs * 1000).toFixed(1)} mA acima do ideal`);
          }
        }

        results.push({
          component,
          lightsUp,
          brightness,
          voltageDrop: Math.max(0, voltageDrop),
          supplyVoltage: Math.max(0, voltageDrop),
          seriesResistance: null,
          effectiveResistance,
          currentEstimate: currentAbs,
          damageEvent,
          damageReason: state.burnReason ?? null,
          warnings: !isBurned
            ? {
                voltage: voltageWarning,
                current: currentWarning,
              }
            : null,
          reasons,
        });
      });

    return results;
  }

  evaluateBuzzers() {
    const results = [];

    this.canvasManager.components
      .filter((component) => component.type === 'buzzer')
      .forEach((component) => {
        const pins = this.getPinsForComponent(component.id);
        if (pins.length < 2) {
          results.push({
            component,
            active: false,
            voltageDrop: 0,
            supplyVoltage: 0,
            reasons: ['Buzzer sem conexões suficientes'],
          });
          return;
        }

        const positive = pins.find((pin) => /vcc|\+|2/i.test(pin.pinName)) ?? pins[1];
        const negative = pins.find((pin) => /gnd|\-|1/i.test(pin.pinName)) ?? pins[0];
        const voltage = this.getNodeVoltage(positive) - this.getNodeVoltage(negative);
        const absVoltage = Math.abs(voltage);
        const parsedResistance = this.parseResistanceValue(component.props?.resistance);
        const resistance = Number.isFinite(parsedResistance) && parsedResistance > 0
          ? parsedResistance
          : BUZZER_DEFAULT_RESISTANCE;
        const current = resistance > 0 ? absVoltage / resistance : 0;
        const active = absVoltage >= 0.7;

        const reasons = [];
        if (!active) {
          if (absVoltage < 0.1) {
            reasons.push('Buzzer sem alimentação');
          } else {
            reasons.push('Tensão insuficiente para acionar o buzzer');
          }
        }

        results.push({
          component,
          active,
          voltageDrop: absVoltage,
          supplyVoltage: absVoltage,
          reasons,
        });
      });

    return results;
  }

  evaluateDcMotors() {
    const results = [];

    this.canvasManager.components
      .filter((component) => component.type === 'dc-motor')
      .forEach((component) => {
        const pins = this.getPinsForComponent(component.id);
        if (pins.length < 2) {
          results.push({
            component,
            active: false,
            direction: 0,
            rpm: 0,
            current: 0,
            voltage: 0,
            supplyVoltage: 0,
            reasons: ['Motor sem conexões suficientes'],
          });
          return;
        }

        const positive = pins.find((pin) => pin.pinType === 'power') ?? pins[0];
        const negative = pins.find((pin) => pin.pinType === 'ground') ?? pins[1];
        const voltageDiff = this.getNodeVoltage(positive) - this.getNodeVoltage(negative);
        const absVoltage = Math.abs(voltageDiff);

        let motorResistance = this.parseResistanceValue(
          component.props?.resistance ?? component.props?.value ?? component.props?.ohms,
        );
        if (!Number.isFinite(motorResistance) || motorResistance <= 0) {
          motorResistance = DC_MOTOR_DEFAULT_RESISTANCE;
        }

        const current = motorResistance > 0 ? voltageDiff / motorResistance : 0;
        const absCurrent = Math.abs(current);
        const direction = absVoltage > 0.05 ? (current >= 0 ? 1 : -1) : 0;

        let rpm = 0;
        let active = false;
        if (
          absVoltage >= DC_MOTOR_MIN_DRIVE_VOLTAGE &&
          absCurrent >= DC_MOTOR_MIN_DRIVE_CURRENT
        ) {
          rpm = Math.min(DC_MOTOR_MAX_RPM, Math.max(0, absVoltage / DC_MOTOR_KV));
          active = rpm > 1;
        }

        if (!component.state) component.state = {};
        component.state.motor = {
          rpm,
          direction,
          current: absCurrent,
          voltage: absVoltage,
        };

        const reasons = [];
        if (!active) {
          if (absVoltage < DC_MOTOR_MIN_DRIVE_VOLTAGE) {
            reasons.push('Diferença de tensão insuficiente');
          } else if (absCurrent < DC_MOTOR_MIN_DRIVE_CURRENT) {
            reasons.push('Corrente insuficiente para girar o motor');
          } else {
            reasons.push('Sem alimentação aplicada ao motor');
          }
        }

        results.push({
          component,
          active,
          direction,
          rpm,
          current: absCurrent,
          voltage: absVoltage,
          supplyVoltage: absVoltage,
          reasons,
        });
      });

    return results;
  }

  getPinsForComponent(componentId) {
    return Array.from(this.pinNodes.values())
      .filter((node) => node.componentId === componentId)
      .sort((a, b) => a.pinIndex - b.pinIndex);
  }

  getPinKey(pinElement) {
    return `${pinElement.dataset.componentId}:${pinElement.dataset.pinIndex}`;
  }

  getComponentPinKey(componentId, pinName) {
    if (!componentId || !pinName) return null;
    return `${componentId}:${pinName}`;
  }

  getNodeByComponentPin(componentId, pinName) {
    const key = this.getComponentPinKey(componentId, pinName);
    if (!key) return null;
    return this.pinNodesByComponentPin.get(key) ?? null;
  }

  getNodeByComponentIndex(componentId, pinIndex) {
    const indexMap = this.pinNodesByComponentIndex.get(componentId);
    if (!indexMap) return null;
    return indexMap.get(pinIndex) ?? null;
  }

  getNodeVoltage(node) {
    if (!node || !node.netId) return 0;
    return this.netVoltages.get(node.netId) ?? 0;
  }

  estimateNodeVoltage(node) {
    if (!node) return 0;
    return this.getNodeVoltage(node);
  }

  buildResistanceGraph() {
    const parent = new Map();
    const find = (id) => {
      if (!id) return null;
      if (!parent.has(id)) {
        parent.set(id, id);
        return id;
      }
      let root = parent.get(id);
      if (root !== id) {
        root = find(root);
        parent.set(id, root);
      }
      return root;
    };
    const union = (a, b) => {
      if (!a || !b) return;
      const rootA = find(a);
      const rootB = find(b);
      if (rootA === null || rootB === null || rootA === rootB) return;
      parent.set(rootA, rootB);
    };

    this.nets.forEach((net) => {
      parent.set(net.id, net.id);
    });

    this.voltageSources.forEach((source) => {
      if (!source) return;
      union(source.positiveNet, source.negativeNet);
    });

    const netRootMap = new Map();
    this.nets.forEach((net) => {
      netRootMap.set(net.id, find(net.id));
    });

    const edges = [];
    this.resistiveElements.forEach((element) => {
      if (!element) return;
      const rootA = netRootMap.get(element.netA);
      const rootB = netRootMap.get(element.netB);
      if (!rootA || !rootB || rootA === rootB) return;
      const resistance = element.resistance;
      if (!Number.isFinite(resistance) || resistance <= 0) return;
      const conductance = 1 / resistance;
      if (!Number.isFinite(conductance) || conductance <= 0) return;
      edges.push({
        a: rootA,
        b: rootB,
        conductance,
      });
    });

    return { netRootMap, edges };
  }

  computeResistanceBetweenNodes(nodeA, nodeB) {
    if (!nodeA || !nodeB) return Infinity;
    const netIdA = nodeA.netId;
    const netIdB = nodeB.netId;
    if (!netIdA || !netIdB) return Infinity;

    const { netRootMap, edges } = this.buildResistanceGraph();
    const rootA = netRootMap.get(netIdA);
    const rootB = netRootMap.get(netIdB);
    if (!rootA || !rootB) return Infinity;
    if (rootA === rootB) return 0;

    const adjacency = new Map();
    edges.forEach(({ a, b }) => {
      if (!adjacency.has(a)) adjacency.set(a, new Set());
      if (!adjacency.has(b)) adjacency.set(b, new Set());
      adjacency.get(a).add(b);
      adjacency.get(b).add(a);
    });

    if (!adjacency.has(rootA)) adjacency.set(rootA, new Set());
    if (!adjacency.has(rootB)) adjacency.set(rootB, new Set());

    const visited = new Set([rootA]);
    const queue = [rootA];
    while (queue.length) {
      const current = queue.shift();
      if (current === rootB) break;
      const neighbors = adjacency.get(current);
      if (!neighbors) continue;
      neighbors.forEach((neighbor) => {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      });
    }
    if (!visited.has(rootB)) {
      return Infinity;
    }

    const nodesSet = new Set();
    edges.forEach(({ a, b }) => {
      nodesSet.add(a);
      nodesSet.add(b);
    });
    nodesSet.add(rootA);
    nodesSet.add(rootB);
    nodesSet.delete(rootB);

    const unknownNets = Array.from(nodesSet);
    if (unknownNets.length === 0) {
      return Infinity;
    }

    const index = new Map();
    unknownNets.forEach((net, idx) => index.set(net, idx));

    const size = unknownNets.length;
    const matrix = Array.from({ length: size }, () => Array(size).fill(0));
    const rhs = new Array(size).fill(0);

    edges.forEach(({ a, b, conductance }) => {
      const idxA = index.get(a);
      const idxB = index.get(b);
      if (idxA !== undefined) {
        matrix[idxA][idxA] += conductance;
      }
      if (idxB !== undefined) {
        matrix[idxB][idxB] += conductance;
      }
      if (idxA !== undefined && idxB !== undefined) {
        matrix[idxA][idxB] -= conductance;
        matrix[idxB][idxA] -= conductance;
      }
    });

    const idxA = index.get(rootA);
    if (idxA === undefined) {
      return Infinity;
    }
    rhs[idxA] += 1;

    const solution = this.solveLinearSystem(matrix, rhs);
    if (!solution) return Infinity;

    const voltageAtA = solution[idxA];
    if (!Number.isFinite(voltageAtA)) return Infinity;
    return Math.abs(voltageAtA);
  }

  resolveVoltageForNode(node) {
    if (!node) return 'floating';
    if (node.voltageState === 'high') return 'high';
    if (node.voltageState === 'low') return 'low';

    const voltage = this.getNodeVoltage(node);
    if (!Number.isFinite(voltage)) return 'floating';
    if (Math.abs(voltage) <= 0.05) return 'low';
    const threshold = this.getHighLevelVoltage() * 0.7;
    if (voltage >= threshold) return 'high';
    if (voltage <= -threshold) return 'error';
    return 'floating';
  }

  resolveVoltageForBoardPin(componentId, pinName) {
    const node = this.getNodeByComponentPin(componentId, pinName);
    return this.resolveVoltageForNode(node);
  }

  resolveAnalogLevel(node) {
    if (!node) return null;
    if (Number.isFinite(node.analogLevel)) {
      return node.analogLevel;
    }
    const voltage = this.getNodeVoltage(node);
    if (!Number.isFinite(voltage)) return null;
    const clamped = Math.max(0, Math.min(DEFAULT_SUPPLY_VOLTAGE, voltage));
    return Math.round((clamped / DEFAULT_SUPPLY_VOLTAGE) * ADC_MAX_VALUE);
  }

  getNodeForcedVoltage(node) {
    if (!node) return null;
    const componentType = node.component?.type ?? node.componentId;
    if (componentType === 'battery') return null;

    const boardSupply = this.getBoardSupplyVoltage(node);

    if (componentType === 'amado-board' || componentType === 'esp32') {
      if (node.pinType === 'ground') return 0;
      if (!this.powerEnabled) return 0;
      if (node.pinType === 'power') return boardSupply;
      const key = this.getComponentPinKey(node.componentId, node.pinName);
      const state = key ? this.boardPinStates.get(key) : null;
      if (state === 'high') return boardSupply;
      if (state === 'low') return 0;
    }

    if (node.voltageState === 'high') {
      return this.powerEnabled ? boardSupply : 0;
    }
    if (node.voltageState === 'low') {
      return 0;
    }
    return null;
  }

  isGroundReferenceNode(node) {
    if (!node) return false;
    const componentType = node.component?.type ?? node.componentId;
    if (componentType === 'battery') {
      return node.pinType === 'ground';
    }
    if (componentType === 'amado-board' || componentType === 'esp32') {
      if (node.pinType === 'ground') return true;
      if (node.pinType === 'signal' && node.voltageState === 'low') return true;
    }
    return false;
  }

  isGroundPin(node) {
    if (!node) return false;
    if (node.pinType === 'ground') return true;
    if (node.voltageState === 'low') return true;
    return false;
  }

  hasSeriesProtectionResistor(component, netA, netB) {
    if (!netA || !netB) return false;
    return this.resistiveElements.some((element) => {
      if (!element.component || element.component.id === component.id) return false;
      if (!this.isProtectionResistorType(element.type)) return false;
      return (
        element.netA === netA ||
        element.netB === netA ||
        element.netA === netB ||
        element.netB === netB
      );
    });
  }

  isProtectionResistorType(type) {
    return type === 'resistor' || type === 'photoresistor' || type === 'potentiometer-segment' || type === 'potentiometer';
  }

  addResistiveTwoTerminal(component, options = {}) {
    if (!component) return;
    const nodeA = this.getNodeByComponentIndex(component.id, 0);
    const nodeB = this.getNodeByComponentIndex(component.id, 1);
    if (!nodeA || !nodeB) return;
    const netA = nodeA.netId;
    const netB = nodeB.netId;
    if (!netA || !netB || netA === netB) return;

    this.resistiveElements.push({
      component,
      type: options.type ?? component.type,
      netA,
      netB,
      resistance: this.sanitizeResistance(options.resistance),
    });
  }

  addPotentiometerElements(component) {
    const node0 = this.getNodeByComponentIndex(component.id, 0);
    const node1 = this.getNodeByComponentIndex(component.id, 1);
    const node2 = this.getNodeByComponentIndex(component.id, 2);
    if (!node0 || !node1 || !node2) return;

    const total = this.getPotentiometerTotalResistance(component);
    const ratio = Math.max(0, Math.min(1, this.getPotentiometerRatio(component)));
    const resistance01 = total * ratio;
    const resistance12 = total * (1 - ratio);

    if (node0.netId && node1.netId && node0.netId !== node1.netId) {
      this.resistiveElements.push({
        component,
        type: 'potentiometer-segment',
        netA: node0.netId,
        netB: node1.netId,
        resistance: this.sanitizeResistance(resistance01),
      });
    }
    if (node1.netId && node2.netId && node1.netId !== node2.netId) {
      this.resistiveElements.push({
        component,
        type: 'potentiometer-segment',
        netA: node1.netId,
        netB: node2.netId,
        resistance: this.sanitizeResistance(resistance12),
      });
    }
  }

  addLedElement(component) {
    if (!component || component.state?.burned) return;
    const pins = this.getPinsForComponent(component.id);
    if (pins.length < 2) return;
    const anode = pins.find((pin) => pin.pinType === 'power') ?? pins[0];
    const cathode = pins.find((pin) => pin.pinType === 'ground') ?? pins[1];
    if (!anode || !cathode) return;
    const netA = anode.netId;
    const netB = cathode.netId;
    if (!netA || !netB || netA === netB) return;

    this.resistiveElements.push({
      component,
      type: 'led',
      netA,
      netB,
      resistance: this.sanitizeResistance(this.estimateLedResistance(component)),
    });
  }

  addBatteryElement(component) {
    if (!component) return;
    const pins = this.getPinsForComponent(component.id);
    if (pins.length < 2) return;
    const positive = pins.find((pin) => pin.pinType === 'power') ?? pins[0];
    const negative = pins.find((pin) => pin.pinType === 'ground') ?? pins[1];
    if (!positive || !negative) return;
    const netPos = positive.netId;
    const netNeg = negative.netId;
    if (!netPos || !netNeg || netPos === netNeg) return;

    const voltage = this.parseVoltageValue(component.props?.voltage ?? component.props?.value);
    if (!Number.isFinite(voltage) || voltage === 0) return;

    const internalResistance = this.parseResistanceValue(
      component.props?.internalResistance ??
        component.props?.internalOhms ??
        component.props?.seriesResistance,
    );
    const sanitizedResistance = this.sanitizeResistance(
      Number.isFinite(internalResistance) && internalResistance > 0
        ? internalResistance
        : BATTERY_INTERNAL_RESISTANCE,
    );

    const internalNet = this.createVirtualNet();

    this.resistiveElements.push({
      component,
      type: 'battery-internal-resistance',
      netA: netPos,
      netB: internalNet,
      resistance: sanitizedResistance,
    });

    this.voltageSources.push({
      component,
      type: 'battery',
      positiveNet: internalNet,
      negativeNet: netNeg,
      voltage,
      meta: {
        type: 'battery',
        externalPositiveNet: netPos,
        internalNet,
      },
    });

    this.voltageSourceDescriptors.push({
      component,
      externalPositiveNet: netPos,
      internalNet,
      negativeNet: netNeg,
      voltage,
      internalResistance: sanitizedResistance,
    });

    this.highestVoltageMagnitude = Math.max(this.highestVoltageMagnitude, Math.abs(voltage));
  }

  registerSolverWarning(message) {
    if (!message) return;
    this.solverWarnings.push(message);
  }

  sanitizeResistance(value) {
    if (!Number.isFinite(value) || value <= 0) return MIN_RESISTANCE;
    return Math.max(value, MIN_RESISTANCE);
  }

  getHighLevelVoltage() {
    return Math.max(DEFAULT_SUPPLY_VOLTAGE, Math.min(this.highestVoltageMagnitude, 12));
  }

  getBoardSupplyVoltage(node) {
    if (!node) return DEFAULT_SUPPLY_VOLTAGE;
    const pin = String(node.pinName ?? '').toUpperCase();
    if (/VIN|5V|5\.0/.test(pin)) return 5;
    return DEFAULT_SUPPLY_VOLTAGE;
  }

  applyInternalComponentConnections() {
    this.canvasManager.components.forEach((component) => {
      switch (component.type) {
        case 'switch':
          this.applySwitchConnections(component);
          break;
        case 'pushbutton':
          this.applyPushbuttonConnections(component);
          break;
        default:
          break;
      }
    });
  }

  applySwitchConnections(component) {
    if (!component) return;
    if (this.isSwitchOn(component)) {
      this.connectNodesByIndex(component.id, 0, 1);
    }
  }

  applyPushbuttonConnections(component) {
    const componentId = component.id;
    const element = component.element;
    const storedState = component.state?.pressed;
    const isPressed = storedState ?? this.isPushbuttonPressed(element);

    const topLeft = this.getNodeByComponentIndex(componentId, 0);
    const bottomLeft = this.getNodeByComponentIndex(componentId, 1);
    const topRight = this.getNodeByComponentIndex(componentId, 2);
    const bottomRight = this.getNodeByComponentIndex(componentId, 3);

    this.connectNodes(topLeft, topRight);
    this.connectNodes(bottomLeft, bottomRight);

    if (isPressed) {
      this.connectNodes(topLeft, bottomLeft);
      this.connectNodes(topLeft, bottomRight);
      this.connectNodes(topRight, bottomLeft);
      this.connectNodes(topRight, bottomRight);
    }
  }

  connectNodes(nodeA, nodeB) {
    if (!nodeA || !nodeB || nodeA === nodeB) return;
    nodeA.connections.add(nodeB);
    nodeB.connections.add(nodeA);
  }

  connectNodesByIndex(componentId, indexA, indexB) {
    if (indexA === indexB) return;
    const nodeA = this.getNodeByComponentIndex(componentId, indexA);
    const nodeB = this.getNodeByComponentIndex(componentId, indexB);
    this.connectNodes(nodeA, nodeB);
  }

  isSwitchOn(component) {
    if (!component) return false;
    if (typeof component.state?.on === 'boolean') return component.state.on;
    const elementValue = component.element?.value;
    if (typeof elementValue === 'number') return elementValue > 0;
    if (typeof elementValue === 'string') {
      const trimmed = elementValue.trim().toLowerCase();
      if (trimmed === '1' || trimmed === 'on' || trimmed === 'true') return true;
      if (trimmed === '0' || trimmed === 'off' || trimmed === 'false') return false;
    }
    const initial = String(component.props?.initialState ?? 'off').toLowerCase();
    return initial === 'on';
  }

  isPushbuttonPressed(element) {
    if (!element) return false;
    if (typeof element.value !== 'undefined') {
      const value = element.value;
      if (typeof value === 'number') return value !== 0;
      if (typeof value === 'string') return value !== '' && value !== '0';
      return Boolean(value);
    }
    if (typeof element.pressed !== 'undefined') return Boolean(element.pressed);
    const attrValue = element.getAttribute?.('value');
    if (attrValue !== null) return attrValue !== '0';
    return element.hasAttribute?.('pressed');
  }

  getBoardPinState(componentId, pinName) {
    if (!componentId || !pinName) return 'floating';
    const key = `${componentId}:${pinName}`;
    return this.boardPinStates.get(key) ?? 'floating';
  }

  getBoardPinAnalogLevel(componentId, pinName) {
    if (!componentId || !pinName) return null;
    const key = `${componentId}:${pinName}`;
    const component = this.canvasManager?.getComponentById(componentId);
    if (!component) {
      const storedFallback = this.boardAnalogLevels.get(key);
      return Number.isFinite(storedFallback) ? storedFallback : null;
    }
    const normalizedPin = String(pinName).toUpperCase();
    if (component.type === 'photoresistor' && normalizedPin === 'AO') {
      const level = Number(component.state?.lightLevel);
      if (Number.isFinite(level)) {
        const analog = Math.round((Math.max(0, Math.min(100, level)) / 100) * ADC_MAX_VALUE);
        this.boardAnalogLevels.set(key, analog);
        this.boardPinStates.set(key, analog <= 0 ? 'low' : 'high');
        return analog;
      }
      const rawResistance =
        component.props?.resistance ??
        component.props?.ohms ??
        component.state?.resistance ??
        component.props?.value;
      const resistance = this.parseResistanceValue(rawResistance);
      if (Number.isFinite(resistance) && resistance > 0) {
        const clamped = Math.min(
          Math.max(resistance, PHOTORESISTOR_MIN_OHMS),
          PHOTORESISTOR_MAX_OHMS,
        );
        const ratio =
          (PHOTORESISTOR_MAX_OHMS - clamped) /
          (PHOTORESISTOR_MAX_OHMS - PHOTORESISTOR_MIN_OHMS);
        const analog = Math.round(Math.max(0, Math.min(1, ratio)) * ADC_MAX_VALUE);
        this.boardAnalogLevels.set(key, analog);
        this.boardPinStates.set(key, analog <= 0 ? 'low' : 'high');
        return analog;
      }
    }

    const stored = this.boardAnalogLevels.get(key);
    return Number.isFinite(stored) ? stored : null;
  }

  getComponentPinVoltageOverride(component, pinName) {
    if (!component || !pinName) return null;
    const type = component.type ?? component.id;
    if (type === 'ir-receiver') {
      const pin = String(pinName).toUpperCase();
      if (pin === 'OUT' || pin === 'DAT' || pin === 'DATA') {
        const rawState =
          (component.state && Object.prototype.hasOwnProperty.call(component.state, 'state')
            ? component.state.state
            : undefined) ??
          component.props?.state ??
          'low';
        const normalised = String(rawState).toLowerCase();
        if (normalised === 'high' || normalised === '1' || normalised === 'on') return 'high';
        if (normalised === 'low' || normalised === '0' || normalised === 'off') return 'low';
      }
    }
    if (type === 'photoresistor') {
      const pin = String(pinName).toUpperCase();
      if (pin === 'DO' || pin === 'DIGITAL' || pin === 'OUT') {
        const level = Number(component.state?.lightLevel);
        if (Number.isFinite(level)) {
          return level >= 50 ? 'high' : 'low';
        }
        const rawState = component.props?.resistance ?? component.props?.value ?? null;
        const resistance = this.parseResistanceValue(rawState);
        if (Number.isFinite(resistance) && resistance > 0) {
          const ratio =
            (PHOTORESISTOR_MAX_OHMS -
              Math.min(Math.max(resistance, PHOTORESISTOR_MIN_OHMS), PHOTORESISTOR_MAX_OHMS)) /
            (PHOTORESISTOR_MAX_OHMS - PHOTORESISTOR_MIN_OHMS);
          return ratio >= 0.5 ? 'high' : 'low';
        }
        return 'low';
      }
    }
    return null;
  }

  parseResistanceValue(raw) {
    if (raw === null || typeof raw === 'undefined') return NaN;
    if (typeof raw === 'number') return raw;
    const normalized = String(raw).trim().toLowerCase();
    if (!normalized) return NaN;

    const match = normalized.match(/^([\d.,]+)\s*([a-zµΩ]*)$/i);
    if (!match) return NaN;

    const numericPart = Number.parseFloat(match[1].replace(',', '.'));
    if (!Number.isFinite(numericPart)) return NaN;

    const unit = match[2] ?? '';
    if (!unit) return numericPart;

    if (/(k|kω|kohm|kΩ)/i.test(unit)) return numericPart * 1_000;
    if (/(m|meg|mega|mω|mΩ)/i.test(unit)) return numericPart * 1_000_000;
    if (/(g|gω|gΩ)/i.test(unit)) return numericPart * 1_000_000_000;
    if (/(µ|u)/i.test(unit)) return numericPart / 1_000_000;
    return numericPart;
  }

  parseVoltageValue(raw) {
    if (raw === null || typeof raw === 'undefined') return NaN;
    if (typeof raw === 'number') return raw;
    const normalized = String(raw).trim().toLowerCase();
    if (!normalized) return NaN;
    const match = normalized.match(/^([\d.,]+)\s*([a-zv]*)$/);
    if (!match) return NaN;
    const numericPart = Number.parseFloat(match[1].replace(',', '.'));
    if (!Number.isFinite(numericPart)) return NaN;
    const unit = match[2] ?? '';
    if (!unit || unit === 'v' || unit === 'volt' || unit === 'volts') return numericPart;
    if (unit === 'mv') return numericPart / 1000;
    if (unit === 'kv') return numericPart * 1000;
    return numericPart;
  }

  estimateLedResistance(component) {
    if (!component) return LED_INTERNAL_RESISTANCE;
    const info = getLedColorInfo(component.props?.color);
    if (!info) return LED_INTERNAL_RESISTANCE;
    const vf = (info.forwardVoltageMin + info.forwardVoltageMax) / 2;
    const current = info.maxCurrent || 0.02;
    if (!Number.isFinite(vf) || !Number.isFinite(current) || current <= 0) {
      return LED_INTERNAL_RESISTANCE;
    }
    const ohms = vf / current;
    return Number.isFinite(ohms) && ohms > 0 ? ohms : LED_INTERNAL_RESISTANCE;
  }

  getPotentiometerTotalResistance(component) {
    if (!component) return NaN;
    const rawValue =
      component.props?.resistance ?? component.props?.value ?? component.props?.ohms;
    const parsed = this.parseResistanceValue(rawValue);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
    return 1_000;
  }

  getPotentiometerRatio(component) {
    if (!component) return 0.5;
    const rawValue = Number(component.state?.value);
    if (!Number.isFinite(rawValue)) return 0.5;
    const normalized = Math.max(0, Math.min(100, rawValue));
    return normalized / 100;
  }
}


class Simulation {
  constructor() {
    this.isRunning = false;
    this.canvasManager = null;
    this.animationFrameId = null;
    this.listeners = {
      onStateChange: () => {},
      onError: () => {},
      onLog: () => {},
    };
    this.lastErrorSignature = '';
    this.boardPinStates = new Map();
    this.boardAnalogLevels = new Map();
    this.programState = null;
    this.powerEnabled = false;
    this.audioContext = null;
    this.buzzerAudioNodes = new Map();
  }

  configure(listeners = {}) {
    this.listeners = { ...this.listeners, ...listeners };
  }

  start(canvasManager, options = {}) {
    if (this.isRunning) return;
    this.canvasManager = canvasManager;
    this.isRunning = true;
    this.powerEnabled = true;
    this.clearBoardStates();
    this.listeners.onStateChange?.(true);
    if (options.program) {
      this.startProgram(options.program, {
        boardComponentId: options.boardComponentId,
        onProgramError: options.onProgramError,
      });
    }
    this.loop();
  }

  stop() {
    if (!this.isRunning) return;
    this.isRunning = false;
    this.powerEnabled = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.stopProgram();
    this.resetOutputs();
    this.listeners.onStateChange?.(false);
    this.lastErrorSignature = '';
    this.stopAllBuzzerAudio();
  }

  loop() {
    if (!this.isRunning || !this.canvasManager) return;
    this.evaluate();
    this.animationFrameId = requestAnimationFrame(() => this.loop());
  }

  evaluate() {
    const snapshot = new CircuitSnapshot(this.canvasManager, this.boardPinStates, {
      powerEnabled: this.powerEnabled,
      boardAnalogLevels: this.boardAnalogLevels,
    });
    const ledResults = snapshot.evaluateLEDs();
    const buzzerResults = snapshot.evaluateBuzzers();
    const motorResults = snapshot.evaluateDcMotors();
    const errorMessages = [];

    ledResults.forEach((result) => {
      const brightness = Number.isFinite(result.brightness)
        ? result.brightness
        : result.lightsUp
          ? 1
          : 0;
      this.setLedState(result.component, brightness);
      if (!result.lightsUp && result.reasons.length) {
        errorMessages.push(`LED ${result.component.id}: ${result.reasons.join(', ')}`);
      }
      if (result.damageEvent) {
        const reasonLabel = result.damageReason === 'sobrecorrente' ? 'sobre-corrente' : 'sobre-tensão';
        const message = `LED ${result.component.id}: danificado por ${reasonLabel}`;
        this.listeners.onLog?.({
          message,
          level: 'error',
          timestamp: Date.now(),
        });
      }
    });

    buzzerResults.forEach((result) => {
      this.setBuzzerState(result.component, result.active);
      if (!result.active) {
        const reasons = result.reasons?.filter((reason) => reason && !/Sem alimentação suficiente/i.test(reason));
        if (reasons && reasons.length) {
          this.listeners.onLog?.({
            message: `Buzzer ${result.component.id}: ${reasons.join(', ')}`,
            level: 'warn',
            timestamp: Date.now(),
          });
        }
      }
    });

    if (Array.isArray(snapshot.solverWarnings) && snapshot.solverWarnings.length) {
      snapshot.solverWarnings.forEach((warning) => {
        if (!warning) return;
        this.listeners.onLog?.({
          message: warning,
          level: 'warn',
          timestamp: Date.now(),
        });
      });
    }

    motorResults.forEach((result) => {
      this.setMotorState(result.component, result);
      if (!result.active && result.reasons?.length) {
        errorMessages.push(`Motor ${result.component.id}: ${result.reasons.join(', ')}`);
      }
    });

    this.updateMultimeters(snapshot);

    const signature = errorMessages.sort().join('|');
    if (errorMessages.length && signature !== this.lastErrorSignature) {
      this.listeners.onError?.(errorMessages.join('\n'));
      this.lastErrorSignature = signature;
    }
    if (!errorMessages.length) {
      this.lastErrorSignature = '';
    }
  }

  setLedState(component, brightness) {
    const element = component.element;
    const level = Math.max(0, Math.min(1, Number(brightness) || 0));
    const intensity = Math.round(level * 1023);
    const booleanValue = intensity > 0;
    const isDamaged = Boolean(component.state?.burned);

    if (component.container) {
      component.container.classList.toggle('led-damaged', isDamaged);
    }

    if (isDamaged) {
      element.value = false;
      element.setAttribute('value', '0');
      element.setAttribute('brightness', '0');
      if ('brightness' in element) {
        element.brightness = 0;
      }
      element.setAttribute('data-led-damaged', '1');
      element.style.filter = 'saturate(0%) contrast(120%)';
      return;
    }

    element.value = booleanValue;
    element.setAttribute('value', booleanValue ? '1' : '0');
    element.setAttribute('brightness', String(level));
    if ('brightness' in element) {
        element.brightness = level;
    }
    element.removeAttribute('data-led-damaged');
    element.style.filter = '';
  }

  setBuzzerState(component, active) {
    const element = component.element;
    if (!element) return;
    if (active) {
      element.setAttribute('has-signal', 'true');
      if ('hasSignal' in element) {
        element.hasSignal = true;
      }
      this.startBuzzerAudio(component.id);
    } else {
      element.removeAttribute('has-signal');
      if ('hasSignal' in element) {
        element.hasSignal = false;
      }
      this.stopBuzzerAudio(component.id);
    }
  }

  setMotorState(component, state = {}) {
    const element = component.element;
    if (!element || !element.__motorVisual) return;
    const { rotor, spinner, speedLabel } = element.__motorVisual;
    const rpm = Math.max(0, Number(state.rpm) || 0);
    const direction = Math.sign(Number(state.direction) || 0);
    const active = Boolean(state.active) && rpm > 1;

    if (!component.state) component.state = {};
    component.state.motor = {
      rpm,
      direction,
      current: Number(state.current) || 0,
      voltage: Number(state.voltage) || 0,
    };

    if (active) {
      rotor.classList.add('active');
      rotor.classList.toggle('reverse', direction < 0);
      const duration = Math.max(0.12, 60 / Math.max(rpm, 1));
      rotor.style.setProperty('--motor-spin-duration', `${duration}s`);
      speedLabel.textContent = `${Math.round(rpm)} RPM`;
      speedLabel.classList.add('visible');
    } else {
      rotor.classList.remove('active', 'reverse');
      rotor.style.removeProperty('--motor-spin-duration');
      speedLabel.textContent = '0 RPM';
      speedLabel.classList.remove('visible');
    }
  }

  ensureAudioContext() {
    if (typeof window === 'undefined') return null;
    if (!('AudioContext' in window || 'webkitAudioContext' in window)) {
      return null;
    }
    if (!this.audioContext) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      try {
        this.audioContext = new Ctx();
      } catch {
        this.audioContext = null;
      }
    }
    if (this.audioContext?.state === 'suspended') {
      try {
        this.audioContext.resume();
      } catch {}
    }
    return this.audioContext;
  }

  startBuzzerAudio(componentId) {
    if (!this.isRunning || !this.powerEnabled) return;
    if (this.buzzerAudioNodes.has(componentId)) {
      const node = this.buzzerAudioNodes.get(componentId);
      if (node?.gain && node.ctx) {
        node.gain.gain.cancelScheduledValues(node.ctx.currentTime);
        node.gain.gain.setTargetAtTime(0.05, node.ctx.currentTime, 0.02);
      }
      return;
    }

    const ctx = this.ensureAudioContext();
    if (!ctx) return;

    const oscillator = ctx.createOscillator();
    oscillator.type = 'square';
    oscillator.frequency.value = 1000;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start();
    gain.gain.setTargetAtTime(0.05, ctx.currentTime, 0.02);

    this.buzzerAudioNodes.set(componentId, { ctx, oscillator, gain });
  }

  stopBuzzerAudio(componentId) {
    const entry = this.buzzerAudioNodes.get(componentId);
    if (!entry) return;
    try {
      entry.gain?.gain.cancelScheduledValues(entry.ctx.currentTime);
      entry.gain?.gain.setTargetAtTime(0, entry.ctx.currentTime, 0.02);
      const stopTime = entry.ctx.currentTime + 0.1;
      entry.oscillator?.stop(stopTime);
      window.setTimeout(() => {
        try {
          entry.oscillator?.disconnect();
          entry.gain?.disconnect();
        } catch {}
      }, 200);
    } catch {}
    this.buzzerAudioNodes.delete(componentId);
  }

  stopAllBuzzerAudio() {
    this.buzzerAudioNodes.forEach((_, id) => this.stopBuzzerAudio(id));
    this.buzzerAudioNodes.clear();
  }

  updateMultimeters(snapshot) {
    if (!this.canvasManager) return;
    this.canvasManager.components
      .filter((component) => component.type === 'multimeter')
      .forEach((component) => this.updateMultimeter(component, snapshot));
  }

  updateMultimeter(component, snapshot) {
    const displayElement = component.element?.__displayElement;
    if (!displayElement) return;

    const positiveNode = snapshot.getNodeByComponentPin(component.id, 'V+');
    const negativeNode = snapshot.getNodeByComponentPin(component.id, 'V-');

    if (!positiveNode || !negativeNode) {
      displayElement.textContent = '---';
      return;
    }

    const mode = String(component.props?.mode ?? 'tensão').toLowerCase();
    const voltagePlus = snapshot.estimateNodeVoltage(positiveNode);
    const voltageMinus = snapshot.estimateNodeVoltage(negativeNode);
    const voltage = voltagePlus - voltageMinus;

    if (mode === 'resistência') {
      if (!Number.isFinite(voltage)) {
        displayElement.textContent = '---';
        if (component.state) {
          delete component.state.lastResistance;
        }
        return;
      }

      if (Math.abs(voltage) > 0.05) {
        displayElement.textContent = 'TENSÃO!';
        if (component.state) {
          delete component.state.lastResistance;
        }
        return;
      }

      const resistance = snapshot.computeResistanceBetweenNodes(positiveNode, negativeNode);
      component.state = component.state ?? {};
      component.state.lastResistance = Number.isFinite(resistance) ? resistance : Infinity;

      if (!Number.isFinite(resistance) || resistance > 1e9) {
        displayElement.textContent = 'OL';
        return;
      }

      displayElement.textContent = this.formatResistance(resistance);
      return;
    }

    if (!Number.isFinite(voltage)) {
      displayElement.textContent = '---';
      if (component.state) {
        delete component.state.lastVoltage;
      }
      return;
    }

    displayElement.textContent = `${voltage.toFixed(2)} V`;
    component.state = component.state ?? {};
    component.state.lastVoltage = voltage;
    if (component.state) {
      delete component.state.lastResistance;
    }
  }

  resetMultimeter(component) {
    const displayElement = component.element?.__displayElement;
    if (displayElement) {
      displayElement.textContent = '---';
    }
    if (component.state) {
      delete component.state.lastVoltage;
      delete component.state.lastResistance;
    }
  }

  resetOutputs() {
    this.clearBoardStates();
    if (!this.canvasManager) return;
    this.canvasManager.components.forEach((component) => {
      if (component.type === 'led') {
        if (component.state) {
          delete component.state.burned;
          delete component.state.burnReason;
          delete component.state.burnedAt;
        }
        this.setLedState(component, 0);
      } else if (component.type === 'buzzer') {
        this.setBuzzerState(component, false);
      } else if (component.type === 'dc-motor') {
        if (component.state) {
          delete component.state.motor;
        }
        this.setMotorState(component, { active: false, rpm: 0, direction: 0 });
      } else if (component.type === 'multimeter') {
        this.resetMultimeter(component);
      }
    });
  }

  clearBoardStates() {
    this.boardPinStates.clear();
    this.boardAnalogLevels.clear();
  }

  startProgram(program, options = {}) {
    if (typeof program !== 'function') return;
    const { boardComponentId, onProgramError } = options;
    if (!boardComponentId) {
      onProgramError?.('Nenhuma placa Amado ESP32 selecionada para executar o programa.');
      return;
    }

    if (!this.canvasManager?.getComponentById(boardComponentId)) {
      onProgramError?.('Placa alvo não encontrada no workspace.');
      return;
    }

    this.stopProgram();

    const programState = {
      aborted: false,
      timers: new Set(),
      rejectors: new Set(),
      boardComponentId,
      onProgramError,
    };

    const abortError = new Error('Programa interrompido.');
    abortError.name = 'ProgramAbortError';
    programState.abortError = abortError;

    const api = {
      setPin: async (pinName, level) => {
        if (programState.aborted) return;
        try {
          const result = this.setBoardPinState(programState.boardComponentId, pinName, level);
          await this.waitNextAnimationFrame();
          return result;
        } catch (error) {
          const message = error?.message ?? String(error);
          programState.onProgramError?.(message);
          throw error;
        }
      },
      wait: (milliseconds) => {
        if (programState.aborted) {
          return Promise.reject(abortError);
        }
        const duration = Number(milliseconds);
        if (!Number.isFinite(duration) || duration < 0) {
          const message = 'Valor inválido no bloco "aguardar". O tempo deve ser um número positivo.';
          programState.onProgramError?.(message);
          return Promise.reject(new Error(message));
        }
        return new Promise((resolve, reject) => {
          const timerId = window.setTimeout(() => {
            cleanup();
            resolve();
          }, duration);

          const cleanup = () => {
            window.clearTimeout(timerId);
            programState.timers.delete(timerId);
            programState.rejectors.delete(rejector);
          };

          const rejector = (error = abortError) => {
            cleanup();
            reject(error);
          };

          programState.timers.add(timerId);
          programState.rejectors.add(rejector);
        });
      },
      readDigital: async (pinName) => {
        if (programState.aborted) {
          return Promise.reject(abortError);
        }
        try {
          const state = this.getBoardPinVoltageState(programState.boardComponentId, pinName);
          return state === 'high';
        } catch (error) {
          const message = error?.message ?? String(error);
          programState.onProgramError?.(message);
          throw error;
        }
      },
      readAnalog: async (pinName) => {
        if (programState.aborted) {
          return Promise.reject(abortError);
        }
        try {
          this.requireSignalPinElement(programState.boardComponentId, pinName);
          const snapshot = this.createSnapshot();
          const analogValue = this.getBoardPinAnalogValue(
            programState.boardComponentId,
            pinName,
            snapshot,
          );
          if (typeof analogValue === 'number') {
            return analogValue;
          }
          const state = snapshot.resolveVoltageForBoardPin(
            programState.boardComponentId,
            pinName,
          );
          return this.convertVoltageStateToAnalogValue(state);
        } catch (error) {
          const message = error?.message ?? String(error);
          programState.onProgramError?.(message);
          throw error;
        }
      },
      log: async (...args) => {
        if (programState.aborted) return;
        const [first, ...rest] = args;
        const entry =
          typeof first === 'string'
            ? { message: first, args: rest, timestamp: Date.now(), level: 'info' }
            : { message: '', args, timestamp: Date.now(), level: 'info' };
        this.listeners.onLog?.(entry);
        console.log('[Blockly]', ...args);
      },
    };

    this.programState = programState;

    programState.promise = Promise.resolve()
      .then(() => program(api))
      .then(() => {
        if (!programState.aborted) {
          this.listeners.onLog?.({
            message: 'Programa concluído.',
            timestamp: Date.now(),
            level: 'info',
          });
        }
      })
      .catch((error) => {
        if (programState.aborted) return;
        const message =
          error?.name === 'ProgramAbortError'
            ? null
            : error?.message ?? String(error);
        if (message) {
          const formatted = `Erro no programa: ${message}`;
          this.listeners.onLog?.({
            message: formatted,
            timestamp: Date.now(),
            level: 'error',
          });
          programState.onProgramError?.(formatted);
          window.setTimeout(() => this.stop(), 0);
        }
      })
      .finally(() => {
        if (this.programState === programState) {
          this.stopProgram();
        }
      });

    return programState.promise;
  }

  stopProgram() {
    if (!this.programState) return;
    const state = this.programState;
    state.aborted = true;

    const timers = Array.from(state.timers);
    timers.forEach((timerId) => window.clearTimeout(timerId));
    state.timers.clear();

    const rejectors = Array.from(state.rejectors);
    state.rejectors.clear();
    rejectors.forEach((reject) => {
      try {
        reject(state.abortError);
      } catch {
        // Ignora erros ao rejeitar promessas já resolvidas.
      }
    });

    this.programState = null;
  }

  setBoardPinState(componentId, pinName, level) {
    if (!this.canvasManager) {
      throw new Error('Simulação não inicializada.');
    }

    this.requireSignalPinElement(componentId, pinName);

    const analogCandidate = this.tryParseAnalogLevel(level);
    if (analogCandidate !== null) {
      return this.setBoardPinAnalogLevel(componentId, pinName, analogCandidate);
    }

    const normalized = this.normalizePinLevel(level);
    const key = this.getBoardPinKey(componentId, pinName);

    if (normalized === 'floating') {
      this.boardPinStates.delete(key);
      this.boardAnalogLevels.delete(key);
      return normalized;
    }

    this.boardPinStates.set(key, normalized);
    this.boardAnalogLevels.set(key, normalized === 'high' ? 4095 : 0);

    return normalized;
  }

  normalizePinLevel(level) {
    if (typeof level === 'boolean') {
      return level ? 'high' : 'low';
    }
    if (typeof level === 'string') {
      const value = level.trim().toLowerCase();
      if (['high', 'alto', '1', 'true', 'on', 'vcc', '3v3', '5v', '5', '3v'].includes(value)) {
        return 'high';
      }
      if (['low', 'baixo', '0', 'false', 'off', 'gnd', 'ground'].includes(value)) {
        return 'low';
      }
      if (['float', 'floating', 'liberar', 'input', 'tri-state', 'tristate'].includes(value)) {
        return 'floating';
      }
    }
    return 'floating';
  }

  tryParseAnalogLevel(level) {
    if (typeof level === 'number' && Number.isFinite(level)) {
      return level;
    }
    if (typeof level === 'string') {
      const value = level.trim();
      if (!value) return null;
      const normalized = value.replace(',', '.');
      if (/^[-+]?\d+(\.\d+)?$/.test(normalized)) {
        const numeric = Number(normalized);
        return Number.isFinite(numeric) ? numeric : null;
      }
    }
    return null;
  }

  setBoardPinAnalogLevel(componentId, pinName, level) {
    const key = this.getBoardPinKey(componentId, pinName);
    const analogLevel = this.normalizeAnalogLevel(level);
    this.boardAnalogLevels.set(key, analogLevel);
    const digitalState = analogLevel <= 0 ? 'low' : 'high';
    this.boardPinStates.set(key, digitalState);
    return analogLevel;
  }

  normalizeAnalogLevel(level) {
    const numeric = Number(level);
    if (!Number.isFinite(numeric)) {
      throw new Error('Valor analógico inválido.');
    }
    return Math.max(0, Math.min(4095, Math.round(numeric)));
  }

  getBoardPinKey(componentId, pinName) {
    return `${componentId}:${pinName}`;
  }

  getBoardPinVoltageState(componentId, pinName) {
    const pinElement = this.requireSignalPinElement(componentId, pinName);
    if (!pinElement) {
      return 'floating';
    }
    const snapshot = this.createSnapshot();
    return snapshot.resolveVoltageForBoardPin(componentId, pinName);
  }

  getBoardPinAnalogValue(componentId, pinName, snapshot = null) {
    if (!this.canvasManager) {
      throw new Error('Simulação não inicializada.');
    }

    const circuitSnapshot = snapshot ?? this.createSnapshot();
    const boardNode = circuitSnapshot.getNodeByComponentPin(componentId, pinName);
    if (!boardNode) {
      return null;
    }

    const visited = new Set([boardNode.id]);
    const queue = [boardNode];

    while (queue.length) {
      const node = queue.shift();

      if (Number.isFinite(node.analogLevel)) {
        const clamped = Math.max(0, Math.min(4095, Math.round(node.analogLevel)));
        return clamped;
      }

      if (this.isPotentiometerWiperNode(node)) {
        const analogValue = this.computePotentiometerAnalogValue(circuitSnapshot, node);
        if (Number.isFinite(analogValue)) {
          const clamped = Math.max(0, Math.min(4095, Math.round(analogValue)));
          return clamped;
        }
      }

      node.connections.forEach((neighbor) => {
        if (!visited.has(neighbor.id)) {
          visited.add(neighbor.id);
          queue.push(neighbor);
        }
      });
    }

    return null;
  }

  isPotentiometerWiperNode(node) {
    if (!node || node.componentType !== 'potentiometer') {
      return false;
    }
    const pinName = (node.pinName ?? '').toUpperCase();
    if (pinName) {
      return pinName === 'SIG' || pinName === 'WIPER' || pinName === 'OUT';
    }
    return node.pinIndex === 1;
  }

  computePotentiometerAnalogValue(snapshot, wiperNode) {
    if (!snapshot || !wiperNode) {
      return null;
    }

    const component = wiperNode.component;
    if (!component) {
      return null;
    }

    const rawValue = Number(component.state?.value);
    const normalized = Number.isFinite(rawValue) ? Math.max(0, Math.min(100, rawValue)) : 50;
    const ratio = normalized / 100;

    const componentId = wiperNode.componentId;
    const startNode =
      snapshot.getNodeByComponentPin(componentId, 'GND') ??
      snapshot.getNodeByComponentIndex(componentId, 0);
    const endNode =
      snapshot.getNodeByComponentPin(componentId, 'VCC') ??
      snapshot.getNodeByComponentIndex(componentId, 2);

    const startLevel = this.resolveNodeAnalogLevel(snapshot, startNode);
    const endLevel = this.resolveNodeAnalogLevel(snapshot, endNode);

    const hasStart = Number.isFinite(startLevel);
    const hasEnd = Number.isFinite(endLevel);

    if (hasStart && hasEnd) {
      return startLevel + (endLevel - startLevel) * ratio;
    }
    if (hasStart) {
      return startLevel;
    }
    if (hasEnd) {
      return endLevel;
    }
    return null;
  }

  resolveNodeAnalogLevel(snapshot, node) {
    if (!snapshot || !node) {
      return null;
    }
    if (typeof snapshot.resolveAnalogLevel === 'function') {
      const analogLevel = snapshot.resolveAnalogLevel(node);
      if (Number.isFinite(analogLevel)) {
        return analogLevel;
      }
    }
    const state = snapshot.resolveVoltageForNode(node);
    if (state === 'high') {
      return 4095;
    }
    if (state === 'low') {
      return 0;
    }
    return null;
  }

  convertVoltageStateToAnalogValue(state) {
    switch (state) {
      case 'high':
        return 4095;
      case 'low':
        return 0;
      default:
        return 2048;
    }
  }

  formatResistance(value) {
    if (!Number.isFinite(value)) return 'OL';
    const abs = Math.abs(value);
    if (abs < 1e-6) return '0 Ω';
    if (abs >= 1_000_000) {
      const scaled = abs / 1_000_000;
      const decimals = Number.isInteger(scaled) ? 0 : 2;
      return `${scaled.toFixed(decimals)} MΩ`;
    }
    if (abs >= 1_000) {
      const scaled = abs / 1_000;
      const decimals = Number.isInteger(scaled) ? 0 : 2;
      return `${scaled.toFixed(decimals)} kΩ`;
    }
    if (abs >= 1) {
      const decimals = abs >= 10 ? 1 : 2;
      return `${abs.toFixed(decimals)} Ω`;
    }
    const scaled = abs * 1_000;
    const decimals = scaled >= 10 ? 1 : 2;
    return `${scaled.toFixed(decimals)} mΩ`;
  }

  waitNextAnimationFrame() {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
        resolve();
        return;
      }
      window.requestAnimationFrame(() => resolve());
    });
  }

  createSnapshot() {
    if (!this.canvasManager) {
      throw new Error('Simulação não inicializada.');
    }
    return new CircuitSnapshot(this.canvasManager, this.boardPinStates, {
      powerEnabled: this.powerEnabled,
      boardAnalogLevels: this.boardAnalogLevels,
    });
  }

  requireBoardComponent(componentId) {
    if (!this.canvasManager) {
      throw new Error('Simulação não inicializada.');
    }

    const component = this.canvasManager.getComponentById(componentId);
    if (!component) {
      throw new Error('Placa alvo não encontrada no workspace.');
    }

    if (component.type !== 'amado-board' && component.type !== 'esp32') {
      throw new Error('O programa só pode controlar placas compatíveis (Amado ESP32).');
    }

    return component;
  }

  requireSignalPinElement(componentId, pinName) {
    const component = this.requireBoardComponent(componentId);
    const pins = this.canvasManager.wiringManager.getPinsForComponent(componentId) ?? [];
    const pinElement = pins.find((pin) => pin.dataset.pinName === pinName);

    if (!pinElement) {
      if (component.type === 'amado-board' || component.type === 'esp32') {
        throw new Error(`Pino "${pinName}" não foi encontrado na placa selecionada.`);
      }
      return null;
    }

    if (pinElement.dataset.pinType !== 'signal') {
      throw new Error('Somente pinos de sinal podem ser controlados ou lidos via Blockly.');
    }

    return pinElement;
  }
}

export const simulation = new Simulation();
