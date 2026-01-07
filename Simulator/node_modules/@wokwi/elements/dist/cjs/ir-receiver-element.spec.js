"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const ir_receiver_element_1 = require("./ir-receiver-element");
const test_utils_1 = require("./utils/test-utils");
(0, vitest_1.describe)('IRReceiverElement', () => {
    (0, vitest_1.it)('should render to svg', async () => {
        const pngData = await (0, test_utils_1.renderToPng)(new ir_receiver_element_1.IRReceiverElement());
        await (0, test_utils_1.savePng)('wokwi-ir-receiver', pngData);
    });
});
