"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenApiGeneratorV31 = void 0;
const openapi_generator_1 = require("../openapi-generator");
const specifics_1 = require("./specifics");
function isWebhookDefinition(definition) {
    return 'type' in definition && definition.type === 'webhook';
}
class OpenApiGeneratorV31 {
    constructor(definitions) {
        this.definitions = definitions;
        this.webhookRefs = {};
        const specifics = new specifics_1.OpenApiGeneratorV31Specifics();
        this.generator = new openapi_generator_1.OpenAPIGenerator(this.definitions, specifics);
    }
    generateDocument(config) {
        const baseDocument = this.generator.generateDocumentData();
        this.definitions
            .filter(isWebhookDefinition)
            .forEach(definition => this.generateSingleWebhook(definition.webhook));
        return Object.assign(Object.assign(Object.assign({}, config), baseDocument), { webhooks: this.webhookRefs });
    }
    generateComponents() {
        return this.generator.generateComponents();
    }
    generateSingleWebhook(route) {
        const routeDoc = this.generator.generatePath(route);
        this.webhookRefs[route.path] = Object.assign(Object.assign({}, this.webhookRefs[route.path]), routeDoc);
        return routeDoc;
    }
}
exports.OpenApiGeneratorV31 = OpenApiGeneratorV31;
