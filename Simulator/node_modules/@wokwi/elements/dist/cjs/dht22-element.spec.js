"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const dht22_element_1 = require("./dht22-element");
const test_utils_1 = require("./utils/test-utils");
(0, vitest_1.describe)('DHT22Element', () => {
    (0, vitest_1.it)('should render to svg', async () => {
        const pngData = await (0, test_utils_1.renderToPng)(new dht22_element_1.DHT22Element());
        await (0, test_utils_1.savePng)('wokwi-dht22', pngData);
    });
});
