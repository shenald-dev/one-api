import { serve } from '@hono/node-server';
import { OpenAPIHono } from '@hono/zod-openapi';
import { chatRoute } from './routes/chat';

const app = new OpenAPIHono();

app.get('/health', (c) => {
    return c.json({ status: 'ok', message: 'One-API Gateway is Operational ⚡' });
});

// Register routes
app.openapi(chatRoute, (c) => {
    const { model, messages } = c.req.valid('json');
    return c.json({
        id: "chatcmpl-vibe",
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: model,
        choices: [
            {
                index: 0,
                message: {
                    role: "assistant",
                    content: "Hello from One-API!"
                },
                finish_reason: "stop"
            }
        ]
    });
});

const port = 3000;
console.log(`Server is running on port ${port}`);

serve({
    fetch: app.fetch,
    port
});
