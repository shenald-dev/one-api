"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAnyZodType = exports.isZodType = void 0;
function isZodType(schema, typeName) {
    var _a;
    return ((_a = schema === null || schema === void 0 ? void 0 : schema._def) === null || _a === void 0 ? void 0 : _a.typeName) === typeName;
}
exports.isZodType = isZodType;
function isAnyZodType(schema) {
    return '_def' in schema;
}
exports.isAnyZodType = isAnyZodType;
