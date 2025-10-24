import {
  showWireContextMenu,
  hideContextMenu,
  showColorPicker,
  updatePropertiesPanel,
  clearPropertiesPanel,
} from './ui.js';

export class WiringManager {
  constructor(canvasManager) {
    this.canvasManager = canvasManager;
    this.workspace = canvasManager.workspace;
    this.connections = [];
    this.pinRegistry = new Map();
    this.selectedPin = null;
    this.selectedWire = null;
    this.nextWireId = 1;

    this.createSVGLayer();
    this.createTempWire();
    this.registerWorkspaceEvents();
  }

  registerWorkspaceEvents() {
    this.workspace.addEventListener('mousemove', (event) => {
      if (this.selectedPin) {
        this.updateTempWire(event);
      }
    });
  }

  async addPinsToComponent(container, componentDefinition, componentId) {
    if (Array.isArray(componentDefinition.pins) && componentDefinition.pins.length) {
      const customPins = [];
      componentDefinition.pins.forEach((pinConfig, index) => {
        const pinElement = document.createElement('div');
        pinElement.className = `pin pin-${pinConfig.type}`;
        pinElement.dataset.componentId = componentId;
        pinElement.dataset.pinIndex = String(
          pinConfig.pinIndex ?? index,
        );
        pinElement.dataset.pinName = pinConfig.name;
        pinElement.dataset.pinType = pinConfig.type;
        pinElement.title = pinConfig.name;
        pinElement.style.position = 'absolute';

        if (pinConfig.position) {
          pinElement.style.left = `${pinConfig.position.xPercent}%`;
          pinElement.style.top = `${pinConfig.position.yPercent}%`;
          pinElement.style.transform = 'translate(-50%, -50%)';
        } else if (pinConfig.selector) {
          const target = container.querySelector(pinConfig.selector);
          if (!target) {
            return;
          }
          const position = this.getRelativeCenter(target, container);
          pinElement.style.left = `${position.x}px`;
          pinElement.style.top = `${position.y}px`;
          pinElement.style.transform = 'translate(-50%, -50%)';
        } else {
          return;
        }

        pinElement.addEventListener('click', (event) => {
          event.stopPropagation();
          this.handlePinClick(pinElement);
        });

        customPins.push(pinElement);
        container.appendChild(pinElement);
      });

      this.pinRegistry.set(componentId, customPins);
      return;
    }

    const tagName = componentDefinition.element;
    let actualElement = null;

    if (tagName) {
      const element =
        container.querySelector(tagName) ||
        container.querySelector(`[is="${tagName}"]`);
      const wokwiElement = element ?? container.querySelector('[data-component]');
      actualElement = wokwiElement ?? container.querySelector('*:not(.component-label)');
    } else {
      actualElement = container.querySelector('*:not(.component-label)');
    }

    if (!actualElement) return;

    await this.waitForRender(actualElement);

    const pinInfo = this.getPinInformation(actualElement);
    if (!Array.isArray(pinInfo) || !pinInfo.length) return;

    const pins = [];
    pinInfo.forEach((info, index) => {
      const metadata = this.getPinMetadata(componentDefinition.id, info, index);
      const pinElement = document.createElement('div');
      pinElement.className = `pin pin-${metadata.type}`;
      pinElement.dataset.componentId = componentId;
      pinElement.dataset.pinIndex = String(index);
      pinElement.dataset.pinName = metadata.label;
      pinElement.dataset.pinType = metadata.type;
      pinElement.title = metadata.label;
      pinElement.style.position = 'absolute';

      const position = this.computePinPosition(actualElement, container, info);
      pinElement.style.left = `${position.x}px`;
      pinElement.style.top = `${position.y}px`;
      pinElement.style.transform = 'translate(-50%, -50%)';

      pinElement.addEventListener('click', (event) => {
        event.stopPropagation();
        this.handlePinClick(pinElement);
      });

      pins.push(pinElement);
      container.appendChild(pinElement);
    });

    this.pinRegistry.set(componentId, pins);
  }

  getPinMetadata(componentType, info, index) {
    switch (componentType) {
      case 'led':
        return index === 0
          ? { label: 'Anodo (+)', type: 'power' }
          : { label: 'Catodo (-)', type: 'ground' };
      case 'resistor':
        return { label: `Terminal ${index + 1}`, type: 'signal' };
      case 'pushbutton':
        return { label: `Terminal ${index + 1}`, type: 'signal' };
      case 'potentiometer': {
        const labels = ['GND', 'SIG', 'VCC'];
        const types = ['ground', 'signal', 'power'];
        return { label: labels[index] ?? `Pino ${index + 1}`, type: types[index] ?? 'signal' };
      }
      case 'battery':
        return index === 0
          ? { label: 'VCC (+)', type: 'power' }
          : { label: 'GND (-)', type: 'ground' };
      case 'esp32': {
        const label = info.name ?? `GPIO ${index + 1}`;
        const normalised = label.toUpperCase();
        let type = 'signal';
        if (normalised.includes('GND')) type = 'ground';
        if (normalised.includes('3V') || normalised.includes('5V') || normalised.startsWith('VIN')) type = 'power';
        return { label, type };
      }
      default:
        return { label: info.name ?? `Pino ${index + 1}`, type: 'signal' };
    }
  }

