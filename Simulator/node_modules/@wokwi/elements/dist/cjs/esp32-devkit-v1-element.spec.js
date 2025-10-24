"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const esp32_devkit_v1_element_1 = require("./esp32-devkit-v1-element");
const test_utils_1 = require("./utils/test-utils");
(0, vitest_1.describe)('ESP32DevkitV1Element', () => {
    (0, vitest_1.it)('should render to svg', async () => {
        const pngData = await (0, test_utils_1.renderToPng)(new esp32_devkit_v1_element_1.ESP32DevkitV1Element());
        await (0, test_utils_1.savePng)('wokwi-esp32-devkit-v1', pngData);
    });
});
