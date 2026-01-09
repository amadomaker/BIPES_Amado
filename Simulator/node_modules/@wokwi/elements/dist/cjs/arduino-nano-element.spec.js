"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const arduino_nano_element_1 = require("./arduino-nano-element");
const test_utils_1 = require("./utils/test-utils");
(0, vitest_1.describe)('ArduinoNanoElement', () => {
    (0, vitest_1.it)('should render to svg', async () => {
        const pngData = await (0, test_utils_1.renderToPng)(new arduino_nano_element_1.ArduinoNanoElement(), arduino_nano_element_1.ArduinoNanoElement.styles);
        await (0, test_utils_1.savePng)('wokwi-arduino-nano', pngData);
    });
});