  async waitForRender(element) {
    if (typeof element.updateComplete === 'function') {
      try {
        await element.updateComplete;
      } catch {
        // Silent failure, continue with fallback
      }
    }
    await new Promise((resolve) => requestAnimationFrame(resolve));
    if (!element.shadowRoot) {
      await new Promise((resolve) => setTimeout(resolve, 16));
    }
  }

  getPinInformation(element) {
    if (Array.isArray(element.pinInfo) && element.pinInfo.length) {
      return element.pinInfo;
    }
    return [];
  }

  computePinPosition(wokwiElement, container, pinInfo) {
    const elementRect = wokwiElement.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    const x = elementRect.left - containerRect.left + pinInfo.x;
    const y = elementRect.top - containerRect.top + pinInfo.y;

    return { x, y };
  }

  getRelativeCenter(element, container) {
    const elementRect = element.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    return {
      x: elementRect.left + elementRect.width / 2 - containerRect.left,
      y: elementRect.top + elementRect.height / 2 - containerRect.top,
    };
  }

  handlePinClick(pinElement) {
    if (!this.selectedPin) {
      this.selectedPin = pinElement;
      pinElement.classList.add('pin-selected');
      this.startTempWire(pinElement);
      return;
    }

    if (this.selectedPin === pinElement) {
      this.cancelWiring();
      return;
    }

    this.createConnection(this.selectedPin, pinElement);
    this.cancelWiring();
    this.canvasManager.notifyInteraction();
  }

  startTempWire(pin) {
    const position = this.getPinPosition(pin);
    this.tempWire.setAttribute('x1', position.x);
    this.tempWire.setAttribute('y1', position.y);
    this.tempWire.setAttribute('x2', position.x);
    this.tempWire.setAttribute('y2', position.y);
    this.tempWire.style.display = 'block';
    this.workspace.style.cursor = 'crosshair';
  }

