"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SPACE_KEYS = void 0;
exports.getUserAgent = getUserAgent;
exports.ctrlCmdPressed = ctrlCmdPressed;
exports.SPACE_KEYS = [' ', 'Spacebar'];
function getUserAgent() {
    return typeof navigator === 'object' ? navigator.userAgent : '';
}
function isMac() {
    return getUserAgent().indexOf('Macintosh') >= 0;
}
function ctrlCmdPressed(e) {
    return isMac() ? e.metaKey : e.ctrlKey;
}
