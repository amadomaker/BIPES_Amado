"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const biaxial_stepper_element_1 = require("./biaxial-stepper-element");
const test_utils_1 = require("./utils/test-utils");
(0, vitest_1.describe)('BiaxialStepperElement', () => {
    (0, vitest_1.it)('should render to svg', async () => {
        const pngData = await (0, test_utils_1.renderToPng)(new biaxial_stepper_element_1.BiaxialStepperElement());
        await (0, test_utils_1.savePng)('wokwi-biaxial-stepper', pngData);
    });
});
