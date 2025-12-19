"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const ds1307_element_1 = require("./ds1307-element");
const test_utils_1 = require("./utils/test-utils");
(0, vitest_1.describe)('Ds1307Element', () => {
    (0, vitest_1.it)('should render to svg', async () => {
        const pngData = await (0, test_utils_1.renderToPng)(new ds1307_element_1.Ds1307Element());
        await (0, test_utils_1.savePng)('wokwi-ds1307', pngData);
    });
});
