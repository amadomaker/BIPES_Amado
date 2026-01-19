import { WiringManager } from './wiring.js';
import {
  updatePropertiesPanel,
  clearPropertiesPanel,
  showComponentContextMenu,
  hideContextMenu,
} from './ui.js';
import { availableComponents, getLedColorInfo } from './components.js';

const FLIPPABLE_COMPONENT_TYPES = new Set(['led']);
const PHOTORESISTOR_MIN_OHMS = 500;
const PHOTORESISTOR_MAX_OHMS = 1_000_000;

export class CanvasManager {
  constructor(options = {}) {
    this.workspace = document.getElementById('workspace');
    if (!this.workspace) {
      throw new Error('Simulator workspace element not found.');
    }

    this.viewportElement = document.createElement('div');
    this.viewportElement.id = 'workspace-content';
    this.viewportElement.style.position = 'absolute';
    this.viewportElement.style.inset = '0';
    this.viewportElement.style.transformOrigin = '0 0';
    while (this.workspace.firstChild) {
      this.viewportElement.appendChild(this.workspace.firstChild);
    }
    this.workspace.appendChild(this.viewportElement);

    this.components = [];
    this.selectedComponentId = null;
    this.nextId = 1;
    this.onInteraction = options.onInteraction ?? (() => {});
    this.isInteractionLocked = options.isInteractionLocked ?? (() => false);

    this.viewportState = {
      scale: 1,
      panX: 0,
      panY: 0,
      minScale: 0.35,
      maxScale: 3,
    };
    this.isPanning = false;
    this.panPointerId = null;
    this.panStart = null;
    this.panOrigin = null;
    this.panCaptureElement = null;
    this.panMoved = false;
    this.ignoreNextWorkspaceClick = false;

    this.handleWheel = this.handleWheel.bind(this);
    this.handlePanPointerDown = this.handlePanPointerDown.bind(this);
    this.handlePanPointerMove = this.handlePanPointerMove.bind(this);
    this.handlePanPointerUp = this.handlePanPointerUp.bind(this);

    this.wiringManager = new WiringManager(this);

    this.applyViewportTransform();
    this.workspace.classList.add('allow-pan');
    this.workspace.addEventListener('pointerdown', this.handlePanPointerDown);
    this.workspace.addEventListener('wheel', this.handleWheel, { passive: false });

    this.setupWorkspaceListeners();
  }

  setupWorkspaceListeners() {
    this.workspace.addEventListener('click', (event) => {
      if (this.ignoreNextWorkspaceClick) {
        this.ignoreNextWorkspaceClick = false;
        return;
      }

      if (this.wiringManager?.isWiring()) {
        return;
      }

      if (this.wiringManager?.isEditingConnection()) {
        this.clearSelections();
        return;
      }

      if (
        event.target === this.workspace ||
        event.target === this.viewportElement ||
        event.target === this.wiringManager?.svgLayer
      ) {
        this.clearSelections();
      }
    });
  }

  applyViewportTransform() {
    if (!this.viewportElement) return;
    const { scale, panX, panY } = this.viewportState;
    this.viewportElement.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
    this.refreshOverlayPositions();
  }

  refreshOverlayPositions() {
    this.components.forEach((component) => {
      if (component.type === 'photoresistor') {
        const controls = component.element?.__controls;
        if (!controls || controls.style.display === 'none') return;
        this.positionPhotoresistorControls(component);
        return;
      }
      if (component.type === 'ultrasonic-sensor') {
        const controls = component.element?.__controls;
        if (!controls || controls.style.display === 'none') return;
        this.positionUltrasonicControls(component);
      }
    });
  }

  clientToWorkspace(clientX, clientY) {
    if (!this.workspace) {
      return { x: clientX, y: clientY };
    }
    const rect = this.workspace.getBoundingClientRect();
    const { scale, panX, panY } = this.viewportState;
    return {
      x: (clientX - rect.left - panX) / scale,
      y: (clientY - rect.top - panY) / scale,
    };
  }

  workspaceToViewport(x, y) {
    const { scale, panX, panY } = this.viewportState;
    return {
      x: x * scale + panX,
      y: y * scale + panY,
    };
  }

  resetViewport() {
    this.viewportState.scale = 1;
    this.viewportState.panX = 0;
    this.viewportState.panY = 0;
    this.applyViewportTransform();
  }

  focusViewportOnContent({ components = this.components, padding = 96 } = {}) {
    const items = Array.isArray(components) ? components : [];
    if (!items.length) {
      this.resetViewport();
      return;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    items.forEach((component) => {
      if (!component?.container) return;
      const left = component.container.offsetLeft ?? 0;
      const top = component.container.offsetTop ?? 0;
      const width =
        component.container.offsetWidth ??
        component.visualWrapper?.offsetWidth ??
        component.element?.offsetWidth ??
        0;
      const height =
        component.container.offsetHeight ??
        component.visualWrapper?.offsetHeight ??
        component.element?.offsetHeight ??
        0;

      if (!Number.isFinite(left) || !Number.isFinite(top)) {
        return;
      }

      minX = Math.min(minX, left);
      minY = Math.min(minY, top);
      maxX = Math.max(maxX, left + width);
      maxY = Math.max(maxY, top + height);
    });

    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
      this.resetViewport();
      return;
    }

    const paddingValue = Math.max(0, Number(padding) || 0);
    const contentWidth = Math.max(maxX - minX, 40);
    const contentHeight = Math.max(maxY - minY, 40);
    const workspaceRect = this.workspace.getBoundingClientRect();
    const viewportWidth = workspaceRect.width || this.workspace.clientWidth || 1;
    const viewportHeight = workspaceRect.height || this.workspace.clientHeight || 1;

    const availableWidth = Math.max(viewportWidth - paddingValue * 2, 40);
    const availableHeight = Math.max(viewportHeight - paddingValue * 2, 40);

    const scaleX = availableWidth / contentWidth;
    const scaleY = availableHeight / contentHeight;
    const fitScale = Math.min(scaleX, scaleY);

    this.viewportState.scale = this.clampValue(
      fitScale,
      this.viewportState.minScale,
      this.viewportState.maxScale,
    );

    const contentCenterX = minX + contentWidth / 2;
    const contentCenterY = minY + contentHeight / 2;
    const viewportCenterX = viewportWidth / 2;
    const viewportCenterY = viewportHeight / 2;

    this.viewportState.panX = viewportCenterX - contentCenterX * this.viewportState.scale;
    this.viewportState.panY = viewportCenterY - contentCenterY * this.viewportState.scale;

    this.applyViewportTransform();
  }

