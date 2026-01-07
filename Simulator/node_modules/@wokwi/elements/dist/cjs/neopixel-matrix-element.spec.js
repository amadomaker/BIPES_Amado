"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const neopixel_matrix_element_1 = require("./neopixel-matrix-element");
const test_utils_1 = require("./utils/test-utils");
(0, vitest_1.describe)('NeopixelMatrixElement', () => {
    (0, vitest_1.it)('should render to svg', async () => {
        const pngData = await (0, test_utils_1.renderToPng)(new neopixel_matrix_element_1.NeopixelMatrixElement(), neopixel_matrix_element_1.NeopixelMatrixElement.styles);
        await (0, test_utils_1.savePng)('wokwi-neopixel-matrix', pngData);
    });
});
