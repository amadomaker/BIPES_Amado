"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const potentiometer_element_1 = require("./potentiometer-element");
const test_utils_1 = require("./utils/test-utils");
(0, vitest_1.describe)('PotentiometerElement', () => {
    (0, vitest_1.it)('should render to svg', async () => {
        const pngData = await (0, test_utils_1.renderToPng)(new potentiometer_element_1.PotentiometerElement(), potentiometer_element_1.PotentiometerElement.styles);
        await (0, test_utils_1.savePng)('wokwi-potentiometer', pngData);
    });
});
