var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { analog } from './pin';
import { clamp } from './utils/clamp';
import { getScreenCTM } from './utils/ctm-workaround';
const knobCenter = {
    x: 9.91,
    y: 8.18,
};
/** The potentiometer SVG is taken from https://freesvg.org/potentiometer and some of the
    functions are taken from https://github.com/vitaliy-bobrov/js-rocks knob component */
let PotentiometerElement = class PotentiometerElement extends LitElement {
    constructor() {
        super(...arguments);
        this.min = 0;
        this.max = 1023;
        this.value = 0;
        this.step = 1;
        this.startDegree = -135;
        this.endDegree = 135;
        this.pressed = false;
        this.pageToKnobMatrix = null;
        this.pinInfo = [
            { name: 'GND', x: 29, y: 68.5, number: 1, signals: [{ type: 'power', signal: 'GND' }] },
            { name: 'SIG', x: 39, y: 68.5, number: 2, signals: [analog(0)] },
            { name: 'VCC', x: 49, y: 68.5, number: 3, signals: [{ type: 'power', signal: 'VCC' }] },
        ];
    }
    static get styles() {
        return css `
      #rotating {
        transform-origin: 10px 8px;
        transform: rotate(var(--knob-angle, 0deg));
      }

      svg text {
        font-size: 1px;
        line-height: 1.25;
        letter-spacing: 0px;
        word-spacing: 0px;
        fill: #ffffff;
      }
      .hide-input {
        position: absolute;
        clip: rect(0 0 0 0);
        width: 1px;
        height: 1px;
        margin: -1px;
      }
      input:focus + svg #knob {
        stroke: #ccdae3;
        filter: url(#outline);
      }
    `;
    }
    mapToMinMax(value, min, max) {
        return value * (max - min) + min;
    }
    percentFromMinMax(value, min, max) {
        return (value - min) / (max - min);
    }
    renderSVG() {
        const percent = clamp(0, 1, this.percentFromMinMax(this.value, this.min, this.max));
        const knobDeg = (this.endDegree - this.startDegree) * percent + this.startDegree;
        return html `<svg
      role="slider"
      width="20mm"
      height="20mm"
      version="1.1"
      viewBox="0 0 20 20"
      xmlns="http://www.w3.org/2000/svg"
      @click="${this.focusInput}"
      @mousedown=${this.down}
      @mousemove=${this.move}
      @mouseup=${this.up}
      @touchstart=${this.down}
      @touchmove=${this.move}
      @touchend=${this.up}
      style=${styleMap({
            '--knob-angle': knobDeg + 'deg',
        })}
    >
      <defs>
        <filter id="outline">
          <feDropShadow id="glow" dx="0" dy="0" stdDeviation="0.5" flood-color="cyan" />
        </filter>
      </defs>
      <rect
        x=".15"
        y=".15"
        width="19.5"
        height="19.5"
        ry="1.23"
        fill="#045881"
        stroke="#045881"
        stroke-width=".30"
      />
      <rect x="5.4" y=".70" width="9.1" height="1.9" fill="#ccdae3" stroke-width=".15" />
      <ellipse
        id="knob"
        cx=${knobCenter.x}
        cy=${knobCenter.y}
        rx="7.27"
        ry="7.43"
        fill="#e4e8eb"
        stroke-width=".15"
      />
      <rect x="6" y="17" width="8" height="2" fill-opacity="0" stroke="#fff" stroke-width=".30" />
      <g stroke-width=".15">
        <text x="6.21" y="16.6">GND</text>
        <text x="9.2" y="16.63">SIG</text>
        <text x="11.5" y="16.59">VCC</text>
      </g>
      <g fill="#fff" stroke-width=".15">
        <ellipse cx="1.68" cy="1.81" rx=".99" ry=".96" />
        <ellipse cx="1.48" cy="18.37" rx=".99" ry=".96" />
        <ellipse cx="17.97" cy="18.47" rx=".99" ry=".96" />
        <ellipse cx="18.07" cy="1.91" rx=".99" ry=".96" />
      </g>
      <g fill="#b3b1b0" stroke-width=".15">
        <ellipse cx="7.68" cy="18" rx=".61" ry=".63" />
        <ellipse cx="10.22" cy="18" rx=".61" ry=".63" />
        <ellipse cx="12.76" cy="18" rx=".61" ry=".63" />
      </g>
      <ellipse cx="9.95" cy="8.06" rx="6.60" ry="6.58" fill="#c3c2c3" stroke-width=".15" />
      <rect id="rotating" x="10" y="2" width=".42" height="3.1" stroke-width=".15" />
      <rect x="0" y="9.5" width="1" height="1" fill="none" id="firefox-workaround" />
    </svg>`;
    }
    render() {
        return html `
      <input
        tabindex="0"
        type="range"
        class="hide-input"
        max="${this.max}"
        min="${this.min}"
        value="${this.value}"
        step="${this.step}"
        aria-valuemin="${this.min}"
        aria-valuenow="${this.value}"
        @input="${this.onValueChange}"
      />
      ${this.renderSVG()}
    `;
    }
    focusInput() {
        const inputEl = this.shadowRoot?.querySelector('.hide-input');
        inputEl?.focus();
    }
    onValueChange(event) {
        const target = event.target;
        this.updateValue(parseFloat(target.value));
    }
    down(event) {
        if (event.button === 0 || window.navigator.maxTouchPoints) {
            this.pressed = true;
            event.stopPropagation();
            event.preventDefault();
            this.updateKnobMatrix();
        }
    }
    move(event) {
        const { pressed } = this;
        if (pressed) {
            this.rotateHandler(event);
        }
    }
    up() {
        this.pressed = false;
    }
    updateKnobMatrix() {
        const knob = this.shadowRoot?.querySelector('#knob');
        const workaroundElement = this.shadowRoot?.querySelector('#firefox-workaround');
        this.pageToKnobMatrix =
            knob && workaroundElement
                ? getScreenCTM(knob, workaroundElement, new DOMRect(0, 9.5, 1, 1))
                : null;
    }
    rotateHandler(event) {
        event.stopPropagation();
        event.preventDefault();
        if (!this.pageToKnobMatrix) {
            return;
        }
        const isTouch = event.type === 'touchmove';
        const pageX = isTouch ? event.touches[0].pageX : event.pageX;
        const pageY = isTouch ? event.touches[0].pageY : event.pageY;
        const localPosition = new DOMPointReadOnly(pageX, pageY).matrixTransform(this.pageToKnobMatrix);
        const x = knobCenter.x - localPosition.x;
        const y = knobCenter.y - localPosition.y;
        let deg = Math.round((Math.atan2(y, x) * 180) / Math.PI);
        if (deg < 0) {
            deg += 360;
        }
        deg -= 90;
        if (x > 0 && y <= 0 && deg > 0) {
            deg -= 360;
        }
        deg = clamp(this.startDegree, this.endDegree, deg);
        const percent = this.percentFromMinMax(deg, this.startDegree, this.endDegree);
        const value = this.mapToMinMax(percent, this.min, this.max);
        this.updateValue(value);
    }
    updateValue(value) {
        const clamped = clamp(this.min, this.max, value);
        const updated = Math.round(clamped / this.step) * this.step;
        this.value = Math.round(updated * 100) / 100;
        this.dispatchEvent(new InputEvent('input', { detail: this.value }));
    }
};
__decorate([
    property({ type: Number })
], PotentiometerElement.prototype, "min", void 0);
__decorate([
    property({ type: Number })
], PotentiometerElement.prototype, "max", void 0);
__decorate([
    property()
], PotentiometerElement.prototype, "value", void 0);
__decorate([
    property()
], PotentiometerElement.prototype, "step", void 0);
__decorate([
    property()
], PotentiometerElement.prototype, "startDegree", void 0);
__decorate([
    property()
], PotentiometerElement.prototype, "endDegree", void 0);
PotentiometerElement = __decorate([
    customElement('wokwi-potentiometer')
], PotentiometerElement);
export { PotentiometerElement };
