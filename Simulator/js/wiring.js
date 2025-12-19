import {
  showWireContextMenu,
  hideContextMenu,
  showColorPicker,
  updatePropertiesPanel,
  clearPropertiesPanel,
} from './ui.js';

const SNAP_THRESHOLD = 8;
const GUIDE_ACTIVE_THRESHOLD = 4;

export class WiringManager {
  constructor(canvasManager) {
    this.canvasManager = canvasManager;
    this.workspace = canvasManager.workspace;
    this.viewport = canvasManager.viewportElement ?? this.workspace;
    this.connections = [];
    this.pinRegistry = new Map();
    this.selectedPin = null;
    this.selectedWire = null;
    this.nextWireId = 1;
    this.preferredWireColor = null;
    this.tempWireAnchors = [];
    this.tempWireCursor = null;
    this.editingConnection = null;
    this.anchorHandles = [];
    this.activeAnchorHandle = null;
    this.connectionDragState = null;
    this.connectionRefreshHandle = null;

    this.createSVGLayer();
    this.createTempWire();
    this.createGuideLines();
    this.registerWorkspaceEvents();

    this.handleAnchorPointerMove = this.handleAnchorPointerMove.bind(this);
    this.handleAnchorPointerUp = this.handleAnchorPointerUp.bind(this);
    this.handleConnectionDragMove = this.handleConnectionDragMove.bind(this);
    this.handleConnectionDragEnd = this.handleConnectionDragEnd.bind(this);
  }

