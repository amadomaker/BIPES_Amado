"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const pushbutton_6mm_element_1 = require("./pushbutton-6mm-element");
const test_utils_1 = require("./utils/test-utils");
(0, vitest_1.describe)('Pushbutton6mmElement', () => {
    (0, vitest_1.it)('should render to svg', async () => {
        const pngData = await (0, test_utils_1.renderToPng)(new pushbutton_6mm_element_1.Pushbutton6mmElement(), pushbutton_6mm_element_1.Pushbutton6mmElement.styles);
        await (0, test_utils_1.savePng)('wokwi-pushbutton-6mm', pngData);
    });
});
