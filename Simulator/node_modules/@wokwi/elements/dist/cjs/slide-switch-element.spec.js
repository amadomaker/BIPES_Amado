"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const slide_switch_element_1 = require("./slide-switch-element");
const test_utils_1 = require("./utils/test-utils");
(0, vitest_1.describe)('SlideSwitchElement', () => {
    (0, vitest_1.it)('should render to svg', async () => {
        const pngData = await (0, test_utils_1.renderToPng)(new slide_switch_element_1.SlideSwitchElement(), slide_switch_element_1.SlideSwitchElement.styles);
        await (0, test_utils_1.savePng)('wokwi-slide-switch', pngData);
    });
});
