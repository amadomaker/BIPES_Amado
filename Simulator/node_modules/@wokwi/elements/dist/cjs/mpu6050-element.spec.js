"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const mpu6050_element_1 = require("./mpu6050-element");
const test_utils_1 = require("./utils/test-utils");
(0, vitest_1.describe)('MPU6050Element', () => {
    (0, vitest_1.it)('should render to svg', async () => {
        const pngData = await (0, test_utils_1.renderToPng)(new mpu6050_element_1.MPU6050Element());
        await (0, test_utils_1.savePng)('wokwi-mpu6050', pngData);
    });
});
