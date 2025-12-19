"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const _7segment_element_1 = require("./7segment-element");
const test_utils_1 = require("./utils/test-utils");
(0, vitest_1.describe)('SevenSegmentElement', () => {
    (0, vitest_1.it)('should render to svg', async () => {
        const pngData = await (0, test_utils_1.renderToPng)(new _7segment_element_1.SevenSegmentElement(), _7segment_element_1.SevenSegmentElement.styles);
        await (0, test_utils_1.savePng)('wokwi-7segment', pngData);
    });
});
