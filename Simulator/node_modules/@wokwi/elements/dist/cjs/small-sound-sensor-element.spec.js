"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const small_sound_sensor_element_1 = require("./small-sound-sensor-element");
const test_utils_1 = require("./utils/test-utils");
(0, vitest_1.describe)('SmallSoundSensorElement', () => {
    (0, vitest_1.it)('should render to svg', async () => {
        const pngData = await (0, test_utils_1.renderToPng)(new small_sound_sensor_element_1.SmallSoundSensorElement());
        await (0, test_utils_1.savePng)('wokwi-small-sound-sensor', pngData);
    });
});
