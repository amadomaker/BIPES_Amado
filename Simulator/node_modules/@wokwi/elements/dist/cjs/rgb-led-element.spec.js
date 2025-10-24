"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const rgb_led_element_1 = require("./rgb-led-element");
const test_utils_1 = require("./utils/test-utils");
(0, vitest_1.describe)('RGBLedElement', () => {
    (0, vitest_1.it)('should render to svg', async () => {
        const pngData = await (0, test_utils_1.renderToPng)(new rgb_led_element_1.RGBLedElement());
        await (0, test_utils_1.savePng)('wokwi-rgb-led', pngData);
    });
});
