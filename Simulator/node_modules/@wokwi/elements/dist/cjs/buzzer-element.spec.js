"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const buzzer_element_1 = require("./buzzer-element");
const test_utils_1 = require("./utils/test-utils");
(0, vitest_1.describe)('BuzzerElement', () => {
    (0, vitest_1.it)('should render to svg', async () => {
        const pngData = await (0, test_utils_1.renderToPng)(new buzzer_element_1.BuzzerElement(), buzzer_element_1.BuzzerElement.styles);
        await (0, test_utils_1.savePng)('wokwi-buzzer', pngData);
    });
});
