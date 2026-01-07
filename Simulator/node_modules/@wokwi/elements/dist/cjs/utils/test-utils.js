"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeLitComments = removeLitComments;
exports.renderToPng = renderToPng;
exports.savePng = savePng;
const ssr_1 = require("@lit-labs/ssr");
const render_result_1 = require("@lit-labs/ssr/lib/render-result");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const sharp_1 = __importDefault(require("sharp"));
function removeLitComments(svg) {
    return svg.replace(/<!--\/?lit-part-->/g, '');
}
async function getSavePath() {
    const path = process.env.SAVE_PNG_PATH;
    if (!path) {
        return;
    }
    (0, promises_1.mkdir)(path, { recursive: true });
    return path;
}
async function renderToPng(element, styles) {
    const rendered = element.renderSVG ? element.renderSVG() : element.render();
    const svgData = await (0, render_result_1.collectResult)((0, ssr_1.render)(rendered));
    const svgStyles = styles ? removeLitComments(await (0, render_result_1.collectResult)((0, ssr_1.render)(styles))) : undefined;
    return await (0, sharp_1.default)(Buffer.from(svgData), {
        svg: { stylesheet: svgStyles },
    })
        .png()
        .toBuffer();
}
async function savePng(name, pngData) {
    const path = await getSavePath();
    if (!path) {
        return;
    }
    await (0, promises_1.writeFile)((0, path_1.join)(path, `${name}.png`), pngData);
}
