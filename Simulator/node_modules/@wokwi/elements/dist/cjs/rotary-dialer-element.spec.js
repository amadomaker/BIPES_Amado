"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const rotary_dialer_element_1 = require("./rotary-dialer-element");
const test_utils_1 = require("./utils/test-utils");
(0, vitest_1.describe)('RotaryDialerElement', () => {
    (0, vitest_1.it)('should render to svg', async () => {
        const pngData = await (0, test_utils_1.renderToPng)(new rotary_dialer_element_1.RotaryDialerElement(), rotary_dialer_element_1.RotaryDialerElement.styles);
        await (0, test_utils_1.savePng)('wokwi-rotary-dialer', pngData);
    });
});
