"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnknownZodTypeError = exports.MissingParameterDataError = exports.ConflictError = exports.ZodToOpenAPIError = void 0;
class ZodToOpenAPIError {
    constructor(message) {
        this.message = message;
    }
}
exports.ZodToOpenAPIError = ZodToOpenAPIError;
class ConflictError extends ZodToOpenAPIError {
    constructor(message, data) {
        super(message);
        this.data = data;
    }
}
exports.ConflictError = ConflictError;
class MissingParameterDataError extends ZodToOpenAPIError {
    constructor(data) {
        super(`Missing parameter data, please specify \`${data.missingField}\` and other OpenAPI parameter props using the \`param\` field of \`ZodSchema.openapi\``);
        this.data = data;
    }
}
exports.MissingParameterDataError = MissingParameterDataError;
class UnknownZodTypeError extends ZodToOpenAPIError {
    constructor(data) {
        super(`Unknown zod object type, please specify \`type\` and other OpenAPI props using \`ZodSchema.openapi\`.`);
        this.data = data;
    }
}
exports.UnknownZodTypeError = UnknownZodTypeError;