  registerWorkspaceEvents() {
    this.workspace.addEventListener('mousemove', (event) => {
      if (this.isWiring()) {
        this.updateTempWire(event);
      }
    });

    this.workspace.addEventListener('click', (event) => {
      if (typeof event.button === 'number' && event.button !== 0) return;

      if (this.isWiring()) {
        if (event.target.closest?.('.pin')) return;
        const point = this.getWorkspaceCoordinates(event);
        this.addAnchorPoint(point);
        event.stopPropagation();
        return;
      }

      if (this.isEditingConnection()) {
        if (
          event.target.closest?.('.pin') ||
          event.target.closest?.('.wire-anchor-handle') ||
          event.target.closest?.('.wire') ||
          event.target.closest?.('.wire-guide')
        ) {
          return;
        }
        this.deselectWire();
      }
    });

    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        if (this.isWiring()) {
          event.preventDefault();
          this.cancelWiring();
        } else if (this.isEditingConnection()) {
          event.preventDefault();
          this.deselectWire();
        }
      } else if (event.key === 'Enter') {
        if (this.isEditingConnection()) {
          event.preventDefault();
          this.deselectWire();
        }
      }
    });
  }

  async addPinsToComponent(container, componentDefinition, componentId) {
    if (Array.isArray(componentDefinition.pins) && componentDefinition.pins.length) {
      const customPins = [];
      componentDefinition.pins.forEach((pinConfig, index) => {
        if (pinConfig.hidden) {
          return;
        }
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
          const scale = this.canvasManager?.viewportState?.scale ?? 1;
          const adjustedX = scale ? position.x / scale : position.x;
          const adjustedY = scale ? position.y / scale : position.y;
          pinElement.style.left = `${adjustedX}px`;
          pinElement.style.top = `${adjustedY}px`;
          pinElement.style.transform = 'translate(-50%, -50%)';
          pinElement.dataset.pinSelector = pinConfig.selector;
        } else {
          return;
        }

        pinElement.addEventListener('click', (event) => {
          event.stopPropagation();
          this.handlePinClick(pinElement);
        });

        if (pinConfig.hidden) {
          pinElement.classList.add('pin-hidden');
          pinElement.style.display = 'none';
          pinElement.style.pointerEvents = 'none';
        }

        customPins.push(pinElement);
        container.appendChild(pinElement);
      });

      this.pinRegistry.set(componentId, customPins);
      this.scheduleConnectionRefresh({
        immediate: true,
        minFrames: 4,
        durationMs: 160,
        maxDurationMs: 320,
      });
      this.scheduleRefreshAfterMediaLoad(container);
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
    this.scheduleRefreshAfterMediaLoad(container);
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
      case 'switch':
        return { label: info.name ?? `Terminal ${index + 1}`, type: 'signal' };
      case 'photoresistor':
        if (!info?.name) {
          return { label: `Terminal ${index + 1}`, type: 'signal' };
        }
        switch (info.name.toUpperCase()) {
          case 'VCC':
            return { label: 'VCC', type: 'power' };
          case 'GND':
            return { label: 'GND', type: 'ground' };
          case 'AO':
            return { label: 'AO', type: 'signal' };
          case 'DO':
            return { label: 'DO', type: 'signal' };
          default:
            return { label: info.name, type: 'signal' };
        }
      case 'buzzer':
        if (!info?.name) {
          return index === 0
            ? { label: '+', type: 'power' }
            : { label: '-', type: 'ground' };
        }
        if (info.name.toUpperCase() === 'VCC' || info.name === '+') {
          return { label: info.name, type: 'power' };
        }
        if (info.name.toUpperCase() === 'GND' || info.name === '-') {
          return { label: info.name, type: 'ground' };
        }
        return { label: info.name, type: 'signal' };
      case 'ir-receiver': {
        const name = info?.name?.toUpperCase();
        if (name === 'VCC') return { label: 'VCC', type: 'power' };
        if (name === 'GND') return { label: 'GND', type: 'ground' };
        if (name === 'OUT' || name === 'S' || name === 'SIGNAL' || name === 'DAT' || name === 'DATA') {
          return { label: info.name ?? 'OUT', type: 'signal' };
        }
        return { label: info?.name ?? `Pino ${index + 1}`, type: 'signal' };
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
      case 'servo': {
        const label = info.name ?? `Pino ${index + 1}`;
        const normalised = label.toUpperCase();
        let type = 'signal';
        if (normalised.includes('GND')) type = 'ground';
        else if (normalised.includes('V+') || normalised.includes('VCC') || normalised.includes('VIN')) type = 'power';
        return { label, type };
      }
      case 'ir-receiver': {
        const label = info.name ?? `Pino ${index + 1}`;
        const normalised = label.toUpperCase();
        let type = 'signal';
        if (normalised.includes('GND')) type = 'ground';
        else if (normalised.includes('VCC') || normalised.includes('V+')) type = 'power';
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
    void wokwiElement.offsetWidth;
    const elementRect = wokwiElement.getBoundingClientRect();
    const containerRect = container ? container.getBoundingClientRect() : null;

    if (containerRect) {
      const x = elementRect.left - containerRect.left + pinInfo.x;
      const y = elementRect.top - containerRect.top + pinInfo.y;
      return { x, y };
    }

    const componentId = container?.dataset?.componentId;
    if (componentId && this.canvasManager?.getComponentVisualWrapper) {
      const wrapper = this.canvasManager.getComponentVisualWrapper(componentId);
      if (wrapper) {
        const wrapperRect = wrapper.getBoundingClientRect();
        const x = elementRect.left - wrapperRect.left + pinInfo.x;
        const y = elementRect.top - wrapperRect.top + pinInfo.y;
        return { x, y };
      }
    }

    return { x: pinInfo.x, y: pinInfo.y };
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
    this.stopEditingConnection();
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

    const anchors = this.tempWireAnchors.map((point) => ({ ...point }));
    this.createConnection(this.selectedPin, pinElement, {
      anchors,
      autoSelect: false,
    });
    this.cancelWiring();
    this.canvasManager.notifyInteraction();
  }

  startTempWire(pin) {
    const position = this.getPinPosition(pin);
    this.tempWireAnchors = [];
    this.tempWireCursor = { ...position };
    this.tempWire.style.display = 'block';
    this.workspace.style.cursor = 'crosshair';
    this.renderTempWire();
    this.toggleGuideLines(true);
  }

  createConnection(pin1, pin2, options = {}) {
    const wireId = `wire-${this.nextWireId++}`;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.id = wireId;
    path.classList.add('wire');
    path.dataset.pin1 = `${pin1.dataset.componentId}-${pin1.dataset.pinIndex}`;
    path.dataset.pin2 = `${pin2.dataset.componentId}-${pin2.dataset.pinIndex}`;

    const color =
      this.preferredWireColor || this.getWireColor(pin1.dataset.pinType, pin2.dataset.pinType);
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', '3');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    path.style.pointerEvents = 'visibleStroke';

    const {
      anchors: rawAnchors = [],
      silent = false,
      autoSelect = true,
    } = options;

    const anchors = Array.isArray(rawAnchors)
      ? rawAnchors
          .map((point) => ({
            x: Number(point.x),
            y: Number(point.y),
          }))
          .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
      : [];

    const connection = {
      id: wireId,
      pin1,
      pin2,
      line: path,
      color,
      anchors,
    };

    this.updateWirePath(connection);

    path.addEventListener('click', (event) => {
      event.stopPropagation();
      this.selectWire(connection);
    });

    path.addEventListener('pointerdown', (event) => {
      if (event.button !== undefined && event.button !== 0) return;
      if (!this.isEditingConnection() || this.editingConnection.id !== connection.id) return;
      if (event.target.classList.contains('wire-anchor-handle')) return;
      event.preventDefault();
      event.stopPropagation();
      this.startConnectionDrag(connection, event);
    });

    path.addEventListener('dblclick', (event) => {
      if (!this.isEditingConnection() || this.editingConnection.id !== connection.id) return;
      event.preventDefault();
      event.stopPropagation();
      this.cancelConnectionDrag(false);
      const pointer = this.getWorkspaceCoordinates(event);
      const placement = this.computeAnchorPlacement(connection, pointer);
      this.addAnchorToEditingConnection(placement.point, {
        insertIndex: placement.insertIndex,
      });
    });

    path.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.selectWire(connection);
      showWireContextMenu(event.clientX, event.clientY, {
        onDelete: () => this.removeConnection(connection.id),
      });
    });

    this.svgLayer.appendChild(path);
    this.connections.push(connection);
    this.scheduleConnectionRefresh({
      immediate: false,
      minFrames: 2,
      durationMs: 120,
      maxDurationMs: 300,
    });

    if (!silent && autoSelect) {
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
    this.startEditingConnection(connection);
    this.emitWireSelectionChange(connection);
  }

  deselectWire() {
    this.stopEditingConnection();
    if (!this.selectedWire) return;
    this.selectedWire.line.classList.remove('wire-selected');
    this.selectedWire = null;
    if (!this.canvasManager.selectedComponentId) {
      clearPropertiesPanel();
    }
    this.emitWireSelectionChange(null);
  }

  emitWireSelectionChange(connection) {
    window.dispatchEvent(
      new CustomEvent('simulator-wire-selection-change', {
        detail: connection
          ? { selected: true, color: connection.color, wireId: connection.id }
          : { selected: false, color: null, wireId: null },
      }),
    );
  }

  applyWireColor(connection, newColor) {
    if (!connection || !newColor) return;
    connection.color = newColor;
    connection.line.setAttribute('stroke', newColor);
    if (this.selectedWire?.id === connection.id) {
      this.displayWireProperties(connection);
    }
    this.emitWireSelectionChange(connection);
    this.canvasManager.notifyInteraction();
  }

  setPreferredWireColor(newColor) {
    if (!newColor) return;
    this.preferredWireColor = newColor;
    this.emitWireSelectionChange(this.selectedWire);
  }

  deleteSelectedWire() {
    if (!this.selectedWire) return false;
    this.removeConnection(this.selectedWire.id);
    return true;
  }

  removeConnection(wireId) {
    const index = this.connections.findIndex((connection) => connection.id === wireId);
    if (index === -1) return;

    const [connection] = this.connections.splice(index, 1);
    if (this.editingConnection?.id === connection.id) {
      this.stopEditingConnection();
    }
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
    const rect = connection.line.getBoundingClientRect();
    const anchor = {
      left: rect.left,
      top: rect.top,
      width: rect.width || 1,
      height: rect.height || 1,
    };

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
      anchor,
    });
  }

  startEditingConnection(connection) {
    if (this.editingConnection?.id === connection.id) return;
    if (this.editingConnection) {
      this.stopEditingConnection();
    }
    this.editingConnection = connection;
    connection.line.classList.add('wire-editing');
    this.toggleGuideLines(false);

    if (!Array.isArray(connection.anchors)) {
      connection.anchors = [];
    }

    if (connection.anchors.length === 0) {
      const start = this.getPinPosition(connection.pin1);
      const end = this.getPinPosition(connection.pin2);
      const mid = {
        x: (start.x + end.x) / 2,
        y: (start.y + end.y) / 2,
      };
      connection.anchors.push(mid);
      this.updateWirePath(connection);
    }

    this.createAnchorHandles(connection);
  }

  stopEditingConnection() {
    this.cancelConnectionDrag(true);
    if (!this.editingConnection) return;

    const connection = this.editingConnection;
    this.removeAnchorHandles();
    connection.line.classList.remove('wire-editing');
    if (this.activeAnchorHandle) {
      window.removeEventListener('pointermove', this.handleAnchorPointerMove);
      window.removeEventListener('pointerup', this.handleAnchorPointerUp);
      window.removeEventListener('pointercancel', this.handleAnchorPointerUp);
      this.activeAnchorHandle = null;
    }
    this.toggleGuideLines(false);
    this.editingConnection = null;
  }

  createAnchorHandles(connection) {
    this.removeAnchorHandles();
    this.activeAnchorHandle = null;
    connection.anchors.forEach((anchor, index) => {
      const handle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      handle.classList.add('wire-anchor-handle');
      handle.setAttribute('r', '6');
      handle.dataset.anchorIndex = String(index);
      this.svgLayer.appendChild(handle);
      this.anchorHandles.push(handle);
      this.positionAnchorHandle(handle, anchor);

      handle.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        event.stopPropagation();
        handle.setPointerCapture(event.pointerId);
        this.activeAnchorHandle = {
          pointerId: event.pointerId,
          index,
          handle,
        };
        window.addEventListener('pointermove', this.handleAnchorPointerMove);
        window.addEventListener('pointerup', this.handleAnchorPointerUp);
        window.addEventListener('pointercancel', this.handleAnchorPointerUp);
      });
    });
  }

  removeAnchorHandles() {
    this.anchorHandles.forEach((handle) => handle.remove());
    this.anchorHandles = [];
  }

  positionAnchorHandle(handle, anchor) {
    handle.setAttribute('cx', anchor.x);
    handle.setAttribute('cy', anchor.y);
  }

  updateAnchorHandlePositions(connection) {
    if (!this.editingConnection || this.editingConnection.id !== connection.id) return;
    connection.anchors.forEach((anchor, index) => {
      const handle = this.anchorHandles[index];
      if (!handle) return;
      this.positionAnchorHandle(handle, anchor);
    });
  }

  handleAnchorPointerMove(event) {
    if (!this.activeAnchorHandle || !this.editingConnection) return;
    const { pointerId, index } = this.activeAnchorHandle;
    if (event.pointerId !== pointerId) return;
    event.preventDefault();
    const pointer = this.getWorkspaceCoordinates(event);
    const connection = this.editingConnection;
    if (!connection.anchors[index]) return;
    const prev = connection.anchors[index - 1] ?? this.getPinPosition(connection.pin1);
    const next = connection.anchors[index + 1] ?? this.getPinPosition(connection.pin2);
    const snapResult = this.applyAxisSnap(pointer, [prev, next]);
    const coords = snapResult.point;
    connection.anchors[index] = coords;
    this.positionAnchorHandle(this.anchorHandles[index], coords);
    this.updateWirePath(connection);
    const origin = snapResult.reference ?? prev ?? next ?? coords;
    this.toggleGuideLines(true);
    this.updateGuideLines(origin, coords);
  }

  handleAnchorPointerUp(event) {
    if (!this.activeAnchorHandle || event.pointerId !== this.activeAnchorHandle.pointerId) return;
    if (this.editingConnection) {
      this.updateWirePath(this.editingConnection);
      this.updateAnchorHandlePositions(this.editingConnection);
      this.canvasManager.notifyInteraction();
    }
    this.activeAnchorHandle = null;
    window.removeEventListener('pointermove', this.handleAnchorPointerMove);
    window.removeEventListener('pointerup', this.handleAnchorPointerUp);
    window.removeEventListener('pointercancel', this.handleAnchorPointerUp);
    this.toggleGuideLines(false);
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

      const anchors = Array.isArray(wire.anchors)
        ? wire.anchors
            .map((point) => ({ x: Number(point.x), y: Number(point.y) }))
            .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
        : [];

      const connection = this.createConnection(pin1, pin2, {
        silent: true,
        anchors,
      });
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

    this.scheduleConnectionRefresh({
      immediate: true,
      minFrames: 4,
      durationMs: 160,
      maxDurationMs: 360,
    });
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
      anchors: connection.anchors.map((point) => ({ x: point.x, y: point.y })),
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
    this.svgLayer.style.overflow = 'visible';
    this.svgLayer.setAttribute('overflow', 'visible');
    (this.viewport ?? this.workspace).appendChild(this.svgLayer);
  }

  createTempWire() {
    this.tempWire = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    this.tempWire.id = 'temp-wire';
    this.tempWire.setAttribute('stroke', '#007acc');
    this.tempWire.setAttribute('stroke-width', '3');
    this.tempWire.setAttribute('stroke-dasharray', '6 4');
    this.tempWire.setAttribute('fill', 'none');
    this.tempWire.setAttribute('stroke-linejoin', 'round');
    this.tempWire.setAttribute('stroke-linecap', 'round');
    this.tempWire.style.display = 'none';
    this.tempWire.style.pointerEvents = 'none';
    this.svgLayer.appendChild(this.tempWire);
  }

  createGuideLines() {
    this.guideHorizontal = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    this.guideVertical = document.createElementNS('http://www.w3.org/2000/svg', 'line');

    [this.guideHorizontal, this.guideVertical].forEach((line) => {
      line.classList.add('wire-guide');
      line.setAttribute('stroke', '#7f8c8d');
      line.setAttribute('stroke-width', '1.5');
      line.setAttribute('stroke-dasharray', '4 4');
      line.setAttribute('stroke-linecap', 'round');
      line.style.display = 'none';
      this.svgLayer.appendChild(line);
    });
  }

  cancelWiring() {
    if (this.selectedPin) {
      this.selectedPin.classList.remove('pin-selected');
      this.selectedPin = null;
    }
    this.tempWireAnchors = [];
    this.tempWireCursor = null;
    this.tempWire.style.display = 'none';
    this.tempWire.removeAttribute('d');
    this.workspace.style.cursor = 'default';
    this.toggleGuideLines(false);
    hideContextMenu();
  }

  updateTempWire(event) {
    this.tempWireCursor = this.getWorkspaceCoordinates(event);
    this.renderTempWire();
  }

  renderTempWire() {
    if (!this.isWiring()) return;
    const start = this.getPinPosition(this.selectedPin);
    const points = [start, ...this.tempWireAnchors.map((point) => ({ ...point }))];
    if (this.tempWireCursor) {
      points.push({ ...this.tempWireCursor });
    } else {
      points.push({ ...start });
    }
    this.tempWire.setAttribute('d', this.buildRoundedPath(points, 10));
    this.updateGuideLines(start, this.tempWireCursor ?? start);
  }

  updateGuideLines(originPoint, targetPoint) {
    if (!this.guideHorizontal || !this.guideVertical) return;
    if (!(this.isWiring() || this.isEditingConnection())) {
      this.toggleGuideLines(false);
      return;
    }

    let origin = originPoint;
    let target = targetPoint;

    if (this.isWiring()) {
      origin = this.tempWireAnchors[this.tempWireAnchors.length - 1] ?? originPoint;
      target = targetPoint;
    } else if ((!origin || !target) && this.isEditingConnection()) {
      const fallback = this.getEditingGuideData();
      origin = fallback?.origin ?? origin;
      target = fallback?.target ?? target;
    }

    if (!origin || !target) {
      this.toggleGuideLines(false);
      return;
    }
    const showHorizontal = Math.abs(origin.x - target.x) > 0.5;
    const showVertical = Math.abs(origin.y - target.y) > 0.5;

    const horizontalAligned = Math.abs(origin.y - target.y) <= GUIDE_ACTIVE_THRESHOLD;
    const verticalAligned = Math.abs(origin.x - target.x) <= GUIDE_ACTIVE_THRESHOLD;

    const showHorizontalLine = showHorizontal || horizontalAligned;
    const showVerticalLine = showVertical || verticalAligned;

    if (showHorizontalLine) {
      this.guideHorizontal.setAttribute('x1', origin.x);
      this.guideHorizontal.setAttribute('y1', origin.y);
      this.guideHorizontal.setAttribute('x2', target.x);
      this.guideHorizontal.setAttribute('y2', origin.y);
      this.guideHorizontal.style.display = 'block';
    } else {
      this.guideHorizontal.style.display = 'none';
    }
    this.guideHorizontal?.classList.toggle('wire-guide-active', horizontalAligned);

    if (showVerticalLine) {
      this.guideVertical.setAttribute('x1', target.x);
      this.guideVertical.setAttribute('y1', origin.y);
      this.guideVertical.setAttribute('x2', target.x);
      this.guideVertical.setAttribute('y2', target.y);
      this.guideVertical.style.display = 'block';
    } else {
      this.guideVertical.style.display = 'none';
    }
    this.guideVertical?.classList.toggle('wire-guide-active', verticalAligned);
  }

  toggleGuideLines(visible) {
    [this.guideHorizontal, this.guideVertical].forEach((line) => {
      if (!line) return;
      if (visible) {
        line.style.display = 'block';
      } else {
        line.style.display = 'none';
        line.classList.remove('wire-guide-active');
      }
    });
  }

  getEditingGuideData() {
    if (!this.isEditingConnection() || !this.activeAnchorHandle) return null;
    const index = this.activeAnchorHandle.index;
    const connection = this.editingConnection;
    const current = connection.anchors[index];
    if (!current) return null;

    const prev = connection.anchors[index - 1] ?? this.getPinPosition(connection.pin1);
    return {
      origin: prev,
      target: current,
    };
  }

  addAnchorPoint(point) {
    if (!this.isWiring()) return;
    const lastAnchor = this.tempWireAnchors[this.tempWireAnchors.length - 1];
    if (lastAnchor && this.pointsAreEqual(lastAnchor, point)) {
      return;
    }
    this.tempWireAnchors.push({ ...point });
    this.tempWireCursor = { ...point };
    this.renderTempWire();
  }

  startConnectionDrag(connection, event) {
    this.cancelConnectionDrag(false);
    const pointer = this.getWorkspaceCoordinates(event);
    this.connectionDragState = {
      connection,
      pointerId: event.pointerId,
      start: pointer,
      anchorsSnapshot: connection.anchors.map((anchor) => ({ ...anchor })),
      originSnapshot: {
        start: this.getPinPosition(connection.pin1),
        end: this.getPinPosition(connection.pin2),
      },
      axis: null,
    };
    connection.line.setPointerCapture?.(event.pointerId);
    window.addEventListener('pointermove', this.handleConnectionDragMove);
    window.addEventListener('pointerup', this.handleConnectionDragEnd);
    window.addEventListener('pointercancel', this.handleConnectionDragEnd);
    this.toggleGuideLines(true);
  }

  handleConnectionDragMove(event) {
    if (!this.connectionDragState || event.pointerId !== this.connectionDragState.pointerId) {
      return;
    }

    const state = this.connectionDragState;
    const pointer = this.getWorkspaceCoordinates(event);
    let dx = pointer.x - state.start.x;
    let dy = pointer.y - state.start.y;

    if (!state.axis) {
      state.axis = Math.abs(dx) >= Math.abs(dy) ? 'horizontal' : 'vertical';
    }

    if (state.axis === 'horizontal') {
      dy = 0;
    } else {
      dx = 0;
    }

    const snappedVector = this.applyAxisSnap(
      { x: state.start.x + dx, y: state.start.y + dy },
      [state.start],
    );
    dx = snappedVector.point.x - state.start.x;
    dy = snappedVector.point.y - state.start.y;

    state.connection.anchors = state.anchorsSnapshot.map((anchor) => ({
      x: anchor.x + dx,
      y: anchor.y + dy,
    }));

    this.updateWirePath(state.connection);
    this.updateAnchorHandlePositions(state.connection);
    this.updateGuideLines(state.start, { x: state.start.x + dx, y: state.start.y + dy });
  }

  handleConnectionDragEnd(event) {
    if (!this.connectionDragState || event.pointerId !== this.connectionDragState.pointerId) {
      return;
    }
    this.connectionDragState.connection.line.releasePointerCapture?.(event.pointerId);
    this.canvasManager.notifyInteraction();
    this.cancelConnectionDrag(true);
  }

  cancelConnectionDrag(resetGuides) {
    if (!this.connectionDragState) return;
    this.connectionDragState.connection.line.releasePointerCapture?.(
      this.connectionDragState.pointerId,
    );
    window.removeEventListener('pointermove', this.handleConnectionDragMove);
    window.removeEventListener('pointerup', this.handleConnectionDragEnd);
    window.removeEventListener('pointercancel', this.handleConnectionDragEnd);
    if (resetGuides) {
      this.toggleGuideLines(false);
    }
    this.connectionDragState = null;
  }

  addAnchorToEditingConnection(point, options = {}) {
    if (!this.isEditingConnection()) return null;
    const connection = this.editingConnection;

    let insertIndex = options.insertIndex;
    let newPoint = point;

    if (insertIndex === undefined) {
      const placement = this.computeAnchorPlacement(connection, point);
      insertIndex = placement.insertIndex;
      newPoint = placement.point;
    }

    connection.anchors.splice(insertIndex, 0, { ...newPoint });
    this.updateWirePath(connection);
    this.createAnchorHandles(connection);
    this.updateAnchorHandlePositions(connection);

    const handle = this.anchorHandles[insertIndex] ?? null;
    const beginPointerId = options.beginDragPointerId;

    if (beginPointerId != null && handle) {
      this.activeAnchorHandle = {
        pointerId: beginPointerId,
        index: insertIndex,
        handle,
      };
      const origin =
        connection.anchors[insertIndex - 1] ?? this.getPinPosition(connection.pin1);
      this.toggleGuideLines(true);
      this.updateGuideLines(origin, connection.anchors[insertIndex]);
      window.addEventListener('pointermove', this.handleAnchorPointerMove);
      window.addEventListener('pointerup', this.handleAnchorPointerUp);
      window.addEventListener('pointercancel', this.handleAnchorPointerUp);
    } else {
      this.activeAnchorHandle = null;
      this.toggleGuideLines(false);
    }

    this.canvasManager.notifyInteraction();
    return handle;
  }

  isWiring() {
    return Boolean(this.selectedPin);
  }

  isEditingConnection() {
    return Boolean(this.editingConnection);
  }

  getWorkspaceCoordinates(event) {
    if (!event) {
      return { x: 0, y: 0 };
    }
    return this.canvasManager?.clientToWorkspace(event.clientX, event.clientY) ?? {
      x: event.clientX,
      y: event.clientY,
    };
  }

  updateWirePath(connection) {
    const points = this.getConnectionPoints(connection);
    connection.line.setAttribute('d', this.buildRoundedPath(points));
  }

  getConnectionPoints(connection) {
    const start = this.getPinPosition(connection.pin1);
    const end = this.getPinPosition(connection.pin2);
    return [start, ...connection.anchors.map((point) => ({ ...point })), end];
  }

  buildRoundedPath(points, radius = 12) {
    if (!Array.isArray(points) || points.length === 0) {
      return '';
    }

    const cleaned = points.filter((point, index) => {
      if (index === 0) return true;
      const previous = points[index - 1];
      return !this.pointsAreEqual(point, previous);
    });

    if (!cleaned.length) {
      return '';
    }

    if (cleaned.length === 1) {
      const { x, y } = cleaned[0];
      return `M ${x} ${y}`;
    }

    let path = `M ${cleaned[0].x} ${cleaned[0].y}`;

    if (cleaned.length === 2) {
      const { x, y } = cleaned[1];
      return `${path} L ${x} ${y}`;
    }

    for (let i = 1; i < cleaned.length - 1; i += 1) {
      const prev = cleaned[i - 1];
      const current = cleaned[i];
      const next = cleaned[i + 1];

      const v1 = { x: current.x - prev.x, y: current.y - prev.y };
      const v2 = { x: next.x - current.x, y: next.y - current.y };
      const len1 = Math.hypot(v1.x, v1.y);
      const len2 = Math.hypot(v2.x, v2.y);

      if (len1 === 0 || len2 === 0) {
        path += ` L ${current.x} ${current.y}`;
        continue;
      }

      const unit1 = { x: v1.x / len1, y: v1.y / len1 };
      const unit2 = { x: v2.x / len2, y: v2.y / len2 };

      const dot = unit1.x * unit2.x + unit1.y * unit2.y;
      const cross = unit1.x * unit2.y - unit1.y * unit2.x;

      if (Math.abs(cross) < 1e-5 && dot > 0.999) {
        path += ` L ${current.x} ${current.y}`;
        continue;
      }

      const cornerRadius = Math.min(radius, len1 / 2, len2 / 2);
      if (cornerRadius <= 0) {
        path += ` L ${current.x} ${current.y}`;
        continue;
      }

      const startX = current.x - unit1.x * cornerRadius;
      const startY = current.y - unit1.y * cornerRadius;
      const endX = current.x + unit2.x * cornerRadius;
      const endY = current.y + unit2.y * cornerRadius;

      path += ` L ${startX} ${startY}`;
      path += ` Q ${current.x} ${current.y} ${endX} ${endY}`;
    }

    const lastPoint = cleaned[cleaned.length - 1];
    path += ` L ${lastPoint.x} ${lastPoint.y}`;
    return path;
  }

  pointsAreEqual(pointA, pointB) {
    const epsilon = 0.5;
    return (
      Math.abs(pointA.x - pointB.x) <= epsilon &&
      Math.abs(pointA.y - pointB.y) <= epsilon
    );
  }

  applyAxisSnap(point, references = []) {
    let bestReference = null;
    let bestAxis = null;
    let bestDelta = SNAP_THRESHOLD + 1;

    references.filter(Boolean).forEach((ref) => {
      const deltaX = Math.abs(ref.x - point.x);
      if (deltaX < bestDelta) {
        bestDelta = deltaX;
        bestAxis = 'vertical';
        bestReference = ref;
      }
      const deltaY = Math.abs(ref.y - point.y);
      if (deltaY < bestDelta) {
        bestDelta = deltaY;
        bestAxis = 'horizontal';
        bestReference = ref;
      }
    });

    const snapped = { ...point };
    if (bestReference && bestDelta <= SNAP_THRESHOLD) {
      if (bestAxis === 'horizontal') {
        snapped.y = bestReference.y;
      } else {
        snapped.x = bestReference.x;
      }
    }

    return { point: snapped, reference: bestReference, axis: bestAxis };
  }

  updateAllConnections() {
    this.connections.forEach((connection) => {
      this.updateWirePath(connection);
      this.updateAnchorHandlePositions(connection);
    });
  }

  cancelScheduledConnectionRefresh() {
    const handle = this.connectionRefreshHandle;
    if (!handle) return;
    if (typeof handle.cancel === 'function') {
      handle.cancel();
      return;
    }
    handle.active = false;
    if (typeof window !== 'undefined') {
      if (typeof window.cancelAnimationFrame === 'function' && handle.rafId != null) {
        window.cancelAnimationFrame(handle.rafId);
      }
      if (typeof window.clearTimeout === 'function' && handle.timeoutId != null) {
        window.clearTimeout(handle.timeoutId);
      }
    }
    if (this.connectionRefreshHandle === handle) {
      this.connectionRefreshHandle = null;
    }
  }

  scheduleConnectionRefresh(options = {}) {
    const {
      immediate = true,
      minFrames = 3,
      durationMs = 180,
      maxDurationMs = 420,
    } = options ?? {};

    if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
      if (immediate) {
        this.updateAllConnections();
      }
      return;
    }

    this.cancelScheduledConnectionRefresh();

    const safeMinFrames = Math.max(1, Number(minFrames) || 0);
    const minimumDuration = Math.max(0, Number(durationMs) || 0);
    const capDuration = Math.max(minimumDuration, Number(maxDurationMs) || minimumDuration);

    const handle = {
      active: true,
      rafId: null,
      timeoutId: null,
      frames: 0,
      start: window.performance?.now?.() ?? Date.now(),
    };
    this.connectionRefreshHandle = handle;

    const cancel = () => {
      if (!handle.active) {
        return;
      }
      handle.active = false;
      if (handle.rafId != null && typeof window.cancelAnimationFrame === 'function') {
        window.cancelAnimationFrame(handle.rafId);
      }
      if (handle.timeoutId != null && typeof window.clearTimeout === 'function') {
        window.clearTimeout(handle.timeoutId);
      }
      if (this.connectionRefreshHandle === handle) {
        this.connectionRefreshHandle = null;
      }
    };

    handle.cancel = cancel;

    const updateConnections = () => {
      if (!handle.active) {
        return;
      }
      this.updateAllConnections();
    };

    if (immediate) {
      updateConnections();
    }

    const tick = () => {
      if (!handle.active) {
        return;
      }

      updateConnections();
      handle.frames += 1;

      if (!handle.active) {
        return;
      }

      const now = window.performance?.now?.() ?? Date.now();
      const elapsed = now - handle.start;

      if (handle.frames < safeMinFrames || elapsed < minimumDuration) {
        handle.rafId = window.requestAnimationFrame(tick);
        return;
      }

      cancel();
    };

    handle.rafId = window.requestAnimationFrame(tick);

    const finalTimeout = Math.min(capDuration + 120, 1000);
    handle.timeoutId = window.setTimeout(() => {
      if (!handle.active) {
        return;
      }
      updateConnections();
      cancel();
    }, finalTimeout);
  }

  scheduleRefreshAfterMediaLoad(container) {
    if (!container || typeof window === 'undefined') {
      return;
    }

    const mediaElements = Array.from(
      container.querySelectorAll('img, video, canvas, svg image'),
    );
    if (!mediaElements.length) {
      return;
    }

    let pending = mediaElements.length;
    let triggered = false;

    const schedule = () => {
      if (triggered) {
        return;
      }
      triggered = true;
      this.scheduleConnectionRefresh({
        immediate: true,
        minFrames: 6,
        durationMs: 220,
        maxDurationMs: 420,
      });
    };

    const handleReady = () => {
      pending -= 1;
      if (pending <= 0) {
        window.requestAnimationFrame(schedule);
      }
    };

    mediaElements.forEach((element) => {
      if (!element) {
        pending -= 1;
        return;
      }
      if (element.tagName === 'IMG') {
        const img = element;
        if (img.complete && img.naturalWidth > 0) {
          handleReady();
        } else {
          const once = () => {
            img.removeEventListener('load', once);
            img.removeEventListener('error', once);
            handleReady();
          };
          img.addEventListener('load', once, { once: true });
          img.addEventListener('error', once, { once: true });
        }
        return;
      }
      if (element.tagName === 'VIDEO') {
        const video = element;
        if (video.readyState >= 2) {
          handleReady();
        } else {
          const once = () => {
            video.removeEventListener('loadeddata', once);
            video.removeEventListener('error', once);
            handleReady();
          };
          video.addEventListener('loadeddata', once, { once: true });
          video.addEventListener('error', once, { once: true });
        }
        return;
      }
      // Canvas or other media-like elements – assume immediately ready
      handleReady();
    });
  }

  updatePinPositionsForComponent(componentId, options = {}) {
    if (!componentId) return;
    const pins = this.pinRegistry.get(componentId);
    if (!pins || !pins.length) {
      return;
    }

    const container = this.canvasManager?.getComponentVisualWrapper?.(componentId);
    if (!container) {
      return;
    }

    const scale = this.canvasManager?.viewportState?.scale ?? 1;
    let updated = false;

    pins.forEach((pin) => {
      const selector = pin.dataset?.pinSelector;
      if (!selector) {
        return;
      }
      const target = container.querySelector(selector);
      if (!target) {
        return;
      }
      const position = this.getRelativeCenter(target, container);
      const adjustedX = scale ? position.x / scale : position.x;
      const adjustedY = scale ? position.y / scale : position.y;
      pin.style.left = `${adjustedX}px`;
      pin.style.top = `${adjustedY}px`;
      updated = true;
    });

    if (updated && options?.skipConnectionUpdate !== true) {
      this.scheduleConnectionRefresh({
        immediate: true,
        minFrames: 2,
        durationMs: 160,
        maxDurationMs: 320,
      });
    }
  }

  resetAnchorsForComponent(componentId) {
    this.connections.forEach((connection) => {
      const pin1Component = connection.pin1?.dataset?.componentId;
      const pin2Component = connection.pin2?.dataset?.componentId;
      if (pin1Component === componentId || pin2Component === componentId) {
        connection.anchors = [];
      }
    });
  }

  getPinPosition(pin) {
    // Force layout update to ensure transforms are applied before measuring
    void pin?.offsetWidth;
    if (!pin) {
      return { x: 0, y: 0 };
    }
    const rect = pin.getBoundingClientRect();
    return (
      this.canvasManager?.clientToWorkspace(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
      ) ?? {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      }
    );
  }

  getWireColor(type1, type2) {
    if (type1 === 'ground' || type2 === 'ground') return '#1f2937';
    if (type1 === 'power' || type2 === 'power') return '#ef4444';
    return '#0ea5e9';
  }

  computeAnchorPlacement(connection, point) {
    const pathPoints = [
      this.getPinPosition(connection.pin1),
      ...connection.anchors.map((anchor) => ({ ...anchor })),
      this.getPinPosition(connection.pin2),
    ];

    let closestIndex = 0;
    let closestPoint = this.projectPointOnSegment(point, pathPoints[0], pathPoints[1]);
    let minDistanceSq = this.distanceSquared(point, closestPoint);

    for (let i = 0; i < pathPoints.length - 1; i += 1) {
      const projection = this.projectPointOnSegment(point, pathPoints[i], pathPoints[i + 1]);
      const distanceSq = this.distanceSquared(point, projection);
      if (distanceSq < minDistanceSq) {
        minDistanceSq = distanceSq;
        closestIndex = i;
        closestPoint = projection;
      }
    }

    const insertIndex = Math.min(Math.max(closestIndex, 0), connection.anchors.length);
    return { insertIndex, point: closestPoint };
  }

  projectPointOnSegment(point, start, end) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSq = dx * dx + dy * dy || 1;
    let t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq;
    t = Math.max(0, Math.min(1, t));
    return {
      x: start.x + t * dx,
      y: start.y + t * dy,
    };
  }

  distanceSquared(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
  }
}
