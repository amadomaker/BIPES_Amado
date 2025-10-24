"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const heart_beat_sensor_element_1 = require("./heart-beat-sensor-element");
const test_utils_1 = require("./utils/test-utils");
(0, vitest_1.describe)('HeartBeatSensorElement', () => {
    (0, vitest_1.it)('should render to svg', async () => {
        const pngData = await (0, test_utils_1.renderToPng)(new heart_beat_sensor_element_1.HeartBeatSensorElement());
        await (0, test_utils_1.savePng)('wokwi-heart-beat-sensor', pngData);
    });
});
