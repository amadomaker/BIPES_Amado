"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const ntc_temperature_sensor_element_1 = require("./ntc-temperature-sensor-element");
const test_utils_1 = require("./utils/test-utils");
(0, vitest_1.describe)('NTCTemperatureSensorElement', () => {
    (0, vitest_1.it)('should render to svg', async () => {
        const pngData = await (0, test_utils_1.renderToPng)(new ntc_temperature_sensor_element_1.NTCTemperatureSensorElement());
        await (0, test_utils_1.savePng)('wokwi-ntc-temperature-sensor', pngData);
    });
});
