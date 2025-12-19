import { CSSResult, TemplateResult } from 'lit';
export interface IRenderable {
    render(): TemplateResult;
    renderSVG?(): TemplateResult;
}
export declare function removeLitComments(svg: string): string;
export declare function renderToPng(element: IRenderable, styles?: CSSResult): Promise<Buffer<ArrayBufferLike>>;
export declare function savePng(name: string, pngData: Buffer): Promise<void>;
