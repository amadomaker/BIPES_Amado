import { WiringManager } from './wiring.js';
import {
  updatePropertiesPanel,
  clearPropertiesPanel,
  showComponentContextMenu,
  hideContextMenu,
} from './ui.js';
import { availableComponents } from './components.js';

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

    container.appendChild(element);
    container.appendChild(label);
    this.workspace.appendChild(container);

    const componentData = {
      id: componentId,
      type: definition.id,
      name: definition.name,
      element,
      container,
      label,
      props: appliedProps,
      applyProps,
      state: {},
    };

    this.components.push(componentData);
    this.attachComponentInteractions(componentData);
    this.attachComponentElementListeners(componentData);
    await this.wiringManager.addPinsToComponent(container, definition, componentId);
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
  }

  clearComponentSelection() {
    if (!this.selectedComponentId) return;
    const component = this.getComponentById(this.selectedComponentId);
    if (component) {
      component.container.classList.remove('component-selected');
    }
    this.selectedComponentId = null;
    clearPropertiesPanel();
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

  notifyInteraction() {
    this.onInteraction?.();
  }

  renderPropertiesForComponent(component) {
    const definition = this.resolveComponentDefinition(component.type);
    if (!definition) return;

    const rect = component.container.getBoundingClientRect();
    const workspaceRect = this.workspace.getBoundingClientRect();

    const x = Math.round(rect.left - workspaceRect.left);
    const y = Math.round(rect.top - workspaceRect.top);

    const fields = [
      { label: 'ID', value: component.id },
      { label: 'Tipo', value: component.name },
      { label: 'Posição', value: `${x}px, ${y}px` },
    ];

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

    Object.entries(component.props).forEach(([key, value]) => {
      if (controlledProps.has(key)) return;
      fields.push({ label: key, value: String(value) });
    });

    const pins = this.wiringManager.getPinsForComponent(component.id);
    if (pins.length) {
      fields.push({ label: 'Pinos', value: pins.map((pin) => pin.dataset.pinName).join(', ') });
    }

    updatePropertiesPanel({
      title: 'Componente selecionado',
      fields,
    });
  }
}
