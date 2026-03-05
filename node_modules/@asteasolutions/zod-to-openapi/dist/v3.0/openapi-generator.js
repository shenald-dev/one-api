"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenApiGeneratorV3 = void 0;
const openapi_generator_1 = require("../openapi-generator");
const specifics_1 = require("./specifics");
class OpenApiGeneratorV3 {
    constructor(definitions) {
        const specifics = new specifics_1.OpenApiGeneratorV30Specifics();
        this.generator = new openapi_generator_1.OpenAPIGenerator(definitions, specifics);
    }
    generateDocument(config) {
        const baseData = this.generator.generateDocumentData();
        return Object.assign(Object.assign({}, config), baseData);
    }
    generateComponents() {
        return this.generator.generateComponents();
    }
}
exports.OpenApiGeneratorV3 = OpenApiGeneratorV3;
