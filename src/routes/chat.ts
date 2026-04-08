import { createRoute, z } from '@hono/zod-openapi';

const ChatMessageSchema = z.object({
    role: z.enum(['system', 'user', 'assistant']),
    content: z.string()
});

const ChatRequestSchema = z.object({
    model: z.string().default('gpt-4-turbo'),
    messages: z.array(ChatMessageSchema),
    temperature: z.number().optional().default(0.7)
});

const ChatResponseSchema = z.object({
    id: z.string(),
    object: z.string(),
    created: z.number(),
    model: z.string(),
    choices: z.array(z.object({
        index: z.number(),
        message: ChatMessageSchema,
        finish_reason: z.string()
    }))
});

export const chatRoute = createRoute({
    method: 'post',
    path: '/v1/chat/completions',
    request: {
        body: {
            content: { 'application/json': { schema: ChatRequestSchema } }
        }
    },
    responses: {
        200: {
            content: { 'application/json': { schema: ChatResponseSchema } },
            description: 'Successful OpenAI-compatible chat completion response'
        }
    }
});
