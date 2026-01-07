import { LitElement } from 'lit';
import { ElementPin } from '.';
type HandShape = 'arrow' | 'plain' | 'ornate';
type HandDesc = {
    xOff: number;
    yOff: number;
    path: string;
};
export declare class BiaxialStepperElement extends LitElement {
    outerHandLength: number;
    outerHandAngle: number;
    outerHandColor: string;
    outerHandShape: HandShape;
    innerHandLength: number;
    innerHandAngle: number;
    innerHandColor: string;
    innerHandShape: HandShape;
    get pinInfo(): ElementPin[];
    readonly handMap: {
        [key: string]: (len: number) => HandDesc;
    };
    private cap;
    private constrain;
    private handPath;
    render(): import("lit-html").TemplateResult<1>;
}
export {};