  handleWheel(event) {
    if (!event || !this.workspace) return;
    event.preventDefault();
    const zoomIntensity = 0.0015;
    const scaleFactor = Math.exp(-event.deltaY * zoomIntensity);
    this.zoomAt(scaleFactor, event.clientX, event.clientY);
  }

  zoomAt(scaleFactor, clientX, clientY) {
    if (!Number.isFinite(scaleFactor) || scaleFactor === 0) {
      return;
    }
    const { scale, minScale, maxScale, panX, panY } = this.viewportState;
    let nextScale = this.clampValue(scale * scaleFactor, minScale, maxScale);
    if (Math.abs(nextScale - scale) < 1e-4) {
      return;
    }

    const rect = this.workspace.getBoundingClientRect();
    const pointerX = clientX - rect.left;
    const pointerY = clientY - rect.top;

    const preZoomX = (pointerX - panX) / scale;
    const preZoomY = (pointerY - panY) / scale;

    this.viewportState.scale = nextScale;
    this.viewportState.panX = pointerX - preZoomX * nextScale;
    this.viewportState.panY = pointerY - preZoomY * nextScale;

    this.applyViewportTransform();
  }

  shouldStartPan(event) {
    if (this.wiringManager?.isWiring() || this.wiringManager?.isEditingConnection()) {
      return false;
    }
    if (!event || event.button !== 0) return false;
    const target = event.target;
    if (!target) return true;
    if (target.closest('.canvas-component')) return false;
    if (target.closest('.pin')) return false;
    if (target.closest('.wire')) return false;
    if (target.closest('.wire-anchor-handle')) return false;
    if (target.closest('.component-embedded-control')) return false;
    if (target.closest('.photoresistor-controls')) return false;
    if (target.closest('.context-menu')) return false;
    return true;
  }

  handlePanPointerDown(event) {
    if (event.button === 1 || (event.button === 0 && this.shouldStartPan(event))) {
      if (event.button === 0 && (this.wiringManager?.isWiring() || this.wiringManager?.isEditingConnection())) {
        return;
      }
      event.preventDefault();
      hideContextMenu();
      this.isPanning = true;
      this.panPointerId = event.pointerId;
      this.panStart = { x: event.clientX, y: event.clientY };
      this.panOrigin = { x: this.viewportState.panX, y: this.viewportState.panY };
      this.panCaptureElement = event.target;
      this.panMoved = false;
      this.workspace.classList.add('is-panning');
      this.panCaptureElement?.setPointerCapture?.(event.pointerId);
      window.addEventListener('pointermove', this.handlePanPointerMove);
      window.addEventListener('pointerup', this.handlePanPointerUp);
      window.addEventListener('pointercancel', this.handlePanPointerUp);
    }
  }

  handlePanPointerMove(event) {
    if (!this.isPanning || event.pointerId !== this.panPointerId) return;
    event.preventDefault();
    const dx = event.clientX - this.panStart.x;
    const dy = event.clientY - this.panStart.y;
    this.viewportState.panX = this.panOrigin.x + dx;
    this.viewportState.panY = this.panOrigin.y + dy;
    if (!this.panMoved && (Math.abs(dx) > 1 || Math.abs(dy) > 1)) {
      this.panMoved = true;
    }
    this.applyViewportTransform();
  }

  handlePanPointerUp(event) {
    if (!this.isPanning || event.pointerId !== this.panPointerId) return;
    this.panCaptureElement?.releasePointerCapture?.(event.pointerId);
    window.removeEventListener('pointermove', this.handlePanPointerMove);
    window.removeEventListener('pointerup', this.handlePanPointerUp);
    window.removeEventListener('pointercancel', this.handlePanPointerUp);
    this.workspace.classList.remove('is-panning');
    this.isPanning = false;
    if (this.panMoved) {
      this.ignoreNextWorkspaceClick = true;
    }
    this.panPointerId = null;
    this.panCaptureElement = null;
    this.panStart = null;
    this.panOrigin = null;
    this.panMoved = false;
  }

  clearSelections() {
    this.clearComponentSelection();
    this.wiringManager.deselectWire();
    hideContextMenu();
  }

  async addComponent(componentType, x, y, options = {}) {
    const definition = this.resolveComponentDefinition(componentType);
    if (!definition) return null;

    const componentId = options.id ?? this.generateComponentId();
    const container = document.createElement('div');
    container.className = 'canvas-component';
    container.id = componentId;
    container.dataset.componentType = definition.id;
    container.style.position = 'absolute';
    const baseZIndex = definition.id === 'protoboard-half' ? 0 : 1;
    const resolvedZIndex =
      typeof options.zIndex === 'number' && Number.isFinite(options.zIndex)
        ? options.zIndex
        : baseZIndex;
    container.style.zIndex = definition.id === 'protoboard-half' ? '0' : String(resolvedZIndex);
    container.style.left = `${x}px`;
    container.style.top = `${y}px`;
    container.style.cursor = 'move';
    container.setAttribute('draggable', 'false');
    container.addEventListener('dragstart', (e) => e.preventDefault());

    const appliedProps = { ...definition.defaultProps, ...(options.props ?? {}) };
    let element = null;
    let applyProps = null;

    if (typeof definition.createInstance === 'function') {
      const instance = definition.createInstance({ props: appliedProps, id: componentId });
      element = instance?.element ?? null;
      applyProps = instance?.applyProps ?? null;
    } else if (definition.element) {
      element = document.createElement(definition.element);
      applyProps = (props) => {
        Object.entries(props).forEach(([key, value]) => element.setAttribute(key, value));
      };
    }

    if (!element) {
      return null;
    }

    if (applyProps) {
      applyProps(appliedProps);
    }

    const label = document.createElement('div');
    label.className = 'component-label';
    label.textContent = definition.getLabel
      ? definition.getLabel(appliedProps)
      : definition.name;

    const visualWrapper = document.createElement('div');
    visualWrapper.className = 'component-visual';
    visualWrapper.dataset.componentId = componentId;
    visualWrapper.appendChild(element);

    container.appendChild(visualWrapper);
    // container.appendChild(label);
    this.viewportElement.appendChild(container);

    const transformState = {
      rotation: this.normaliseRotation(options.transform?.rotation ?? 0),
      flipped: Boolean(options.transform?.flipped),
    };

    const componentData = {
      id: componentId,
      type: definition.id,
      name: definition.name,
      element,
      container,
      visualWrapper,
      label,
      props: appliedProps,
      applyProps,
      state: { ...(options.state ?? {}) },
      transform: transformState,
    };

    this.components.push(componentData);
    this.attachComponentInteractions(componentData);
    this.attachComponentElementListeners(componentData);
    await this.wiringManager.addPinsToComponent(visualWrapper, definition, componentId);
    this.syncComponentRuntimeState(componentData);
    this.applyComponentTransform(componentData, { disableTransition: true });
    this.positionPhotoresistorControls(componentData);
    window.requestAnimationFrame(() => this.positionPhotoresistorControls(componentData));
    this.positionUltrasonicControls(componentData);
    window.requestAnimationFrame(() => this.positionUltrasonicControls(componentData));
    this.wiringManager.updateAllConnections();
    this.selectComponent(componentId);
    this.notifyInteraction();
    this.ensurePhotoresistorControls(componentData);
    this.ensureUltrasonicControls(componentData);
    this.updatePhotoresistorControlsVisibility();
    this.updateUltrasonicControlsVisibility();

    return componentId;
  }

