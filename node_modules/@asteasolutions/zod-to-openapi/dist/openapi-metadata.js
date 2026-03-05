"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOpenApiMetadata = void 0;
const lodash_1 = require("./lib/lodash");
function getOpenApiMetadata(zodSchema) {
    var _a, _b;
    return (0, lodash_1.omitBy)((_b = (_a = zodSchema._def.openapi) === null || _a === void 0 ? void 0 : _a.metadata) !== null && _b !== void 0 ? _b : {}, lodash_1.isNil);
}
exports.getOpenApiMetadata = getOpenApiMetadata;
