"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const led_element_1 = require("./led-element");
const test_utils_1 = require("./utils/test-utils");
(0, vitest_1.describe)('LEDElement', () => {
    (0, vitest_1.it)('should render to svg', async () => {
        const pngData = await (0, test_utils_1.renderToPng)(new led_element_1.LEDElement(), led_element_1.LEDElement.styles);
        await (0, test_utils_1.savePng)('wokwi-led', pngData);
    });
});