  createConnection(pin1, pin2, options = {}) {
    const wireId = `wire-${this.nextWireId++}`;
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.id = wireId;
    line.classList.add('wire');
    line.dataset.pin1 = `${pin1.dataset.componentId}-${pin1.dataset.pinIndex}`;
    line.dataset.pin2 = `${pin2.dataset.componentId}-${pin2.dataset.pinIndex}`;

    const color = this.getWireColor(pin1.dataset.pinType, pin2.dataset.pinType);
    line.setAttribute('stroke', color);
    line.setAttribute('stroke-width', '3');

    this.updateWirePosition(line, pin1, pin2);

    const connection = {
      id: wireId,
      pin1,
      pin2,
      line,
      color,
    };

    line.addEventListener('click', (event) => {
      event.stopPropagation();
      this.selectWire(connection);
    });

    line.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.selectWire(connection);
      showWireContextMenu(event.clientX, event.clientY, {
        onChangeColor: () => {
          showColorPicker(event.clientX, event.clientY, {
            initialColor: connection.color,
            onSelect: (newColor) => {
              connection.color = newColor;
              connection.line.setAttribute('stroke', newColor);
              if (this.selectedWire?.id === connection.id) {
                this.displayWireProperties(connection);
              }
            },
          });
        },
        onDelete: () => this.removeConnection(connection.id),
      });
    });

    this.svgLayer.appendChild(line);
    this.connections.push(connection);

    if (!options.silent) {
      this.selectWire(connection);
    }

    return connection;
  }

  selectWire(connection) {
    this.deselectWire();
    this.canvasManager.clearComponentSelection();
    this.selectedWire = connection;
    connection.line.classList.add('wire-selected');
    this.displayWireProperties(connection);
  }

  deselectWire() {
    if (!this.selectedWire) return;
    this.selectedWire.line.classList.remove('wire-selected');
    this.selectedWire = null;
    if (!this.canvasManager.selectedComponentId) {
      clearPropertiesPanel();
    }
  }

  deleteSelectedWire() {
    if (!this.selectedWire) return;
    this.removeConnection(this.selectedWire.id);
  }

  removeConnection(wireId) {
    const index = this.connections.findIndex((connection) => connection.id === wireId);
    if (index === -1) return;

    const [connection] = this.connections.splice(index, 1);
    connection.line.remove();
    if (this.selectedWire?.id === wireId) {
      this.selectedWire = null;
      clearPropertiesPanel();
    }
    this.canvasManager.notifyInteraction();
  }

  removeConnectionsForComponent(componentId) {
    const wires = this.connections.filter((connection) =>
      connection.pin1.dataset.componentId === componentId ||
      connection.pin2.dataset.componentId === componentId,
    );
    wires.forEach((wire) => this.removeConnection(wire.id));
  }

  displayWireProperties(connection) {
    updatePropertiesPanel({
      title: 'Conexão selecionada',
      fields: [
        {
          label: 'Origem',
          value: `${connection.pin1.dataset.componentId} (${connection.pin1.dataset.pinName})`,
        },
        {
          label: 'Destino',
          value: `${connection.pin2.dataset.componentId} (${connection.pin2.dataset.pinName})`,
        },
        {
          label: 'Cor',
          value: connection.color,
        },
      ],
    });
  }

  removePinsForComponent(componentId) {
    const pins = this.pinRegistry.get(componentId);
    if (pins) {
      pins.forEach((pin) => pin.remove());
    }
    if (this.selectedPin?.dataset.componentId === componentId) {
      this.cancelWiring();
    }
    this.pinRegistry.delete(componentId);
  }

  clear() {
    this.connections.forEach((connection) => connection.line.remove());
    this.connections = [];
    this.pinRegistry.clear();
    this.nextWireId = 1;
    this.cancelWiring();
    this.deselectWire();
  }

  async deserialize(wires) {
    for (const wire of wires) {
      const pin1 = this.getPinElement(wire.from.componentId, wire.from.pinIndex);
      const pin2 = this.getPinElement(wire.to.componentId, wire.to.pinIndex);
      if (!pin1 || !pin2) continue;

      const connection = this.createConnection(pin1, pin2, { silent: true });
      if (!connection) continue;

      if (wire.id) {
        connection.id = wire.id;
        connection.line.id = wire.id;
        this.updateNextWireId(wire.id);
      }

      connection.color = wire.color ?? connection.color;
      connection.line.setAttribute('stroke', connection.color);
    }
    this.deselectWire();
  }

  updateNextWireId(wireId) {
    const suffix = Number(`${wireId}`.split('-')[1]);
    if (!Number.isNaN(suffix)) {
      this.nextWireId = Math.max(this.nextWireId, suffix + 1);
    }
  }

  serialize() {
    return this.connections.map((connection) => ({
      id: connection.id,
      color: connection.color,
      from: {
        componentId: connection.pin1.dataset.componentId,
        pinIndex: Number(connection.pin1.dataset.pinIndex),
      },
      to: {
        componentId: connection.pin2.dataset.componentId,
        pinIndex: Number(connection.pin2.dataset.pinIndex),
      },
    }));
  }

  getPinsForComponent(componentId) {
    return this.pinRegistry.get(componentId) ?? [];
  }

  getPinElement(componentId, pinIndex) {
    const pins = this.pinRegistry.get(componentId);
    if (!pins) return null;
    return pins[pinIndex] ?? null;
  }

  createSVGLayer() {
    this.svgLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svgLayer.id = 'wire-layer';
    this.svgLayer.style.position = 'absolute';
    this.svgLayer.style.inset = '0';
    this.svgLayer.style.width = '100%';
    this.svgLayer.style.height = '100%';
    this.svgLayer.style.pointerEvents = 'none';
    this.svgLayer.style.zIndex = '5';
    this.workspace.appendChild(this.svgLayer);
  }

  createTempWire() {
    this.tempWire = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    this.tempWire.id = 'temp-wire';
    this.tempWire.setAttribute('stroke', '#007acc');
    this.tempWire.setAttribute('stroke-width', '3');
    this.tempWire.setAttribute('stroke-dasharray', '6 4');
    this.tempWire.style.display = 'none';
    this.svgLayer.appendChild(this.tempWire);
  }

  cancelWiring() {
    if (this.selectedPin) {
      this.selectedPin.classList.remove('pin-selected');
      this.selectedPin = null;
    }
    this.tempWire.style.display = 'none';
    this.workspace.style.cursor = 'default';
    hideContextMenu();
  }

  updateTempWire(event) {
    const workspaceRect = this.workspace.getBoundingClientRect();
    this.tempWire.setAttribute('x2', event.clientX - workspaceRect.left);
    this.tempWire.setAttribute('y2', event.clientY - workspaceRect.top);
  }

  updateWirePosition(line, pin1, pin2) {
    const position1 = this.getPinPosition(pin1);
    const position2 = this.getPinPosition(pin2);

    line.setAttribute('x1', position1.x);
    line.setAttribute('y1', position1.y);
    line.setAttribute('x2', position2.x);
    line.setAttribute('y2', position2.y);
  }

  updateAllConnections() {
    this.connections.forEach((connection) => {
      this.updateWirePosition(connection.line, connection.pin1, connection.pin2);
    });
  }

  getPinPosition(pin) {
    const rect = pin.getBoundingClientRect();
    const workspaceRect = this.workspace.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2 - workspaceRect.left,
      y: rect.top + rect.height / 2 - workspaceRect.top,
    };
  }

  getWireColor(type1, type2) {
    if (type1 === 'ground' || type2 === 'ground') return '#000000';
    if (type1 === 'power' || type2 === 'power') return '#ff3b30';
    return '#00ff95';
  }
}
