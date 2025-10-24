import { LitElement } from 'lit';
import { ElementPin } from './pin';
export declare class SlideSwitchElement extends LitElement {
    value: number;
    readonly pinInfo: ElementPin[];
    static get styles(): import("lit").CSSResult;
    private onClick;
    private onValueChange;
    renderSVG(): import("lit-html").TemplateResult<1>;
    render(): import("lit-html").TemplateResult<1>;
}
