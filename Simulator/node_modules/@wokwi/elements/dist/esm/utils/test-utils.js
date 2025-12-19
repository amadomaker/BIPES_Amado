import { render } from '@lit-labs/ssr';
import { collectResult } from '@lit-labs/ssr/lib/render-result';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import sharp from 'sharp';
export function removeLitComments(svg) {
    return svg.replace(/<!--\/?lit-part-->/g, '');
}
async function getSavePath() {
    const path = process.env.SAVE_PNG_PATH;
    if (!path) {
        return;
    }
    mkdir(path, { recursive: true });
    return path;
}
export async function renderToPng(element, styles) {
    const rendered = element.renderSVG ? element.renderSVG() : element.render();
    const svgData = await collectResult(render(rendered));
    const svgStyles = styles ? removeLitComments(await collectResult(render(styles))) : undefined;
    return await sharp(Buffer.from(svgData), {
        svg: { stylesheet: svgStyles },
    })
        .png()
        .toBuffer();
}
export async function savePng(name, pngData) {
    const path = await getSavePath();
    if (!path) {
        return;
    }
    await writeFile(join(path, `${name}.png`), pngData);
}
