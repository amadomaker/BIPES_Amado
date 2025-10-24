"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const ks2e_m_dc5_element_1 = require("./ks2e-m-dc5-element");
const test_utils_1 = require("./utils/test-utils");
(0, vitest_1.describe)('KS2EMDC5Element', () => {
    (0, vitest_1.it)('should render to svg', async () => {
        const pngData = await (0, test_utils_1.renderToPng)(new ks2e_m_dc5_element_1.KS2EMDC5Element());
        await (0, test_utils_1.savePng)('wokwi-ks2e-m-dc5', pngData);
    });
});
