"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extendZodWithOpenApi = void 0;
const zod_is_type_1 = require("./lib/zod-is-type");
function preserveMetadataFromModifier(zod, modifier) {
    const zodModifier = zod.ZodType.prototype[modifier];
    zod.ZodType.prototype[modifier] = function (...args) {
        const result = zodModifier.apply(this, args);
        result._def.openapi = this._def.openapi;
        return result;
    };
}
function extendZodWithOpenApi(zod) {
    if (typeof zod.ZodType.prototype.openapi !== 'undefined') {
        // This zod instance is already extended with the required methods,
        // doing it again will just result in multiple wrapper methods for
        // `optional` and `nullable`
        return;
    }
    zod.ZodType.prototype.openapi = function (refOrOpenapi, metadata) {
        var _a, _b, _c, _d, _e, _f;
        const openapi = typeof refOrOpenapi === 'string' ? metadata : refOrOpenapi;
        const _g = openapi !== null && openapi !== void 0 ? openapi : {}, { param } = _g, restOfOpenApi = __rest(_g, ["param"]);
        const _internal = Object.assign(Object.assign({}, (_a = this._def.openapi) === null || _a === void 0 ? void 0 : _a._internal), (typeof refOrOpenapi === 'string'
            ? { refId: refOrOpenapi }
            : undefined));
        const resultMetadata = Object.assign(Object.assign(Object.assign({}, (_b = this._def.openapi) === null || _b === void 0 ? void 0 : _b.metadata), restOfOpenApi), (((_d = (_c = this._def.openapi) === null || _c === void 0 ? void 0 : _c.metadata) === null || _d === void 0 ? void 0 : _d.param) || param
            ? {
                param: Object.assign(Object.assign({}, (_f = (_e = this._def.openapi) === null || _e === void 0 ? void 0 : _e.metadata) === null || _f === void 0 ? void 0 : _f.param), param),
            }
            : undefined));
        const result = new this.constructor(Object.assign(Object.assign({}, this._def), { openapi: Object.assign(Object.assign({}, (Object.keys(_internal).length > 0 ? { _internal } : undefined)), (Object.keys(resultMetadata).length > 0
                ? { metadata: resultMetadata }
                : undefined)) }));
        if ((0, zod_is_type_1.isZodType)(this, 'ZodObject')) {
            const originalExtend = this.extend;
            result.extend = function (...args) {
                var _a, _b, _c, _d, _e, _f;
                const extendedResult = originalExtend.apply(this, args);
                extendedResult._def.openapi = {
                    _internal: {
                        extendedFrom: ((_b = (_a = this._def.openapi) === null || _a === void 0 ? void 0 : _a._internal) === null || _b === void 0 ? void 0 : _b.refId)
                            ? { refId: (_d = (_c = this._def.openapi) === null || _c === void 0 ? void 0 : _c._internal) === null || _d === void 0 ? void 0 : _d.refId, schema: this }
                            : (_e = this._def.openapi) === null || _e === void 0 ? void 0 : _e._internal.extendedFrom,
                    },
                    metadata: (_f = extendedResult._def.openapi) === null || _f === void 0 ? void 0 : _f.metadata,
                };
                return extendedResult;
            };
        }
        return result;
    };
    preserveMetadataFromModifier(zod, 'optional');
    preserveMetadataFromModifier(zod, 'nullable');
    preserveMetadataFromModifier(zod, 'default');
    preserveMetadataFromModifier(zod, 'transform');
    preserveMetadataFromModifier(zod, 'refine');
    const zodDeepPartial = zod.ZodObject.prototype.deepPartial;
    zod.ZodObject.prototype.deepPartial = function () {
        const initialShape = this._def.shape();
        const result = zodDeepPartial.apply(this);
        const resultShape = result._def.shape();
        Object.entries(resultShape).forEach(([key, value]) => {
            var _a, _b;
            value._def.openapi = (_b = (_a = initialShape[key]) === null || _a === void 0 ? void 0 : _a._def) === null || _b === void 0 ? void 0 : _b.openapi;
        });
        return result;
    };
    const zodPick = zod.ZodObject.prototype.pick;
    zod.ZodObject.prototype.pick = function (...args) {
        const result = zodPick.apply(this, args);
        result._def.openapi = undefined;
        return result;
    };
    const zodOmit = zod.ZodObject.prototype.omit;
    zod.ZodObject.prototype.omit = function (...args) {
        const result = zodOmit.apply(this, args);
        result._def.openapi = undefined;
        return result;
    };
}
exports.extendZodWithOpenApi = extendZodWithOpenApi;
