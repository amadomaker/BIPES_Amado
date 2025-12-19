"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const flame_sensor_element_1 = require("./flame-sensor-element");
const test_utils_1 = require("./utils/test-utils");
(0, vitest_1.describe)('FlameSensorElement', () => {
    (0, vitest_1.it)('should render to svg', async () => {
        const pngData = await (0, test_utils_1.renderToPng)(new flame_sensor_element_1.FlameSensorElement());
        await (0, test_utils_1.savePng)('wokwi-flame-sensor', pngData);
    });
});
