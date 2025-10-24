"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const lcd1602_element_1 = require("./lcd1602-element");
const test_utils_1 = require("./utils/test-utils");
(0, vitest_1.describe)('LCD1602Element', () => {
    (0, vitest_1.it)('should render to svg', async () => {
        const pngData = await (0, test_utils_1.renderToPng)(new lcd1602_element_1.LCD1602Element(), lcd1602_element_1.LCD1602Element.styles);
        await (0, test_utils_1.savePng)('wokwi-lcd1602', pngData);
    });
});
