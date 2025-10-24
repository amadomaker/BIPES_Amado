"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShowPinsElement = void 0;
const lit_1 = require("lit");
const decorators_js_1 = require("lit/decorators.js");
/**
 * Utility element to debug the pinInfo property. Pin locations are displayed using red dots.
 * Moving your mouse over one of the red dots shows a tooltip with the pin's name.
 *
 *
 * Usage:
 * 1. Import this file in your element's story file, e.g.
 *    ```
 *    import './utils/show-pins-element';
 *    ```
 * 2. Wrap your element with the <wokwi-show-pins> element, e.g.
 *    ```
 *    export const HCSR04 = () => html`
 *      <wokwi-show-pins>
 *        <wokwi-hc-sr04></wokwi-hc-sr04>
 *      </wokwi-show-pins>
 *    `;
 *    ```
 */
let ShowPinsElement = class ShowPinsElement extends lit_1.LitElement {
    constructor() {
        super(...arguments);
        this.pinColor = 'red';
        this.pinInfoChangeCallback = () => {
            this.requestUpdate();
        };
    }
    get slotChild() {
        return this.elementSlot?.assignedElements()[0];
    }
    handleSlotChange() {
        const slotChild = this.slotChild;
        if (slotChild !== this.previousSlotChild) {
            this.previousSlotChild?.removeEventListener('pininfo-change', this.pinInfoChangeCallback);
            slotChild?.addEventListener('pininfo-change', this.pinInfoChangeCallback);
            this.previousSlotChild = slotChild;
        }
        this.requestUpdate();
    }
    render() {
        const pinInfo = this.slotChild?.pinInfo ?? [];
        const { pinColor } = this;
        return (0, lit_1.html) `<div style="position: relative">
      <slot id="content" @slotchange=${() => this.handleSlotChange()}></slot>

      <svg style="position: absolute; top: 0; left: 0" width="100%" height="100%" fill=${pinColor}>
        ${pinInfo.map((pin) => (0, lit_1.svg) `<circle cx=${pin.x} cy=${pin.y} r=2><title>${pin.name}</title></circle>`)}
      </svg>
    </div>`;
    }
};
exports.ShowPinsElement = ShowPinsElement;
__decorate([
    (0, decorators_js_1.property)()
], ShowPinsElement.prototype, "pinColor", void 0);
__decorate([
    (0, decorators_js_1.query)('#content')
], ShowPinsElement.prototype, "elementSlot", void 0);
exports.ShowPinsElement = ShowPinsElement = __decorate([
    (0, decorators_js_1.customElement)('wokwi-show-pins')
], ShowPinsElement);
