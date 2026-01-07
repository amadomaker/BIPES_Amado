"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const hx711_element_1 = require("./hx711-element");
const test_utils_1 = require("./utils/test-utils");
(0, vitest_1.describe)('HX711Element', () => {
    (0, vitest_1.it)('should render to svg', async () => {
        const pngData = await (0, test_utils_1.renderToPng)(new hx711_element_1.HX711Element(), hx711_element_1.HX711Element.styles);
        await (0, test_utils_1.savePng)('wokwi-hx711', pngData);
    });
});
