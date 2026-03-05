"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uniq = exports.objectEquals = exports.compact = exports.omitBy = exports.omit = exports.mapValues = exports.isNil = exports.isUndefined = void 0;
const object_set_1 = require("./object-set");
function isUndefined(value) {
    return value === undefined;
}
exports.isUndefined = isUndefined;
function isNil(value) {
    return value === null || value === undefined;
}
exports.isNil = isNil;
function mapValues(object, mapper) {
    const result = {};
    Object.entries(object).forEach(([key, value]) => {
        result[key] = mapper(value);
    });
    return result;
}
exports.mapValues = mapValues;
function omit(object, keys) {
    const result = {};
    Object.entries(object).forEach(([key, value]) => {
        if (!keys.some(keyToOmit => keyToOmit === key)) {
            result[key] = value;
        }
    });
    return result;
}
exports.omit = omit;
function omitBy(object, predicate) {
    const result = {};
    Object.entries(object).forEach(([key, value]) => {
        if (!predicate(value, key)) {
            result[key] = value;
        }
    });
    return result;
}
exports.omitBy = omitBy;
function compact(arr) {
    return arr.filter((elem) => !isNil(elem));
}
exports.compact = compact;
exports.objectEquals = object_set_1.isEqual;
function uniq(values) {
    const set = new object_set_1.ObjectSet();
    values.forEach(value => set.put(value));
    return [...set.values()];
}
exports.uniq = uniq;
