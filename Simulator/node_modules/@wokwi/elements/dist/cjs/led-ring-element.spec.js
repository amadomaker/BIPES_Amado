"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const led_ring_element_1 = require("./led-ring-element");
const test_utils_1 = require("./utils/test-utils");
(0, vitest_1.describe)('LEDRingElement', () => {
    (0, vitest_1.it)('should render to svg', async () => {
        const pngData = await (0, test_utils_1.renderToPng)(new led_ring_element_1.LEDRingElement());
        await (0, test_utils_1.savePng)('wokwi-led-ring', pngData);
    });
});
