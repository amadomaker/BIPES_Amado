"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const arduino_mega_element_1 = require("./arduino-mega-element");
const test_utils_1 = require("./utils/test-utils");
(0, vitest_1.describe)('ArduinoMegaElement', () => {
    (0, vitest_1.it)('should render to svg', async () => {
        const pngData = await (0, test_utils_1.renderToPng)(new arduino_mega_element_1.ArduinoMegaElement(), arduino_mega_element_1.ArduinoMegaElement.styles);
        await (0, test_utils_1.savePng)('wokwi-arduino-mega', pngData);
    });
});
