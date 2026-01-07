"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const hc_sr04_element_1 = require("./hc-sr04-element");
const test_utils_1 = require("./utils/test-utils");
(0, vitest_1.describe)('HCSR04Element', () => {
    (0, vitest_1.it)('should render to svg', async () => {
        const pngData = await (0, test_utils_1.renderToPng)(new hc_sr04_element_1.HCSR04Element());
        await (0, test_utils_1.savePng)('wokwi-hc-sr04', pngData);
    });
});
