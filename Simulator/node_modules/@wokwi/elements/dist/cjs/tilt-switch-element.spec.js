"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const tilt_switch_element_1 = require("./tilt-switch-element");
const test_utils_1 = require("./utils/test-utils");
(0, vitest_1.describe)('TiltSwitchElement', () => {
    (0, vitest_1.it)('should render to svg', async () => {
        const pngData = await (0, test_utils_1.renderToPng)(new tilt_switch_element_1.TiltSwitchElement());
        await (0, test_utils_1.savePng)('wokwi-tilt-switch', pngData);
    });
});
