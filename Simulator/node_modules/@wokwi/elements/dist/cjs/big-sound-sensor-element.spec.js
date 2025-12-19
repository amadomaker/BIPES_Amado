"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const big_sound_sensor_element_1 = require("./big-sound-sensor-element");
const test_utils_1 = require("./utils/test-utils");
(0, vitest_1.describe)('BigSoundSensorElement', () => {
    (0, vitest_1.it)('should render to svg', async () => {
        const pngData = await (0, test_utils_1.renderToPng)(new big_sound_sensor_element_1.BigSoundSensorElement());
        await (0, test_utils_1.savePng)('wokwi-big-sound-sensor', pngData);
    });
});
