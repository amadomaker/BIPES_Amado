import { LitElement } from 'lit';
import { ElementPin } from '.';
/**
 * NemaSpec describes a NEMA Stepper specification (for the purpose of visualisation)
 *
 */
export interface NEMASpec {
    id: number;
    frameSize: number;
    holeRadius: number;
    shaftRadius: number;
    cornerRadius: number;
    cornerOffset: number;
    bodyRadius: number;
    textSize: number;
    /**  Y position of value text */
    valueYPosition: number;
    /**  Y position of units text */
    unitsYPosition: number;
}
export declare class StepperMotorElement extends LitElement {
    angle: number;
    arrow: string;
    value: string;
    units: string;
    size: 8 | 11 | 14 | 17 | 23 | 34;
    get pinInfo(): ElementPin[];
    readonly nemaSpecMap: {
        [key: string]: NEMASpec;
    };
    update(changedProperties: Map<string, unknown>): void;
    render(): import("lit-html").TemplateResult<1>;
}
