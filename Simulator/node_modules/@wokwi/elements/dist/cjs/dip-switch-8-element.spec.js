"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const dip_switch_8_element_1 = require("./dip-switch-8-element");
const test_utils_1 = require("./utils/test-utils");
(0, vitest_1.describe)('DipSwitch8Element', () => {
    (0, vitest_1.it)('should render to svg', async () => {
        const pngData = await (0, test_utils_1.renderToPng)(new dip_switch_8_element_1.DipSwitch8Element());
        await (0, test_utils_1.savePng)('wokwi-dip-switch-8', pngData);
    });
});
