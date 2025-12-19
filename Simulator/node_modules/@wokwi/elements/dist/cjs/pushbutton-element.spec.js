"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const pushbutton_element_1 = require("./pushbutton-element");
const test_utils_1 = require("./utils/test-utils");
(0, vitest_1.describe)('PushbuttonElement', () => {
    (0, vitest_1.it)('should render to svg', async () => {
        const pngData = await (0, test_utils_1.renderToPng)(new pushbutton_element_1.PushbuttonElement(), pushbutton_element_1.PushbuttonElement.styles);
        await (0, test_utils_1.savePng)('wokwi-pushbutton', pngData);
    });
});
