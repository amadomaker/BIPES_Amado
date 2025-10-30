import { WiringManager } from './wiring.js';
import {
  updatePropertiesPanel,
  clearPropertiesPanel,
  showComponentContextMenu,
  hideContextMenu,
} from './ui.js';
import { availableComponents, getLedColorInfo } from './components.js';

const FLIPPABLE_COMPONENT_TYPES = new Set(['led']);

export class CanvasManager {
  constructor(options = {}) {
    this.workspace = document.getElementById('workspace');
    this.components = [];
    this.selectedComponentId = null;
    this.nextId = 1;
    this.onInteraction = options.onInteraction ?? (() => {});
    this.isInteractionLocked = options.isInteractionLocked ?? (() => false);

    this.wiringManager = new WiringManager(this);
    this.setupWorkspaceListeners();
  }

  setupWorkspaceListeners() {
    this.workspace.addEventListener('click', (event) => {
      if (this.wiringManager?.isWiring()) {
        return;
      }

      if (this.wiringManager?.isEditingConnection()) {
        this.clearSelections();
        return;
      }

      if (event.target === this.workspace || event.target === this.wiringManager.svgLayer) {
        this.clearSelections();
      }
    });
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
    container.style.left = `${x}px`;
    container.style.top = `${y}px`;
    container.style.cursor = 'move';

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
    this.workspace.appendChild(container);

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
    this.applyComponentTransform(componentData);
    this.wiringManager.updateAllConnections();
    this.selectComponent(componentId);
    this.notifyInteraction();

    return componentId;
  }

  attachComponentInteractions(component) {
    const { container, id } = component;

    container.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      if (event.target.closest('.pin')) return;
      if (this.isInteractionLocked?.()) {
        return;
      }

      container.setPointerCapture(event.pointerId);
      const initialX = event.clientX - container.offsetLeft;
      const initialY = event.clientY - container.offsetTop;
      let moved = false;

      const handlePointerMove = (moveEvent) => {
        if (moveEvent.pointerId !== event.pointerId) return;
        moved = true;

        const newX = moveEvent.clientX - initialX;
        const newY = moveEvent.clientY - initialY;

        container.style.left = `${newX}px`;
        container.style.top = `${newY}px`;
        this.wiringManager.updateAllConnections();
      };

      const handlePointerUp = (upEvent) => {
        if (upEvent.pointerId !== event.pointerId) return;

        container.releasePointerCapture(event.pointerId);
        container.removeEventListener('pointermove', handlePointerMove);
        container.removeEventListener('pointerup', handlePointerUp);
        container.removeEventListener('pointercancel', handlePointerUp);

        if (moved) {
          this.notifyInteraction();
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
      if (this.isInteractionLocked?.()) {
        return;
      }
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
        onDelete: () => this.removeComponent(id),
      });
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
      default:
        break;
    }
  }

  selectComponent(componentId) {
    if (this.selectedComponentId === componentId) return;
    this.clearComponentSelection();

    const component = this.getComponentById(componentId);
    if (!component) return;

    component.container.classList.add('component-selected');
    this.selectedComponentId = componentId;

    this.renderPropertiesForComponent(component);
    this.wiringManager.deselectWire();
    this.emitSelectionChange(component);
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

    component.container.remove();
    if (this.selectedComponentId === componentId) {
      this.selectedComponentId = null;
      clearPropertiesPanel();
      this.emitSelectionChange(null);
    }

    this.notifyInteraction();
  }

  clearWorkspace() {
    [...this.components].forEach((component) => this.removeComponent(component.id));
    this.wiringManager.clear();
    this.components = [];
    this.nextId = 1;
    clearPropertiesPanel();
  }

  serialize() {
    return {
      components: this.components.map((component) => ({
        id: component.id,
        type: component.type,
        x: parseFloat(component.container.style.left) || 0,
        y: parseFloat(component.container.style.top) || 0,
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
  }

  updateComponentProps(componentId, newProps = {}) {
    const component = this.getComponentById(componentId);
    if (!component) return;

    component.props = { ...component.props, ...newProps };
    component.applyProps?.(component.props);
    this.syncComponentRuntimeState(component);

    const definition = this.resolveComponentDefinition(component.type);
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

  applyComponentTransform(component) {
    if (!component) return;
    if (!component.transform) {
      component.transform = { rotation: 0, flipped: false };
    }
    const rotation = this.normaliseRotation(component.transform?.rotation ?? 0);
    const flipped = Boolean(component.transform?.flipped);
    const target = component.visualWrapper ?? component.container;
    if (!target) return;

    const transforms = [];
    if (rotation !== 0) {
      transforms.push(`rotate(${rotation}deg)`);
    }
    if (flipped) {
      transforms.push('scaleX(-1)');
    }

    target.style.transformOrigin = 'center';
    target.style.transform = transforms.length ? transforms.join(' ') : 'none';

    this.wiringManager.resetAnchorsForComponent(component.id);
    const transitionDuration = this.getTransitionDurationMs(target, 'transform');
    this.wiringManager.scheduleConnectionRefresh({
      immediate: true,
      minFrames: 4,
      durationMs: transitionDuration + 80,
      maxDurationMs: transitionDuration + 240,
    });
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
        break;
      }
      case 'photoresistor': {
        const raw =
          component.props?.resistance ??
          component.props?.value ??
          component.props?.ohms ??
          state.resistance;
        state.resistance = raw;
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

    (definition.propertyControls ?? []).forEach((controlConfig) => {
      const propKey = controlConfig?.control?.propKey;
      const rawValue =
        (propKey && component.props[propKey]) ??
        controlConfig?.control?.options?.[0]?.value ??
        '';

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

    updatePropertiesPanel({
      title: panelTitle,
      fields,
      anchor,
    });
  }
}
