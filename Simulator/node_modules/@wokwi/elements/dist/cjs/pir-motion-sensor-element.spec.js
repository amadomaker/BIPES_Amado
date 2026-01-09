"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const pir_motion_sensor_element_1 = require("./pir-motion-sensor-element");
const test_utils_1 = require("./utils/test-utils");
(0, vitest_1.describe)('PIRMotionSensorElement', () => {
    (0, vitest_1.it)('should render to svg', async () => {
        const pngData = await (0, test_utils_1.renderToPng)(new pir_motion_sensor_element_1.PIRMotionSensorElement());
        await (0, test_utils_1.savePng)('wokwi-pir-motion-sensor', pngData);
    });
});