  attachComponentInteractions(component) {
    const { container, id } = component;

    container.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      if (event.target.closest('.pin')) return;
      if (event.target.closest('.component-embedded-control')) {
        this.selectComponent(id);
        return;
      }
      if (this.isInteractionLocked?.()) {
        this.selectComponent(id);
        return;
      }

      container.setPointerCapture(event.pointerId);
      const startPoint = this.clientToWorkspace(event.clientX, event.clientY);
      const offsetX = startPoint.x - container.offsetLeft;
      const offsetY = startPoint.y - container.offsetTop;
      let moved = false;
      let lastPoint = startPoint;
      const attachedComponents =
        component.type === 'protoboard-half' ? this.getAttachedComponents(component) : null;

      const handlePointerMove = (moveEvent) => {
        if (moveEvent.pointerId !== event.pointerId) return;
        moveEvent.preventDefault();
        moved = true;

        const currentPoint = this.clientToWorkspace(moveEvent.clientX, moveEvent.clientY);
        const deltaX = currentPoint.x - lastPoint.x;
        const deltaY = currentPoint.y - lastPoint.y;
        lastPoint = currentPoint;
        const newX = currentPoint.x - offsetX;
        const newY = currentPoint.y - offsetY;

        container.style.left = `${newX}px`;
        container.style.top = `${newY}px`;
        if (component.type === 'protoboard-half' && attachedComponents?.length) {
          this.nudgeAttachedComponents(attachedComponents, { dx: deltaX, dy: deltaY });
        }
        this.wiringManager.updateAllConnections();
        if (component.type === 'photoresistor') {
          this.positionPhotoresistorControls(component);
        }
        if (component.type === 'ultrasonic-sensor') {
          this.positionUltrasonicControls(component);
        }
      };

      const handlePointerUp = (upEvent) => {
        if (upEvent.pointerId !== event.pointerId) return;

        container.releasePointerCapture(event.pointerId);
        container.removeEventListener('pointermove', handlePointerMove);
        container.removeEventListener('pointerup', handlePointerUp);
        container.removeEventListener('pointercancel', handlePointerUp);

        if (moved) {
          if (component.type === 'lab-prop') {
            window.dispatchEvent(
              new CustomEvent('simulator-pattern-interaction', {
                detail: { source: 'lab-prop' },
              }),
            );
          }
          this.snapComponentToProtoboard(component);
          this.notifyInteraction();
          if (component.type === 'photoresistor') {
            this.positionPhotoresistorControls(component);
          }
          if (component.type === 'ultrasonic-sensor') {
            this.positionUltrasonicControls(component);
          }
        } else {
          this.selectComponent(id);
        }
      };

      container.addEventListener('pointermove', handlePointerMove);
      container.addEventListener('pointerup', handlePointerUp);
      container.addEventListener('pointercancel', handlePointerUp);
    });

    container.addEventListener('click', (event) => {
      if (event.target.closest('.pin')) return;
      this.selectComponent(id);
    });

    container.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (this.isInteractionLocked?.()) {
        return;
      }
      this.selectComponent(id);
      showComponentContextMenu(event.clientX, event.clientY, {
        onBringToFront:
          component.type === 'protoboard-half' ? null : () => this.bringComponentToFront(id),
        onSendToBack:
          component.type === 'protoboard-half' ? null : () => this.sendComponentToBack(id),
        onDelete: () => this.removeComponent(id),
      });
    });
  }

  bringComponentToFront(componentId) {
    const component = this.getComponentById(componentId);
    if (!component || component.type === 'protoboard-half') return;
    const maxZ = this.components.reduce((currentMax, entry) => {
      if (entry.type === 'protoboard-half') return currentMax;
      const value = Number.parseInt(entry.container.style.zIndex, 10);
      return Number.isFinite(value) ? Math.max(currentMax, value) : currentMax;
    }, 1);
    component.container.style.zIndex = String(maxZ + 1);
    this.notifyInteraction();
  }

  sendComponentToBack(componentId) {
    const component = this.getComponentById(componentId);
    if (!component || component.type === 'protoboard-half') return;

    const otherComponents = this.components.filter(
      (entry) => entry.type !== 'protoboard-half' && entry.id !== componentId,
    );
    if (!otherComponents.length) {
      component.container.style.zIndex = '1';
      this.notifyInteraction();
      return;
    }

    const zIndices = otherComponents.map((entry) => {
      const value = Number.parseInt(entry.container.style.zIndex, 10);
      return Number.isFinite(value) ? value : 1;
    });
    const minZ = Math.min(...zIndices);

    if (minZ <= 1) {
      otherComponents.forEach((entry) => {
        const value = Number.parseInt(entry.container.style.zIndex, 10);
        if (!Number.isFinite(value) || value <= 1) {
          entry.container.style.zIndex = '2';
        }
      });
      component.container.style.zIndex = '1';
    } else {
      component.container.style.zIndex = String(minZ - 1);
    }

    this.notifyInteraction();
  }

  snapComponentToProtoboard(component) {
    if (!this.wiringManager) return;
    if (component.type === 'protoboard-half') return;

    const protoboards = this.components.filter((item) => item.type === 'protoboard-half');
    if (!protoboards.length) return;

    const componentPins = this.wiringManager.getPinsForComponent(component.id);
    if (!componentPins.length) return;

    const maxDistancePx = 12;
    const maxDistanceSq = maxDistancePx * maxDistancePx;
    let bestMatch = null;

    protoboards.forEach((board) => {
      const boardPins = this.wiringManager.getPinsForComponent(board.id);
      boardPins.forEach((boardPin) => {
        const boardPos = this.wiringManager.getPinPosition(boardPin);
        componentPins.forEach((compPin) => {
          const compPos = this.wiringManager.getPinPosition(compPin);
          const dx = boardPos.x - compPos.x;
          const dy = boardPos.y - compPos.y;
          const distSq = dx * dx + dy * dy;
          if (distSq <= maxDistanceSq && (!bestMatch || distSq < bestMatch.distSq)) {
            bestMatch = { dx, dy, distSq };
          }
        });
      });
    });

    if (!bestMatch) return;

    const currentLeft = parseFloat(component.container.style.left) || 0;
    const currentTop = parseFloat(component.container.style.top) || 0;
    component.container.style.left = `${currentLeft + bestMatch.dx}px`;
    component.container.style.top = `${currentTop + bestMatch.dy}px`;
    this.wiringManager.updateAllConnections();
  }

  getAttachedComponents(protoboardComponent) {
    const attached = [];
    const boardPins = this.wiringManager.getPinsForComponent(protoboardComponent.id);
    if (!boardPins.length) return attached;

    const threshold = 2; // px tolerance to consider a pin sitting on a hole
    this.components.forEach((component) => {
      if (component.id === protoboardComponent.id) return;
      const pins = this.wiringManager.getPinsForComponent(component.id);
      if (!pins.length) return;
      const overlaps = pins.some((pin) => {
        const pos = this.wiringManager.getPinPosition(pin);
        return boardPins.some((bp) => {
          const bpos = this.wiringManager.getPinPosition(bp);
          return Math.abs(pos.x - bpos.x) <= threshold && Math.abs(pos.y - bpos.y) <= threshold;
        });
      });
      if (overlaps) attached.push(component);
    });
    return attached;
  }

  nudgeAttachedComponents(attachedComponents, delta) {
    if (!delta || (!delta.dx && !delta.dy)) return;
    attachedComponents.forEach((component) => {
      const currentLeft = parseFloat(component.container.style.left) || 0;
      const currentTop = parseFloat(component.container.style.top) || 0;
      component.container.style.left = `${currentLeft + delta.dx}px`;
      component.container.style.top = `${currentTop + delta.dy}px`;
    });
  }

  attachComponentElementListeners(component) {
    const { element, type } = component;
    if (!element) return;

    switch (type) {
      case 'pushbutton': {
        const state = component.state ?? (component.state = {});
        const updateState = (pressed) => {
          state.pressed = pressed;
          window.dispatchEvent(
            new CustomEvent('simulator-pattern-interaction', {
              detail: { source: 'component-element' },
            }),
          );
        };
        element.addEventListener('button-press', () => updateState(true));
        element.addEventListener('button-release', () => updateState(false));
        element.addEventListener('input', () => updateState(Boolean(element.value ?? element.pressed)));
        state.pressed = Boolean(element.value ?? element.pressed);
        break;
      }
      case 'potentiometer': {
        const state = component.state ?? (component.state = {});
        const normalize = (value) => {
          const numeric = Number(value);
          if (!Number.isFinite(numeric)) return 50;
          return Math.max(0, Math.min(100, numeric));
        };

        const updateValue = (nextValue) => {
          const normalized = normalize(nextValue);
          if (state.value !== normalized) {
            state.value = normalized;
            window.dispatchEvent(
              new CustomEvent('simulator-pattern-interaction', {
                detail: { source: 'component-element' },
              }),
            );
            this.notifyInteraction();
          }
        };

        updateValue(element.value ?? 50);

        element.addEventListener('input', (event) => updateValue(event.target.value));
        element.addEventListener('change', (event) => updateValue(event.target.value));
        break;
      }
      case 'switch': {
        const state = component.state ?? (component.state = {});
        const readValue = () => {
          if (typeof element.value === 'number') {
            return Number(element.value) > 0;
          }
          if (typeof element.value === 'string') {
            const trimmed = element.value.trim().toLowerCase();
            return trimmed === '1' || trimmed === 'on' || trimmed === 'true';
          }
          const attr = element.getAttribute?.('value');
          if (attr !== null) {
            const trimmed = attr.trim().toLowerCase();
            return trimmed === '1' || trimmed === 'on' || trimmed === 'true';
          }
          return Boolean(element.hasAttribute?.('checked'));
        };

        const updateState = () => {
          const isOn = Boolean(readValue());
          if (state.on !== isOn) {
            state.on = isOn;
            window.dispatchEvent(
              new CustomEvent('simulator-pattern-interaction', {
                detail: { source: 'component-element' },
              }),
            );
            this.notifyInteraction();
          }
        };

        if (typeof component.props?.initialState !== 'undefined') {
          const initial = String(component.props.initialState).toLowerCase();
          const value = initial === 'on' ? 1 : 0;
          element.setAttribute?.('value', String(value));
          if (typeof element.value !== 'undefined') {
            element.value = value;
          }
        }

        updateState();
        element.addEventListener('input', updateState);
        element.addEventListener('change', updateState);
        break;
      }
      case 'photoresistor': {
        const state = component.state ?? (component.state = {});
        const sensor = element.querySelector?.('wokwi-photoresistor-sensor') ?? element;

        const applyLevel = (level, { silent = false } = {}) => {
          const numericLevel = Math.round(this.clampValue(level, 0, 100));
          const resistance = this.photoresistorLevelToResistance(numericLevel);
          const previousLevel = state.lightLevel;
          const previousResistance = state.resistance;
          state.lightLevel = numericLevel;
          state.resistance = resistance;
          component.props.resistance = String(resistance);
          component.props.ohms = String(resistance);
          const analogScale = Math.round((numericLevel / 100) * 4095);
          component.props.value = String(analogScale);
          if (sensor) {
            sensor.setAttribute('resistance', String(resistance));
            sensor.setAttribute('ohms', String(resistance));
            sensor.resistance = resistance;
            sensor.setAttribute('value', String(analogScale));
            if ('value' in sensor) {
              sensor.value = analogScale;
            }
          }
          if (element.__setBrightness) {
            element.__setBrightness(numericLevel, { silent: true });
          }
          if (!silent && (previousLevel !== numericLevel || previousResistance !== resistance)) {
            window.dispatchEvent(
              new CustomEvent('simulator-pattern-interaction', {
                detail: { source: 'component-element' },
              }),
            );
            this.notifyInteraction();
          }
          this.positionPhotoresistorControls(component);
          this.wiringManager.scheduleConnectionRefresh({
            immediate: true,
            minFrames: 4,
            durationMs: 160,
            maxDurationMs: 360,
          });
          window.setTimeout(() => this.wiringManager.updateAllConnections(), 200);
        };

        element.__onBrightnessChange = (level, options = {}) => {
          applyLevel(level, { silent: Boolean(options?.silent) });
        };

        const initialRaw =
          component.props?.resistance ??
          component.props?.value ??
          component.props?.ohms ??
          state.resistance ??
          '10k';
        const initialLevel = this.photoresistorResistanceToLevel(initialRaw);
        applyLevel(initialLevel, { silent: true });
        window.requestAnimationFrame(() => {
          this.positionPhotoresistorControls(component);
          this.wiringManager.scheduleConnectionRefresh({
            immediate: true,
            minFrames: 4,
            durationMs: 160,
            maxDurationMs: 360,
          });
          window.setTimeout(() => this.wiringManager.updateAllConnections(), 200);
        });
        break;
      }
      case 'ultrasonic-sensor': {
        this.positionUltrasonicControls(component);
        this.wiringManager.scheduleConnectionRefresh({
          immediate: true,
          minFrames: 4,
          durationMs: 160,
          maxDurationMs: 360,
        });
        window.setTimeout(() => this.wiringManager.updateAllConnections(), 200);
        break;
      }
      default:
        break;
    }
  }

  selectComponent(componentId) {
    if (this.selectedComponentId === componentId) return;
    this.clearComponentSelection();

    const component = this.getComponentById(componentId);
    if (!component) return;

    // Protoboard deve permanecer no fundo para facilitar encaixe de outros componentes
    if (component.type === 'protoboard-half') {
      component.container.style.zIndex = '0';
    }

    component.container.classList.add('component-selected');
    this.selectedComponentId = componentId;

    if (component.type !== 'ultrasonic-sensor') {
      this.renderPropertiesForComponent(component);
    } else {
      clearPropertiesPanel();
    }
    this.wiringManager.deselectWire();
    this.emitSelectionChange(component);
    if (component.type === 'photoresistor') {
      this.positionPhotoresistorControls(component);
      window.requestAnimationFrame(() => this.positionPhotoresistorControls(component));
    }
    if (component.type === 'ultrasonic-sensor') {
      this.positionUltrasonicControls(component);
      window.requestAnimationFrame(() => this.positionUltrasonicControls(component));
    }
    this.updatePhotoresistorControlsVisibility();
    this.updateUltrasonicControlsVisibility();
  }

  clearComponentSelection() {
    if (!this.selectedComponentId) return;
    const component = this.getComponentById(this.selectedComponentId);
    if (component) {
      component.container.classList.remove('component-selected');
    }
    this.selectedComponentId = null;
    clearPropertiesPanel();
    this.emitSelectionChange(null);
    this.updatePhotoresistorControlsVisibility();
    this.updateUltrasonicControlsVisibility();
  }

  deleteSelectedComponent() {
    if (!this.selectedComponentId) return false;
    this.removeComponent(this.selectedComponentId);
    return true;
  }

  removeComponent(componentId) {
    const index = this.components.findIndex((item) => item.id === componentId);
    if (index === -1) return;

    const [component] = this.components.splice(index, 1);
    this.wiringManager.removeConnectionsForComponent(componentId);
    this.wiringManager.removePinsForComponent(componentId);
    const controls = component.element?.__controls;
    if (controls?.parentElement) {
      controls.parentElement.removeChild(controls);
    }

    component.container.remove();
    if (this.selectedComponentId === componentId) {
      this.selectedComponentId = null;
      clearPropertiesPanel();
      this.emitSelectionChange(null);
    }

    this.notifyInteraction();
    this.updatePhotoresistorControlsVisibility();
    this.updateUltrasonicControlsVisibility();
  }

  clearWorkspace() {
    [...this.components].forEach((component) => this.removeComponent(component.id));
    this.wiringManager.clear();
    this.components = [];
    this.nextId = 1;
    clearPropertiesPanel();
    this.resetViewport();
  }

  serialize() {
    return {
      components: this.components.map((component) => ({
        id: component.id,
        type: component.type,
        x: parseFloat(component.container.style.left) || 0,
        y: parseFloat(component.container.style.top) || 0,
        zIndex: Number.parseInt(component.container.style.zIndex, 10) || 0,
        props: component.props,
        transform: {
          rotation: component.transform?.rotation ?? 0,
          flipped: Boolean(component.transform?.flipped),
        },
      })),
      wires: this.wiringManager.serialize(),
    };
  }

  async load(data) {
    this.clearWorkspace();
    if (!data || !Array.isArray(data.components)) return;

    const additionOrder = [...data.components];

    for (const componentData of additionOrder) {
      const definition = this.resolveComponentDefinition(componentData.type);
      if (!definition) continue;

      await this.addComponent(definition, componentData.x, componentData.y, {
        id: componentData.id,
        props: componentData.props,
        transform: componentData.transform,
        zIndex: componentData.zIndex,
      });

      const numericSuffix = Number(componentData.id?.split('-')[1]);
      if (!Number.isNaN(numericSuffix)) {
        this.nextId = Math.max(this.nextId, numericSuffix + 1);
      }
    }

    if (Array.isArray(data.wires)) {
      await this.wiringManager.deserialize(data.wires);
    }

    this.clearSelections();
    this.focusViewportOnContent();
  }

  updateComponentProps(componentId, newProps = {}) {
    const component = this.getComponentById(componentId);
    if (!component) return;

    component.props = { ...component.props, ...newProps };
    component.applyProps?.(component.props);
    const definition = this.resolveComponentDefinition(component.type);
    let needsIgnoreTransform = false;
    if (definition?.id === 'battery-aaa-pack') {
      const wrapper = component.visualWrapper ?? component.container;
      const computed = wrapper ? window.getComputedStyle(wrapper).transform : 'none';
      needsIgnoreTransform = computed && computed !== 'none';
    }
    this.wiringManager.updatePinPositionsForComponent?.(component.id, {
      ignoreTransform: needsIgnoreTransform,
    });
    this.syncComponentRuntimeState(component);

    if (definition?.getLabel) {
      component.label.textContent = definition.getLabel(component.props);
    }

    this.wiringManager.updateAllConnections();

    if (this.selectedComponentId === componentId) {
      this.renderPropertiesForComponent(component);
    }

    this.notifyInteraction();
  }

  getComponentById(componentId) {
    return this.components.find((component) => component.id === componentId) ?? null;
  }

  generateComponentId() {
    return `comp-${this.nextId++}`;
  }

  resolveComponentDefinition(componentType) {
    if (typeof componentType === 'string') {
      return availableComponents.find((item) => item.id === componentType) ?? null;
    }
    return componentType;
  }

  normaliseRotation(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    let normalised = numeric % 360;
    if (normalised < 0) {
      normalised += 360;
    }
    return normalised;
  }

  parseTimeToMilliseconds(value) {
    if (typeof value !== 'string') return 0;
    const trimmed = value.trim();
    if (!trimmed) return 0;
    const numeric = Number.parseFloat(trimmed);
    if (!Number.isFinite(numeric)) return 0;
    if (trimmed.toLowerCase().endsWith('ms')) {
      return numeric;
    }
    return numeric * 1000;
  }

  clampValue(value, min, max) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return min;
    if (numeric < min) return min;
    if (numeric > max) return max;
    return numeric;
  }

  parseResistanceInput(value) {
    if (value === null || typeof value === 'undefined') return NaN;
    if (typeof value === 'number') return value;
    const normalized = String(value).trim().toLowerCase();
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

    const multipliers = new Map([
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

    const multiplier = multipliers.get(cleanedUnit) ?? 1;
    return magnitude * multiplier;
  }

  photoresistorLevelToResistance(level) {
    const numeric = this.clampValue(level, 0, 100);
    const span = PHOTORESISTOR_MAX_OHMS - PHOTORESISTOR_MIN_OHMS;
    const ohms = PHOTORESISTOR_MAX_OHMS - (span * numeric) / 100;
    return Math.round(ohms);
  }

  photoresistorResistanceToLevel(value) {
    const ohms = this.parseResistanceInput(value);
    if (!Number.isFinite(ohms) || ohms <= 0) {
      return 50;
    }
    const clamped = this.clampValue(ohms, PHOTORESISTOR_MIN_OHMS, PHOTORESISTOR_MAX_OHMS);
    const span = PHOTORESISTOR_MAX_OHMS - PHOTORESISTOR_MIN_OHMS;
    if (span === 0) return 50;
    const ratio = (PHOTORESISTOR_MAX_OHMS - clamped) / span;
    return Math.round(ratio * 100);
  }

  positionPhotoresistorControls(component) {
    if (!component || component.type !== 'photoresistor') return;
    const controls = component.element?.__controls ?? component.element?.querySelector('.photoresistor-controls');
    const sensor = component.element?.__sensorElement ?? component.element?.querySelector('wokwi-photoresistor-sensor');
    if (!controls || !sensor) return;

    const workspaceRect = this.workspace.getBoundingClientRect();
    const sensorRect = sensor.getBoundingClientRect();
    const controlsRect = controls.getBoundingClientRect();

    const sensorCenterX = sensorRect.left + sensorRect.width / 2;
    const controlHeight = controlsRect.height || 28;
    const offsetY = controlHeight + 12;

    const overlayLeft = sensorCenterX - workspaceRect.left;
    const overlayTop = sensorRect.top - workspaceRect.top - offsetY;

    controls.style.setProperty('--overlay-left', `${overlayLeft}px`);
    controls.style.setProperty('--overlay-top', `${overlayTop}px`);
  }

  ensurePhotoresistorControls(component) {
    if (!component || component.type !== 'photoresistor') return;
    const controls = component.element?.__controls;
    if (!controls) return;
    if (!controls.__managedByCanvas) {
      controls.__managedByCanvas = true;
      controls.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
        this.selectComponent(component.id);
      });
    }
    if (controls.parentElement !== this.workspace) {
      if (controls.parentElement) {
        controls.parentElement.removeChild(controls);
      }
      this.workspace.appendChild(controls);
    }
    controls.dataset.componentId = component.id;
  }

  updatePhotoresistorControlsVisibility() {
    this.components.forEach((comp) => {
      if (comp.type !== 'photoresistor') return;
      const controls = comp.element?.__controls;
      if (!controls) return;
      this.ensurePhotoresistorControls(comp);
      if (comp.id === this.selectedComponentId) {
        controls.style.display = 'flex';
        this.positionPhotoresistorControls(comp);
        window.requestAnimationFrame(() => this.positionPhotoresistorControls(comp));
      } else {
        controls.style.display = 'none';
      }
    });
  }

  positionUltrasonicControls(component) {
    if (!component || component.type !== 'ultrasonic-sensor') return;
    const controls = component.element?.__controls;
    const sensor = component.element?.__sensorElement ?? component.element?.querySelector('wokwi-hc-sr04');
    if (!controls || !sensor) return;

    const workspaceRect = this.workspace.getBoundingClientRect();
    const sensorRect = sensor.getBoundingClientRect();
    const controlsRect = controls.getBoundingClientRect();

    const overlayLeft =
      sensorRect.left + sensorRect.width / 2 - controlsRect.width / 2 - workspaceRect.left;
    const overlayTop = sensorRect.top - workspaceRect.top - controlsRect.height - 10;

    controls.style.left = `${overlayLeft}px`;
    controls.style.top = `${overlayTop}px`;
  }

  ensureUltrasonicControls(component) {
    if (!component || component.type !== 'ultrasonic-sensor') return;
    const controls = component.element?.__controls;
    if (!controls) return;
    if (!controls.__managedByCanvas) {
      controls.__managedByCanvas = true;
      controls.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
        this.selectComponent(component.id);
      });
    }
    if (!controls.parentElement) {
      this.workspace.appendChild(controls);
    }
    controls.dataset.componentId = component.id;
  }

  updateUltrasonicControlsVisibility() {
    this.components.forEach((comp) => {
      if (comp.type !== 'ultrasonic-sensor') return;
      const controls = comp.element?.__controls;
      if (!controls) return;
      this.ensureUltrasonicControls(comp);
      if (comp.id === this.selectedComponentId) {
        controls.style.display = 'flex';
        this.positionUltrasonicControls(comp);
        window.requestAnimationFrame(() => this.positionUltrasonicControls(comp));
      } else {
        controls.style.display = 'none';
      }
    });
  }

  getTransitionDurationMs(element, targetProperty = 'all') {
    if (!element || typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') {
      return 0;
    }

    const computed = window.getComputedStyle(element);
    if (!computed) return 0;

    const properties = (computed.transitionProperty || '')
      .split(',')
      .map((prop) => prop.trim())
      .filter(Boolean);
    if (!properties.length) return 0;

    const durations = (computed.transitionDuration || '')
      .split(',')
      .map((value) => this.parseTimeToMilliseconds(value));
    const delays = (computed.transitionDelay || '')
      .split(',')
      .map((value) => this.parseTimeToMilliseconds(value));

    const targets = Array.isArray(targetProperty)
      ? targetProperty.filter(Boolean)
      : [targetProperty].filter(Boolean);

    let maxDuration = 0;

    properties.forEach((property, index) => {
      if (property === 'none') {
        return;
      }

      const duration = durations[index] ?? durations[durations.length - 1] ?? 0;
      const delay = delays[index] ?? delays[delays.length - 1] ?? 0;
      const appliesToProperty =
        property === 'all' ||
        targets.length === 0 ||
        targets.includes(property);

      if (appliesToProperty) {
        maxDuration = Math.max(maxDuration, duration + delay);
      }
    });

    return maxDuration;
  }

  applyComponentTransform(component, options = {}) {
    if (!component) return;
    if (!component.transform) {
      component.transform = { rotation: 0, flipped: false };
    }
    const disableTransition = Boolean(options?.disableTransition);
    const rotation = this.normaliseRotation(component.transform?.rotation ?? 0);
    const flipped = Boolean(component.transform?.flipped);
    const target = component.visualWrapper ?? component.container;
    if (!target) return;

    let previousTransition = null;
    if (disableTransition) {
      previousTransition = target.style.transition ?? '';
      target.style.transition = 'none';
    }

    const transforms = [];
    if (rotation !== 0) {
      transforms.push(`rotate(${rotation}deg)`);
    }
    if (flipped) {
      transforms.push('scaleX(-1)');
    }

    target.style.transformOrigin = 'center';
    target.style.transform = transforms.length ? transforms.join(' ') : 'none';
    target.style.setProperty('--component-rotation', `${rotation}deg`);
    target.style.setProperty('--component-flip-compensation', flipped ? '-1' : '1');

    if (disableTransition) {
      // Force layout update to finalize transform before restoring transitions
      void target.offsetWidth;
      if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(() => {
          target.style.transition = previousTransition ?? '';
        });
      } else {
        target.style.transition = previousTransition ?? '';
      }
    }

    this.wiringManager.resetAnchorsForComponent(component.id);
    const transitionDuration = disableTransition
      ? 0
      : this.getTransitionDurationMs(target, 'transform');
    this.wiringManager.scheduleConnectionRefresh({
      immediate: true,
      minFrames: 4,
      durationMs: transitionDuration + 80,
      maxDurationMs: transitionDuration + 240,
    });

    this.positionPhotoresistorControls(component);
    window.requestAnimationFrame(() => this.positionPhotoresistorControls(component));
    this.positionUltrasonicControls(component);
    window.requestAnimationFrame(() => this.positionUltrasonicControls(component));
  }

  getComponentVisualWrapper(componentId) {
    const component = this.getComponentById(componentId);
    return component?.visualWrapper ?? null;
  }

  getSelectedComponent() {
    if (!this.selectedComponentId) return null;
    return this.getComponentById(this.selectedComponentId);
  }

  syncComponentRuntimeState(component) {
    if (!component) return;
    const state = component.state ?? (component.state = {});
    switch (component.type) {
      case 'switch': {
        const isOn = String(component.props?.initialState ?? 'off').toLowerCase() === 'on';
        state.on = isOn;
        if (component.element) {
          const value = isOn ? 1 : 0;
          component.element.setAttribute?.('value', String(value));
          if (typeof component.element.value !== 'undefined') {
            component.element.value = value;
          }
        }
        break;
      }
      case 'ir-receiver': {
        state.state = String(component.props?.state ?? state.state ?? 'low').toLowerCase();
        if (component.element) {
          component.element.setAttribute?.('state', state.state);
          if (typeof component.element.state !== 'undefined') {
            component.element.state = state.state;
          }
        }
        {
          const isActive = state.state === 'high';
          component.container.classList.toggle('ir-receiver-active', isActive);
          component.visualWrapper?.classList.toggle('ir-receiver-active', isActive);
          if (component.container?.dataset) {
            component.container.dataset.irState = state.state;
          }
        }
        break;
      }
      case 'photoresistor': {
        const raw =
          component.props?.resistance ??
          component.props?.value ??
          component.props?.ohms ??
          state.resistance;
        const level = this.photoresistorResistanceToLevel(raw);
        const resistance = this.photoresistorLevelToResistance(level);
        state.lightLevel = level;
        state.resistance = resistance;
        if (component.element?.__setBrightness) {
          component.element.__setBrightness(level, { silent: true });
        }
        const sensor = component.element?.querySelector?.('wokwi-photoresistor-sensor');
        if (sensor) {
          sensor.setAttribute('resistance', String(resistance));
        }
        break;
      }
      case 'dht-sensor': {
        const elementState = component.element?.__state ?? {};
        const temp =
          Number(component.props?.temperature ?? elementState.temperature ?? state.temperature);
        const humid =
          Number(component.props?.humidity ?? elementState.humidity ?? state.humidity);
        if (Number.isFinite(temp)) state.temperature = temp;
        if (Number.isFinite(humid)) state.humidity = humid;
        break;
      }
      default:
        break;
    }
  }

  canRotateComponent(component) {
    return Boolean(component);
  }

  canFlipComponent(component) {
    if (!component) return false;
    return FLIPPABLE_COMPONENT_TYPES.has(component.type);
  }

  emitSelectionChange(component) {
    if (component && !component.transform) {
      component.transform = { rotation: 0, flipped: false };
    }
    const detail = component
      ? {
          componentId: component.id,
          componentType: component.type,
          canRotate: this.canRotateComponent(component),
          canFlip: this.canFlipComponent(component),
          transform: {
            rotation: component.transform?.rotation ?? 0,
            flipped: Boolean(component.transform?.flipped),
          },
        }
      : {
          componentId: null,
          componentType: null,
          canRotate: false,
          canFlip: false,
          transform: { rotation: 0, flipped: false },
        };

    window.dispatchEvent(
      new CustomEvent('simulator-selection-change', {
        detail,
      }),
    );
  }

  rotateSelectedComponent(step = 90) {
    const component = this.getSelectedComponent();
    if (!component || !this.canRotateComponent(component)) return;
    if (this.isInteractionLocked?.()) return;
    const nextRotation = this.normaliseRotation((component.transform?.rotation ?? 0) + step);
    component.transform = {
      rotation: nextRotation,
      flipped: Boolean(component.transform?.flipped),
    };
    this.applyComponentTransform(component);
    this.notifyInteraction();
    this.emitSelectionChange(component);
  }

  flipSelectedComponent() {
    const component = this.getSelectedComponent();
    if (!component || !this.canFlipComponent(component)) return;
    if (this.isInteractionLocked?.()) return;
    const nextFlipped = !Boolean(component.transform?.flipped);
    component.transform = {
      rotation: this.normaliseRotation(component.transform?.rotation ?? 0),
      flipped: nextFlipped,
    };
    this.applyComponentTransform(component);
    this.notifyInteraction();
    this.emitSelectionChange(component);
  }

  notifyInteraction() {
    this.onInteraction?.();
  }

  renderPropertiesForComponent(component) {
    const definition = this.resolveComponentDefinition(component.type);
    if (!definition) return;

    const rect = component.container.getBoundingClientRect();

    const fields = [];

    const controlledProps = new Set(
      (definition.propertyControls ?? [])
        .map((control) => control?.control?.propKey)
        .filter(Boolean),
    );

    const getConnectedRainModuleMode = () => {
      if (component.type !== 'rain-sensor') return null;
      const connections = this.wiringManager?.connections ?? [];
      for (const connection of connections) {
        const pin1 = connection?.pin1;
        const pin2 = connection?.pin2;
        const pin1ComponentId = pin1?.dataset?.componentId;
        const pin2ComponentId = pin2?.dataset?.componentId;
        if (pin1ComponentId === component.id && pin2ComponentId) {
          const other = this.getComponentById(pin2ComponentId);
          if (other?.type === 'rain-module') {
            return other.props?.outputMode ?? 'analog';
          }
        }
        if (pin2ComponentId === component.id && pin1ComponentId) {
          const other = this.getComponentById(pin1ComponentId);
          if (other?.type === 'rain-module') {
            return other.props?.outputMode ?? 'analog';
          }
        }
      }
      return null;
    };

    const isControlVisible = (controlConfig) => {
      const rule = controlConfig?.visibleWhen;
      if (!rule) return true;
      if (rule.connectedRainModuleMode) {
        const mode = getConnectedRainModuleMode() ?? 'analog';
        return mode === rule.connectedRainModuleMode;
      }
      const propValue = rule.prop ? component.props?.[rule.prop] : undefined;
      if (Object.prototype.hasOwnProperty.call(rule, 'equals')) {
        return propValue === rule.equals;
      }
      if (Object.prototype.hasOwnProperty.call(rule, 'notEquals')) {
        return propValue !== rule.notEquals;
      }
      return true;
    };

    (definition.propertyControls ?? []).forEach((controlConfig) => {
      if (!isControlVisible(controlConfig)) return;
      const propKey = controlConfig?.control?.propKey;
      const rawValue =
        (propKey && component.props[propKey]) ??
        controlConfig?.control?.options?.[0]?.value ??
        '';

      const shouldDispatchInteraction = Boolean(controlConfig?.control?.dispatchInteractionEvent);
      const interactionDetail =
        controlConfig?.control?.interactionEventDetail ?? { source: 'component-property' };

      fields.push({
        label: controlConfig.label,
        value: controlConfig.formatValue
          ? controlConfig.formatValue(rawValue)
          : String(rawValue),
        control: {
          type: controlConfig.control?.type,
          options: controlConfig.control?.options,
          value: rawValue,
          onChange: (value) => {
            if (shouldDispatchInteraction) {
              window.dispatchEvent(
                new CustomEvent('simulator-pattern-interaction', {
                  detail: interactionDetail,
                }),
              );
            }
            if (propKey) {
              this.updateComponentProps(component.id, { [propKey]: value });
            }
          },
        },
      });
    });

    if (component.type === 'led') {
      const colorInfo = getLedColorInfo(component.props.color);
      if (colorInfo?.forwardVoltage) {
        fields.push({ label: 'Tensão direta típica', value: colorInfo.forwardVoltage });
      }
      if (colorInfo?.maxCurrent) {
        fields.push({ label: 'Corrente máxima recomendada', value: colorInfo.maxCurrent });
      }
    }

    const anchor = {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    };

    const panelTitle =
      component.label?.textContent?.trim() ||
      definition.name ||
      component.name ||
      'Componente selecionado';

    if (component.type === 'photoresistor' && fields.length === 0) {
      clearPropertiesPanel();
      return;
    }

    updatePropertiesPanel({
      title: panelTitle,
      fields,
      anchor,
    });
  }
}
