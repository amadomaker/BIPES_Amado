"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const ky_040_element_1 = require("./ky-040-element");
const test_utils_1 = require("./utils/test-utils");
(0, vitest_1.describe)('KY040Element', () => {
    (0, vitest_1.it)('should render to svg', async () => {
        const pngData = await (0, test_utils_1.renderToPng)(new ky_040_element_1.KY040Element(), ky_040_element_1.KY040Element.styles);
        await (0, test_utils_1.savePng)('wokwi-ky-040', pngData);
    });
});
