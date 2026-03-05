"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAPIRegistry = void 0;
class OpenAPIRegistry {
    constructor(parents) {
        this.parents = parents;
        this._definitions = [];
    }
    get definitions() {
        var _a, _b;
        const parentDefinitions = (_b = (_a = this.parents) === null || _a === void 0 ? void 0 : _a.flatMap(par => par.definitions)) !== null && _b !== void 0 ? _b : [];
        return [...parentDefinitions, ...this._definitions];
    }
    /**
     * Registers a new component schema under /components/schemas/${name}
     */
    register(refId, zodSchema) {
        const schemaWithRefId = this.schemaWithRefId(refId, zodSchema);
        this._definitions.push({ type: 'schema', schema: schemaWithRefId });
        return schemaWithRefId;
    }
    /**
     * Registers a new parameter schema under /components/parameters/${name}
     */
    registerParameter(refId, zodSchema) {
        var _a, _b, _c;
        const schemaWithRefId = this.schemaWithRefId(refId, zodSchema);
        const currentMetadata = (_a = schemaWithRefId._def.openapi) === null || _a === void 0 ? void 0 : _a.metadata;
        const schemaWithMetadata = schemaWithRefId.openapi(Object.assign(Object.assign({}, currentMetadata), { param: Object.assign(Object.assign({}, currentMetadata === null || currentMetadata === void 0 ? void 0 : currentMetadata.param), { name: (_c = (_b = currentMetadata === null || currentMetadata === void 0 ? void 0 : currentMetadata.param) === null || _b === void 0 ? void 0 : _b.name) !== null && _c !== void 0 ? _c : refId }) }));
        this._definitions.push({
            type: 'parameter',
            schema: schemaWithMetadata,
        });
        return schemaWithMetadata;
    }
    /**
     * Registers a new path that would be generated under paths:
     */
    registerPath(route) {
        this._definitions.push({
            type: 'route',
            route,
        });
    }
    /**
     * Registers a new webhook that would be generated under webhooks:
     */
    registerWebhook(webhook) {
        this._definitions.push({
            type: 'webhook',
            webhook,
        });
    }
    /**
     * Registers a raw OpenAPI component. Use this if you have a simple object instead of a Zod schema.
     *
     * @param type The component type, e.g. `schemas`, `responses`, `securitySchemes`, etc.
     * @param name The name of the object, it is the key under the component
     *             type in the resulting OpenAPI document
     * @param component The actual object to put there
     */
    registerComponent(type, name, component) {
        this._definitions.push({
            type: 'component',
            componentType: type,
            name,
            component,
        });
        return {
            name,
            ref: { $ref: `#/components/${type}/${name}` },
        };
    }
    schemaWithRefId(refId, zodSchema) {
        return zodSchema.openapi(refId);
    }
}
exports.OpenAPIRegistry = OpenAPIRegistry;
