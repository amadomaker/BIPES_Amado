import { LitElement } from 'lit';
import { ElementPin } from './pin';
export declare class PushbuttonElement extends LitElement {
    color: string;
    pressed: boolean;
    label: string;
    xray: boolean;
    private static pushbuttonCounter;
    private uniqueId;
    private sticky;
    readonly pinInfo: ElementPin[];
    constructor();
    static get styles(): import("lit").CSSResult;
    renderSVG(): import("lit-html").TemplateResult<1>;
    render(): import("lit-html").TemplateResult<1>;
    private down;
    private up;
    private leave;
}
