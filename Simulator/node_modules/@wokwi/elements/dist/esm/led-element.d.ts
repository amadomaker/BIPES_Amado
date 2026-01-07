import { LitElement } from 'lit';
import { ElementPin } from './pin';
export declare class LEDElement extends LitElement {
    value: boolean;
    brightness: number;
    color: string;
    lightColor: string | null;
    label: string;
    flip: boolean;
    get pinInfo(): ElementPin[];
    static get styles(): import("lit").CSSResult;
    update(changedProperties: Map<string, unknown>): void;
    renderSVG(): import("lit-html").TemplateResult<1>;
    render(): import("lit-html").TemplateResult<1>;
}
