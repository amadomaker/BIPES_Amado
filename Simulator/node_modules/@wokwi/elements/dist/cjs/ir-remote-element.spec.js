"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const ir_remote_element_1 = require("./ir-remote-element");
const test_utils_1 = require("./utils/test-utils");
(0, vitest_1.describe)('IRRemoteElement', () => {
    (0, vitest_1.it)('should render to svg', async () => {
        const pngData = await (0, test_utils_1.renderToPng)(new ir_remote_element_1.IRRemoteElement(), ir_remote_element_1.IRRemoteElement.styles);
        await (0, test_utils_1.savePng)('wokwi-ir-remote', pngData);
    });
});
