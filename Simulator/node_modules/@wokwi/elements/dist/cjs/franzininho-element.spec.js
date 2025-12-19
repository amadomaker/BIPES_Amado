"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const franzininho_element_1 = require("./franzininho-element");
const test_utils_1 = require("./utils/test-utils");
(0, vitest_1.describe)('FranzininhoElement', () => {
    (0, vitest_1.it)('should render to svg', async () => {
        const pngData = await (0, test_utils_1.renderToPng)(new franzininho_element_1.FranzininhoElement(), franzininho_element_1.FranzininhoElement.styles);
        await (0, test_utils_1.savePng)('wokwi-franzininho', pngData);
    });
});
