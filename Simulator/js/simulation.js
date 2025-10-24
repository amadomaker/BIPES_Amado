class CircuitSnapshot {
  constructor(canvasManager, boardPinStates = new Map()) {
    this.canvasManager = canvasManager;
    this.boardPinStates = boardPinStates;
    this.pinNodes = new Map();
    this.buildPinNodes();
    this.buildConnections();
  }

  buildPinNodes() {
    this.canvasManager.components.forEach((component) => {
      const pins = this.canvasManager.wiringManager.getPinsForComponent(component.id);
      pins.forEach((pinElement) => {
        const key = this.getPinKey(pinElement);
        this.pinNodes.set(key, {
          id: key,
          pinElement,
          component,
          componentId: component.id,
          componentType: component.type,
          pinIndex: Number(pinElement.dataset.pinIndex),
          pinType: pinElement.dataset.pinType,
          pinName: pinElement.dataset.pinName,
          voltageState: this.getBoardPinState(component.id, pinElement.dataset.pinName),
          connections: new Set(),
        });
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
  }

  getPinKey(pinElement) {
    return `${pinElement.dataset.componentId}:${pinElement.dataset.pinIndex}`;
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

        const lightsUp =
          powerPath.exists &&
          groundPath.exists &&
          (powerPath.resistorIncluded || groundPath.resistorIncluded);

        const reasons = [];
        if (!powerPath.exists) {
          reasons.push('Sem ligação de VCC');
        }
        if (!groundPath.exists) {
          reasons.push('Sem ligação de GND');
        }
        if (powerPath.exists && groundPath.exists && !(powerPath.resistorIncluded || groundPath.resistorIncluded)) {
          reasons.push('Falta resistor em série');
        }

        results.push({
          component,
          lightsUp,
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
    const visited = new Map();

    queue.push({
      node: startNode,
      resistorIncluded: startNode.componentType === 'resistor',
    });
    visited.set(startNode.id, new Set([Number(startNode.componentType === 'resistor')]));

    while (queue.length) {
      const { node, resistorIncluded } = queue.shift();
      if (node !== startNode && predicate(node)) {
        return {
          exists: true,
          resistorIncluded,
        };
      }

      node.connections.forEach((neighbor) => {
        const neighborResistorIncluded =
          resistorIncluded || neighbor.componentType === 'resistor';
        const visitedStates = visited.get(neighbor.id) ?? new Set();
        const stateKey = Number(neighborResistorIncluded);

        if (!visitedStates.has(stateKey)) {
          visitedStates.add(stateKey);
          visited.set(neighbor.id, visitedStates);
          queue.push({
            node: neighbor,
            resistorIncluded: neighborResistorIncluded,
          });
        }
      });
    }

    return {
      exists: false,
      resistorIncluded: false,
    };
  }

  isPowerNode(node) {
    return node.pinType === 'power' || node.voltageState === 'high';
  }

  isGroundNode(node) {
    return node.pinType === 'ground' || node.voltageState === 'low';
  }

  getBoardPinState(componentId, pinName) {
    if (!componentId || !pinName) return 'floating';
    const key = `${componentId}:${pinName}`;
    return this.boardPinStates.get(key) ?? 'floating';
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
    };
    this.lastErrorSignature = '';
     this.boardPinStates = new Map();
     this.programState = null;
  }

  configure(listeners = {}) {
    this.listeners = { ...this.listeners, ...listeners };
  }

  start(canvasManager, options = {}) {
    if (this.isRunning) return;
    this.canvasManager = canvasManager;
    this.isRunning = true;
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
    const snapshot = new CircuitSnapshot(this.canvasManager, this.boardPinStates);
    const ledResults = snapshot.evaluateLEDs();
    const errorMessages = [];

    ledResults.forEach((result) => {
      this.setLedState(result.component, result.lightsUp);
      if (!result.lightsUp && result.reasons.length) {
        errorMessages.push(`LED ${result.component.id}: ${result.reasons.join(', ')}`);
      }
    });

    const signature = errorMessages.sort().join('|');
    if (errorMessages.length && signature !== this.lastErrorSignature) {
      this.listeners.onError?.(errorMessages.join('\n'));
      this.lastErrorSignature = signature;
    }
    if (!errorMessages.length) {
      this.lastErrorSignature = '';
    }
  }

  setLedState(component, isOn) {
    const element = component.element;
    element.value = Boolean(isOn);
    element.setAttribute('value', isOn ? '1' : '0');
  }

  resetOutputs() {
    this.clearBoardStates();
    if (!this.canvasManager) return;
    this.canvasManager.components
      .filter((component) => component.type === 'led')
      .forEach((component) => this.setLedState(component, false));
  }

  clearBoardStates() {
    this.boardPinStates.clear();
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
      setPin: (pinName, level) => {
        if (programState.aborted) return;
        try {
          this.setBoardPinState(programState.boardComponentId, pinName, level);
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
      log: (...args) => {
        if (programState.aborted) return;
        console.log('[Blockly]', ...args);
      },
    };

    this.programState = programState;

    programState.promise = Promise.resolve()
      .then(() => program(api))
      .catch((error) => {
        if (programState.aborted) return;
        const message =
          error?.name === 'ProgramAbortError'
            ? null
            : error?.message ?? String(error);
        if (message) {
          programState.onProgramError?.(`Erro no programa: ${message}`);
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

    const component = this.canvasManager.getComponentById(componentId);
    if (!component) {
      throw new Error('Placa alvo não encontrada no workspace.');
    }

    if (component.type !== 'amado-board' && component.type !== 'esp32') {
      throw new Error('O programa só pode controlar placas compatíveis (Amado ESP32).');
    }

    const pins = this.canvasManager.wiringManager.getPinsForComponent(componentId) ?? [];
    const pinElement = pins.find((pin) => pin.dataset.pinName === pinName);
    if (!pinElement) {
      throw new Error(`Pino "${pinName}" não foi encontrado na placa selecionada.`);
    }

    if (pinElement.dataset.pinType !== 'signal') {
      throw new Error(`O pino "${pinName}" não é configurável (somente pinos do tipo sinal podem ser controlados).`);
    }

    const normalized = this.normalizePinLevel(level);
    const key = this.getBoardPinKey(componentId, pinName);

    if (normalized === 'floating') {
      this.boardPinStates.delete(key);
    } else {
      this.boardPinStates.set(key, normalized);
    }

    return normalized;
  }

  normalizePinLevel(level) {
    if (typeof level === 'boolean') {
      return level ? 'high' : 'low';
    }
    if (typeof level === 'number') {
      return level > 0 ? 'high' : 'low';
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

  getBoardPinKey(componentId, pinName) {
    return `${componentId}:${pinName}`;
  }
}

export const simulation = new Simulation();
