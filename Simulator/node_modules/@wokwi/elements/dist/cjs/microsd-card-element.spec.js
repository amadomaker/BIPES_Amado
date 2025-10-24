"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const microsd_card_element_1 = require("./microsd-card-element");
const test_utils_1 = require("./utils/test-utils");
(0, vitest_1.describe)('MicrosdCardElement', () => {
    (0, vitest_1.it)('should render to svg', async () => {
        const pngData = await (0, test_utils_1.renderToPng)(new microsd_card_element_1.MicrosdCardElement());
        await (0, test_utils_1.savePng)('wokwi-microsd-card', pngData);
    });
});
