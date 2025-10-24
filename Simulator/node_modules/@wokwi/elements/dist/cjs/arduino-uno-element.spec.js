"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const arduino_uno_element_1 = require("./arduino-uno-element");
const test_utils_1 = require("./utils/test-utils");
(0, vitest_1.describe)('ArduinoUnoElement', () => {
    (0, vitest_1.it)('should render to svg', async () => {
        const pngData = await (0, test_utils_1.renderToPng)(new arduino_uno_element_1.ArduinoUnoElement(), arduino_uno_element_1.ArduinoUnoElement.styles);
        await (0, test_utils_1.savePng)('wokwi-arduino-uno', pngData);
    });
});
