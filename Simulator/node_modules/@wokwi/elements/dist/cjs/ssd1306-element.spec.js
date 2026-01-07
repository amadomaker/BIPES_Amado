"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const ssd1306_element_1 = require("./ssd1306-element");
const test_utils_1 = require("./utils/test-utils");
class MockImageData {
    constructor(data, width, height = 0) {
        this.colorSpace = 'srgb';
        if (typeof data === 'number') {
            this.width = data;
            this.height = width;
            this.data = new Uint8ClampedArray(this.width * height * 4);
        }
        else {
            this.width = width;
            this.height = height;
            this.data = data;
        }
    }
}
(0, vitest_1.describe)('SSD1306Element', () => {
    (0, vitest_1.it)('should render to svg', async () => {
        global.ImageData = MockImageData;
        const pngData = await (0, test_utils_1.renderToPng)(new ssd1306_element_1.SSD1306Element(), ssd1306_element_1.SSD1306Element.styles);
        await (0, test_utils_1.savePng)('wokwi-ssd1306', pngData);
    });
});
