import { getLedColorInfo } from './components.js';

const ADC_MAX_VALUE = 4095;
const DEFAULT_SUPPLY_VOLTAGE = 3.3;
const LED_INTERNAL_RESISTANCE = 120; // Ohms – aproxima resistência interna / fios
const CURRENT_WARNING_FACTOR = 1.3;
const CURRENT_DANGER_FACTOR = 2.5;
const VOLTAGE_WARNING_FACTOR = 1.15;
const VOLTAGE_DANGER_FACTOR = 1.6;

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
    this.buildPinNodes();
    this.buildConnections();
  }

  buildPinNodes() {
    this.canvasManager.components.forEach((component) => {
      const pins = this.canvasManager.wiringManager.getPinsForComponent(component.id);
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
        };
        const overrideState = this.getComponentPinVoltageOverride(component, node.pinName);
        if (overrideState) {
          node.voltageState = overrideState;
        }
        this.pinNodes.set(key, node);

        const mapKey = this.getComponentPinKey(component.id, pinElement.dataset.pinName);
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
            reasons: ['LED sem conexões suficientes'],
          });
          return;
        }

        const anode = pins.find((pin) => pin.pinType === 'power') ?? pins[0];
        const cathode = pins.find((pin) => pin.pinType === 'ground') ?? pins[1];

        const powerPath = this.findPath(anode, (node) =>
          this.isPowerNode(node) && node.componentId !== component.id,
        );

        const groundPath = this.findPath(cathode, (node) =>
          this.isGroundNode(node) && node.componentId !== component.id,
        );

        const powerExists = powerPath.exists;
        const groundExists = groundPath.exists;
        const directSupplyCandidate = this.getComponentSupplyCandidate(anode.component, component.id);
        const supplyVoltage = Math.max(
          directSupplyCandidate ? this.getComponentSupplyVoltage(directSupplyCandidate) : 0,
          this.resolveSupplyVoltage(powerPath.sources),
        );
        const resistanceInfo = this.computeSeriesResistance(
          [...(powerPath.resistors ?? []), ...(groundPath.resistors ?? [])],
        );
        const hasResistor = resistanceInfo.total > 0;
        const anodeConnectedToBoardSignal = this.hasConnectionToBoardSignal(anode);
        const cathodeConnectedToBoardSignal = this.hasConnectionToBoardSignal(cathode);

        const anodeLevel = this.resolveAnalogLevel(anode);
        const cathodeLevel = this.resolveAnalogLevel(cathode);
        const analogLevelsKnown = Number.isFinite(anodeLevel) && Number.isFinite(cathodeLevel);

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
        const forwardVoltageNominal = (forwardVoltageMin + forwardVoltageMax) / 2;

        const totalResistance = Math.max(resistanceInfo.total, 0);
        const resistanceForCurrent =
          totalResistance > 0 ? totalResistance : LED_INTERNAL_RESISTANCE;
        const effectiveResistance = resistanceForCurrent;

        const analogDelta = analogLevelsKnown ? Math.abs(anodeLevel - cathodeLevel) : null;
        const driveRatio = analogLevelsKnown
          ? Math.max(0, Math.min(1, analogDelta / ADC_MAX_VALUE))
          : (powerExists || anodeConnectedToBoardSignal) && (groundExists || cathodeConnectedToBoardSignal)
            ? 1
            : 0;

        const effectiveSupplyVoltage = supplyVoltage * driveRatio;

        let currentEstimate = 0;
        let voltageDrop = 0;
        let brightness = 0;

        const hasDrivePath =
          (powerExists || anodeConnectedToBoardSignal) &&
          (groundExists || cathodeConnectedToBoardSignal);

        if (hasDrivePath && effectiveSupplyVoltage > 0) {
          if (effectiveSupplyVoltage <= forwardVoltageMin) {
            voltageDrop = effectiveSupplyVoltage;
            brightness = 0;
          } else {
            const voltageAcrossResistors = Math.max(0, effectiveSupplyVoltage - forwardVoltageNominal);
            currentEstimate = voltageAcrossResistors / resistanceForCurrent;
            const dropAcrossResistors = currentEstimate * totalResistance;
            const computedDrop = effectiveSupplyVoltage - dropAcrossResistors;
            voltageDrop = Math.min(
              effectiveSupplyVoltage,
              Math.max(forwardVoltageMin, computedDrop),
            );
            brightness = Math.max(
              0,
              Math.min(1, currentEstimate / (colorInfo.maxCurrent || 0.02)),
            );
          }
        }

        const voltageWarning =
          voltageDrop > colorInfo.forwardVoltageMax * VOLTAGE_WARNING_FACTOR;
        const voltageDanger =
          voltageDrop > colorInfo.forwardVoltageMax * VOLTAGE_DANGER_FACTOR;

        const currentWarning =
          currentEstimate > colorInfo.maxCurrent * CURRENT_WARNING_FACTOR;
        const currentDanger =
          currentEstimate > colorInfo.maxCurrent * CURRENT_DANGER_FACTOR;

        let damageEvent = false;
        if (!state.burned && voltageDrop > 0 && (voltageDanger || currentDanger)) {
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
        if (!powerPath.exists && !anodeConnectedToBoardSignal) {
          reasons.push('Sem ligação de VCC');
        }
        if (!groundPath.exists && !cathodeConnectedToBoardSignal) {
          reasons.push('Sem ligação de GND');
        }
        if (!isBurned && lightsUp && !hasResistor) {
          reasons.push('Falta resistor em série (iluminação sem proteção)');
        }
        if (isBurned) {
          const reasonLabel = state.burnReason === 'sobrecorrente' ? 'sobre-corrente' : 'sobre-tensão';
          reasons.push(`LED danificado por ${reasonLabel}`);
        } else {
          if (voltageWarning) {
            reasons.push(`Aviso: queda de tensão ${voltageDrop.toFixed(2)} V acima do ideal`);
          }
          if (currentWarning && Number.isFinite(currentEstimate)) {
            reasons.push(`Aviso: corrente estimada ${(currentEstimate * 1000).toFixed(1)} mA acima do ideal`);
          }
        }
        if (!lightsUp && hasDrivePath && effectiveSupplyVoltage > 0 && effectiveSupplyVoltage <= forwardVoltageMin) {
          reasons.push('Tensão insuficiente para polarizar o LED');
        }

        results.push({
          component,
          lightsUp,
          brightness,
          voltageDrop,
          supplyVoltage,
          seriesResistance: totalResistance,
          effectiveResistance,
          currentEstimate,
          damageEvent,
          damageReason: state.burnReason ?? null,
          warnings: !isBurned ? {
            voltage: voltageWarning,
            current: currentWarning,
          } : null,
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

  findPath(startNode, predicate) {
    const queue = [];
    const visited = new Set();

    const startSupplyComponent = this.getComponentSupplyCandidate(startNode.component);
    const startSources = startSupplyComponent ? [startSupplyComponent] : [];
    queue.push({
      node: startNode,
      resistorIncluded: false,
      resistors: [],
      sources: startSources,
      leds: [],
    });
    visited.add(`${startNode.id}:0`);

    while (queue.length) {
      const { node, resistorIncluded, resistors, sources, leds } = queue.shift();
      if (node !== startNode && predicate(node)) {
        return {
          exists: true,
          resistorIncluded,
          resistors,
          sources,
          leds,
        };
      }

      node.connections.forEach((neighbor) => {
        const sameComponent = neighbor.componentId && neighbor.componentId === node.componentId;
        const neighborType = neighbor.componentType;
        const neighborIsResistor = sameComponent && (neighborType === 'resistor' || neighborType === 'photoresistor');
        const neighborIsPotentiometer = sameComponent && neighbor.componentType === 'potentiometer';
        const neighborIsLed = sameComponent && neighbor.componentType === 'led';

        const resistorEntry = neighborIsResistor && neighbor.component
          ? this.createResistorEntry(neighbor.component)
          : null;

        const potentiometerEntry = neighborIsPotentiometer
          ? this.createPotentiometerSegmentEntry(node, neighbor)
          : null;

        const neighborResistorIncluded =
          resistorIncluded || Boolean(resistorEntry) || Boolean(potentiometerEntry);

        const stateKey = `${neighbor.id}:${neighborResistorIncluded ? 1 : 0}`;
        if (visited.has(stateKey)) return;
        visited.add(stateKey);

        const nextResistors = [...resistors];
        if (resistorEntry) {
          nextResistors.push(resistorEntry);
        }
        if (potentiometerEntry) {
          nextResistors.push(potentiometerEntry);
        }

        const supplyCandidate = this.getComponentSupplyCandidate(neighbor.component);
        const nextSources = supplyCandidate
          ? [...sources, supplyCandidate]
          : [...sources];

        const nextLeds = neighborIsLed && neighbor.component
          ? [...leds, neighbor.component]
          : [...leds];

        queue.push({
          node: neighbor,
          resistorIncluded: neighborResistorIncluded,
          resistors: nextResistors,
          sources: nextSources,
          leds: nextLeds,
        });
      });
    }

    return {
      exists: false,
      resistorIncluded: false,
      resistors: [],
      sources: [],
      leds: [],
    };
  }

  computeSeriesResistance(resistorEntries = []) {
    const unique = new Map();
    resistorEntries.forEach((entry) => {
      if (!entry) return;
      const key = entry.id ?? entry.component?.id;
      if (!key) return;
      if (!unique.has(key)) {
        unique.set(key, entry);
      }
    });

    let total = 0;
    const contributing = [];

    unique.forEach((entry) => {
      const { resistance, component } = this.resolveResistanceEntry(entry);
      if (Number.isFinite(resistance) && resistance > 0) {
        total += resistance;
        contributing.push({ component, ohms: resistance, entry });
      }
    });

    return {
      total,
      components: contributing,
    };
  }

  computePathResistance(pathResult, options = {}) {
    if (!pathResult) return 0;
    const { includeLed = false } = options;
    let total = 0;

    const resistorUnique = new Map();
    (pathResult.resistors ?? []).forEach((entry) => {
      if (!entry) return;
      const key = entry.id ?? entry.component?.id;
      if (!key) return;
      if (!resistorUnique.has(key)) {
        resistorUnique.set(key, entry);
      }
    });

    resistorUnique.forEach((entry) => {
      const { resistance } = this.resolveResistanceEntry(entry);
      if (Number.isFinite(resistance) && resistance > 0) {
        total += resistance;
      }
    });

    if (includeLed) {
      const ledUnique = new Map();
      (pathResult.leds ?? []).forEach((component) => {
        if (!component || !component.id) return;
        if (!ledUnique.has(component.id)) {
          ledUnique.set(component.id, component);
        }
      });

      ledUnique.forEach((component) => {
        const ledResistance = this.estimateLedResistance(component);
        if (Number.isFinite(ledResistance) && ledResistance > 0) {
          total += ledResistance;
        }
      });
    }

    return total;
  }

  createResistorEntry(component) {
    if (!component || !component.id) return null;
    const type = component.type ?? component.id;
    if (type !== 'resistor' && type !== 'photoresistor') {
      return null;
    }
    return {
      id: `${type}:${component.id}`,
      type,
      component,
    };
  }

  createPotentiometerSegmentEntry(nodeA, nodeB) {
    if (!nodeA || !nodeB) return null;
    const component = nodeA.component;
    if (!component || component !== nodeB.component) return null;
    if ((component.type ?? component.id) !== 'potentiometer') return null;

    const fromIndex = Number(nodeA.pinIndex);
    const toIndex = Number(nodeB.pinIndex);
    if (!Number.isFinite(fromIndex) || !Number.isFinite(toIndex) || fromIndex === toIndex) {
      return null;
    }

    const low = Math.min(fromIndex, toIndex);
    const high = Math.max(fromIndex, toIndex);
    const segmentKey = `${low}-${high}`;

    return {
      id: `pot:${component.id}:${segmentKey}`,
      type: 'potentiometer-segment',
      component,
      fromIndex,
      toIndex,
    };
  }

  resolveResistanceEntry(entry) {
    if (!entry) {
      return { resistance: NaN, component: null };
    }

    if (entry.type === 'resistor' || entry.type === 'photoresistor') {
      const component = entry.component;
      if (!component) {
        return { resistance: NaN, component: null };
      }
      const rawValue =
        component.props?.resistance ??
        component.props?.value ??
        component.props?.ohms ??
        component.state?.resistance;
      const ohms = this.parseResistanceValue(rawValue);
      return { resistance: ohms, component };
    }

    if (entry.type === 'potentiometer-segment') {
      const component = entry.component;
      const ohms = this.getPotentiometerSegmentResistance(
        component,
        entry.fromIndex,
        entry.toIndex,
      );
      return { resistance: ohms, component };
    }

    if (entry.component) {
      const rawValue =
        entry.component.props?.value ??
        entry.component.props?.resistance ??
        entry.component.props?.ohms;
      const ohms = this.parseResistanceValue(rawValue);
      return { resistance: ohms, component: entry.component };
    }

    return { resistance: NaN, component: null };
  }

  getPotentiometerSegmentResistance(component, fromIndex, toIndex) {
    if (!component) return NaN;
    const total = this.getPotentiometerTotalResistance(component);
    if (!Number.isFinite(total)) return NaN;

    const ratio = this.getPotentiometerRatio(component);

    const pair = new Set([fromIndex, toIndex]);
    if (pair.has(0) && pair.has(2)) {
      return total;
    }
    if (pair.has(0) && pair.has(1)) {
      return total * ratio;
    }
    if (pair.has(1) && pair.has(2)) {
      return total * (1 - ratio);
    }
    return 0;
  }

  getPotentiometerTotalResistance(component) {
    if (!component) return NaN;
    const rawValue =
      component.props?.resistance ?? component.props?.value ?? component.props?.ohms;
    const parsed = this.parseResistanceValue(rawValue);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
    return 1_000; // fallback padrão
  }

  getPotentiometerRatio(component) {
    if (!component) return 0.5;
    const rawValue = Number(component.state?.value);
    if (!Number.isFinite(rawValue)) {
      return 0.5;
    }
    const normalized = Math.max(0, Math.min(100, rawValue));
    return normalized / 100;
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

    if (/(k|kω|kohm|kΩ)/i.test(unit)) {
      return numericPart * 1_000;
    }
    if (/(m|meg|mega|mω|mΩ)/i.test(unit)) {
      return numericPart * 1_000_000;
    }
    if (/(g|gω|gΩ)/i.test(unit)) {
      return numericPart * 1_000_000_000;
    }
    if (/(µ|u)/i.test(unit)) {
      return numericPart / 1_000_000;
    }
    return numericPart;
  }

  resolveSupplyVoltage(sources = []) {
    let supply = 0;
    sources.forEach((component) => {
      if (!component) return;
      const candidateVoltage = this.getComponentSupplyVoltage(component);
      if (candidateVoltage > supply) {
        supply = candidateVoltage;
      }
    });
    return supply > 0 ? supply : DEFAULT_SUPPLY_VOLTAGE;
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

  resolveSupplyVoltageForNode(node, excludeComponentId) {
    if (!node) return DEFAULT_SUPPLY_VOLTAGE;

    const component = node.component;
    if (component?.type === 'battery') {
      const parsed = this.parseVoltageValue(component.props?.voltage ?? component.props?.value);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }

    let directSupply = 0;
    const directCandidate = this.getComponentSupplyCandidate(component, excludeComponentId);
    if (directCandidate) {
      directSupply = this.getComponentSupplyVoltage(directCandidate);
    }

    const path = this.findPath(node, (neighbor) =>
      neighbor.componentId !== excludeComponentId && this.isPowerReferenceNode(neighbor),
    );
    const pathSupply = this.resolveSupplyVoltage(path.sources);
    const supply = Math.max(directSupply, pathSupply);
    return supply > 0 ? supply : DEFAULT_SUPPLY_VOLTAGE;
  }

  hasPath(startNode, predicate) {
    const queue = [startNode];
    const visited = new Set([startNode.id]);

    while (queue.length) {
      const node = queue.shift();
      if (node !== startNode && predicate(node)) {
        return true;
      }

      node.connections.forEach((neighbor) => {
        if (!visited.has(neighbor.id)) {
          visited.add(neighbor.id);
          queue.push(neighbor);
        }
      });
    }

    return false;
  }

  isPowerNode(node) {
    if (!this.powerEnabled) {
      return node.voltageState === 'high';
    }
    return node.pinType === 'power' || node.voltageState === 'high';
  }

  isPowerSourceNode(node) {
    const component = node?.component;
    if (!component) return false;
    const type = component.type ?? component.id;
    return type === 'battery' || type === 'amado-board' || type === 'esp32';
  }

  isPowerReferenceNode(node) {
    if (!node) return false;
    const componentType = node.component?.type ?? node.componentId;
    const pinType = node.pinType ?? 'signal';

    if (componentType === 'battery') {
      return pinType === 'power';
    }

    if (componentType === 'amado-board' || componentType === 'esp32') {
      if (pinType === 'power') return true;
      if (pinType === 'signal' && node.voltageState === 'high') return true;
    }

    return false;
  }

  isGroundReferenceNode(node) {
    if (!node) return false;
    const componentType = node.component?.type ?? node.componentId;
    const pinType = node.pinType ?? 'signal';

    if (componentType === 'battery') {
      return pinType === 'ground';
    }

    if (componentType === 'amado-board' || componentType === 'esp32') {
      if (pinType === 'ground') return true;
      if (pinType === 'signal' && node.voltageState === 'low') return true;
    }

    return false;
  }

  getComponentSupplyCandidate(component, excludeComponentId) {
    if (!component) return null;
    if (excludeComponentId && component.id === excludeComponentId) return null;
    const type = component.type ?? component.id;
    if (type === 'battery' || type === 'amado-board' || type === 'esp32') {
      return component;
    }
    return null;
  }

  getComponentSupplyVoltage(component) {
    if (!component) return 0;
    const type = component.type ?? component.id;
    if (type === 'battery') {
      const parsed = this.parseVoltageValue(component.props?.voltage ?? component.props?.value);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SUPPLY_VOLTAGE;
    }
    if (type === 'amado-board' || type === 'esp32') {
      return DEFAULT_SUPPLY_VOLTAGE;
    }
    return 0;
  }

  getComponentPinVoltageOverride(component, pinName) {
    if (!component || !pinName) return null;
    const type = component.type ?? component.id;
    if (type === 'ir-receiver') {
      if (pinName && pinName.toUpperCase() === 'OUT') {
        const rawState = component.state?.state ?? component.props?.state ?? 'low';
        const normalised = String(rawState).toLowerCase();
        if (normalised === 'high' || normalised === '1' || normalised === 'on') {
          return 'high';
        }
        if (normalised === 'low' || normalised === '0' || normalised === 'off') {
          return 'low';
        }
      }
    }
    return null;
  }

  isGroundNode(node) {
    if (!this.powerEnabled) {
      return node.voltageState === 'low';
    }
    return node.pinType === 'ground' || node.voltageState === 'low';
  }

  getBoardPinState(componentId, pinName) {
    if (!componentId || !pinName) return 'floating';
    const key = `${componentId}:${pinName}`;
    return this.boardPinStates.get(key) ?? 'floating';
  }

  getBoardPinAnalogLevel(componentId, pinName) {
    if (!componentId || !pinName) return null;
    const key = `${componentId}:${pinName}`;
    const value = this.boardAnalogLevels.get(key);
    return Number.isFinite(value) ? value : null;
  }

  resolveVoltageForBoardPin(componentId, pinName) {
    const node = this.getNodeByComponentPin(componentId, pinName);
    if (!node) return 'floating';
    return this.computeNodeVoltageState(node);
  }

  resolveVoltageForNode(node) {
    if (!node) return 'floating';
    if (node.voltageState === 'high' || node.voltageState === 'low') {
      return node.voltageState;
    }

    if (this.nodeVoltageCache.has(node.id)) {
      return this.nodeVoltageCache.get(node.id);
    }

    let resolved = 'floating';

    const checkQueue = [node];
    const visited = new Set([node.id]);
    let encountersPower = false;
    let encountersGround = false;

    while (checkQueue.length) {
      const current = checkQueue.shift();

      if (current !== node) {
        if (current.voltageState === 'high' || this.isPowerNode(current)) {
          encountersPower = true;
        }
        if (current.voltageState === 'low' || this.isGroundNode(current)) {
          encountersGround = true;
        }
        if (encountersPower && encountersGround) {
          break;
        }
      }

      current.connections.forEach((neighbor) => {
        if (!visited.has(neighbor.id)) {
          visited.add(neighbor.id);
          checkQueue.push(neighbor);
        }
      });
    }

    if (encountersPower && !encountersGround) {
      resolved = 'high';
    } else if (!encountersPower && encountersGround) {
      resolved = 'low';
    } else if (encountersPower && encountersGround) {
      resolved = 'error';
    }

    this.nodeVoltageCache.set(node.id, resolved);
    return resolved;
  }

  resolveAnalogLevel(node) {
    if (!node) return null;
    if (Number.isFinite(node.analogLevel)) {
      return node.analogLevel;
    }

    const visited = new Set([node.id]);
    const queue = [node];

    while (queue.length) {
      const current = queue.shift();
      if (current !== node && Number.isFinite(current.analogLevel)) {
        return current.analogLevel;
      }
      current.connections.forEach((neighbor) => {
        if (!visited.has(neighbor.id)) {
          visited.add(neighbor.id);
          queue.push(neighbor);
        }
      });
    }

    const voltageState = this.computeNodeVoltageState(node);
    if (voltageState === 'high') return 4095;
    if (voltageState === 'low') return 0;
    return null;
  }

  estimateNodeVoltage(node, excludeComponentId) {
    if (!node) return 0;

    const startIsPower = this.isPowerReferenceNode(node);
    const startIsGround = this.isGroundReferenceNode(node);
    const directSupplyComponent = this.getComponentSupplyCandidate(node.component, excludeComponentId);

    const supplyPath = startIsPower
      ? {
          exists: true,
          resistorIncluded: false,
          resistors: [],
          sources: directSupplyComponent ? [directSupplyComponent] : [],
          leds: [],
        }
      : this.findPath(node, (neighbor) =>
          neighbor.componentId !== excludeComponentId && this.isPowerReferenceNode(neighbor),
        );

    const groundPath = startIsGround
      ? {
          exists: true,
          resistorIncluded: false,
          resistors: [],
          sources: [],
          leds: [],
        }
      : this.findPath(node, (neighbor) =>
          neighbor.componentId !== excludeComponentId && this.isGroundReferenceNode(neighbor),
        );

    let supplyVoltage = 0;
    if (supplyPath.exists && Array.isArray(supplyPath.sources) && supplyPath.sources.length) {
      supplyVoltage = this.resolveSupplyVoltage(supplyPath.sources);
    } else if (directSupplyComponent) {
      supplyVoltage = this.getComponentSupplyVoltage(directSupplyComponent);
    }

    if ((!Number.isFinite(supplyVoltage) || supplyVoltage <= 0) && !startIsPower) {
      const fallbackSupply = this.resolveSupplyVoltageForNode(node, excludeComponentId);
      if (Number.isFinite(fallbackSupply) && fallbackSupply > supplyVoltage) {
        supplyVoltage = fallbackSupply;
      }
    }

    if (!Number.isFinite(supplyVoltage) || supplyVoltage <= 0) {
      supplyVoltage = DEFAULT_SUPPLY_VOLTAGE;
    }

    const supplyResistance = startIsPower
      ? 0
      : this.computePathResistance(supplyPath, { includeLed: true });
    const groundResistance = startIsGround
      ? 0
      : this.computePathResistance(groundPath, { includeLed: true });

    const hasGroundReference = startIsGround || groundPath.exists;
    if (!hasGroundReference) {
      return supplyVoltage;
    }

    if (groundResistance === 0 && supplyResistance === 0) {
      return supplyVoltage;
    }

    if (groundResistance === 0) {
      return 0;
    }

    if (supplyResistance === 0) {
      return supplyVoltage;
    }

    const totalResistance = supplyResistance + groundResistance;
    if (totalResistance <= 0) {
      return supplyVoltage;
    }

    return supplyVoltage * (groundResistance / totalResistance);
  }

  computeNodeVoltageState(node) {
    if (!node) return 'floating';

    if (this.nodeVoltageCache.has(`computed:${node.id}`)) {
      return this.nodeVoltageCache.get(`computed:${node.id}`);
    }

    const powerPath = this.findPath(node, (neighbor) => this.isPowerNode(neighbor));
    const groundPath = this.findPath(node, (neighbor) => this.isGroundNode(neighbor));

    const hasPower = powerPath.exists;
    const hasGround = groundPath.exists;

    if (hasPower && hasGround) {
      const powerThroughResistor = powerPath.resistorIncluded;
      const groundThroughResistor = groundPath.resistorIncluded;

      let state;
      if (powerThroughResistor && !groundThroughResistor) {
        state = 'low';
      } else if (!powerThroughResistor && groundThroughResistor) {
        state = 'high';
      } else if (powerThroughResistor && groundThroughResistor) {
        state = 'floating';
      } else {
        state = 'error';
      }
      this.nodeVoltageCache.set(`computed:${node.id}`, state);
      return state;
    }

    const state = hasPower ? 'high' : hasGround ? 'low' : 'floating';
    this.nodeVoltageCache.set(`computed:${node.id}`, state);
    return state;
  }

  applyInternalComponentConnections() {
    this.canvasManager.components.forEach((component) => {
      switch (component.type) {
        case 'resistor':
          this.connectNodesByIndex(component.id, 0, 1);
          break;
        case 'potentiometer':
          this.applyPotentiometerConnections(component);
          break;
        case 'led':
          this.applyLedConnections(component);
          break;
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

  applyLedConnections(component) {
    if (!component) return;
    if (component.state?.burned) {
      return;
    }
    this.connectNodesByIndex(component.id, 0, 1);
  }

  applyPotentiometerConnections(component) {
    if (!component) return;
    this.connectNodesByIndex(component.id, 0, 1);
    this.connectNodesByIndex(component.id, 1, 2);
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

  isPushbuttonPressed(element) {
    if (!element) return false;
    if (typeof element.value !== 'undefined') {
      const value = element.value;
      if (typeof value === 'number') return value !== 0;
      if (typeof value === 'string') return value !== '' && value !== '0';
      return Boolean(value);
    }
    if (typeof element.pressed !== 'undefined') {
      return Boolean(element.pressed);
    }
    const attrValue = element.getAttribute?.('value');
    if (attrValue !== null) {
      return attrValue !== '0';
    }
    return element.hasAttribute?.('pressed');
  }

  isSwitchOn(component) {
    if (!component) return false;
    if (typeof component.state?.on === 'boolean') {
      return component.state.on;
    }
    const elementValue = component.element?.value;
    if (typeof elementValue === 'number') {
      return elementValue > 0;
    }
    if (typeof elementValue === 'string') {
      const trimmed = elementValue.trim().toLowerCase();
      if (trimmed === '1' || trimmed === 'on' || trimmed === 'true') {
        return true;
      }
      if (trimmed === '0' || trimmed === 'off' || trimmed === 'false') {
        return false;
      }
    }
    const initial = String(component.props?.initialState ?? 'off').toLowerCase();
    return initial === 'on';
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

  hasConnectionToBoardSignal(startNode) {
    if (!startNode) return false;
    const visited = new Set([startNode.id]);
    const queue = [startNode];

    while (queue.length) {
      const node = queue.shift();
      if (this.isBoardSignalNode(node)) {
        return true;
      }
      node.connections.forEach((neighbor) => {
        if (!visited.has(neighbor.id)) {
          visited.add(neighbor.id);
          queue.push(neighbor);
        }
      });
    }

    return false;
  }

  isBoardSignalNode(node) {
    if (!node) return false;
    const type = node.componentType;
    if (type !== 'amado-board' && type !== 'esp32') {
      return false;
    }
    return node.pinType === 'signal';
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

    const voltagePlus = snapshot.estimateNodeVoltage(positiveNode, component.id);
    const voltageMinus = snapshot.estimateNodeVoltage(negativeNode, component.id);
    const voltage = voltagePlus - voltageMinus;

    if (!Number.isFinite(voltage)) {
      displayElement.textContent = '---';
      return;
    }

    displayElement.textContent = `${voltage.toFixed(2)} V`;
    component.state = component.state ?? {};
    component.state.lastVoltage = voltage;
  }

  resetMultimeter(component) {
    const displayElement = component.element?.__displayElement;
    if (displayElement) {
      displayElement.textContent = '---';
    }
    if (component.state) {
      delete component.state.lastVoltage;
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
