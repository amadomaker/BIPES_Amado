import { LitElement } from 'lit';
import { ElementPin } from '.';
export declare class GasSensorElement extends LitElement {
    ledPower: boolean;
    ledD0: boolean;
    readonly pinInfo: ElementPin[];
    render(): import("lit-html").TemplateResult<1>;
}
