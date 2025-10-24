"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const resistor_element_1 = require("./resistor-element");
const test_utils_1 = require("./utils/test-utils");
(0, vitest_1.describe)('ResistorElement', () => {
    (0, vitest_1.it)('should render to svg', async () => {
        const pngData = await (0, test_utils_1.renderToPng)(new resistor_element_1.ResistorElement(), resistor_element_1.ResistorElement.styles);
        await (0, test_utils_1.savePng)('wokwi-resistor', pngData);
    });
});
