"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const ili9341_element_1 = require("./ili9341-element");
const test_utils_1 = require("./utils/test-utils");
(0, vitest_1.describe)('ILI9341Element', () => {
    (0, vitest_1.it)('should render to svg', async () => {
        const pngData = await (0, test_utils_1.renderToPng)(new ili9341_element_1.ILI9341Element(), ili9341_element_1.ILI9341Element.styles);
        await (0, test_utils_1.savePng)('wokwi-ili9341', pngData);
    });
});
