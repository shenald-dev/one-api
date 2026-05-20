## 2024-05-18 — Process Reliability: Exiting on Uncaught Exceptions

        Learning:
        Swallowing `uncaughtException` and `unhandledRejection` leaves the Node.js process in an undefined and potentially corrupted state, which is a significant reliability and security flaw, especially for a continuously running API gateway.

        Action:
        Fixed the global error handlers in `src/index.js` to call `process.exit(1)`, ensuring the process terminates safely and allows a process manager to restart it cleanly. Always ensure future Node.js applications follow this pattern rather than swallowing exceptions.
        ## 2024-05-18 — Express Payload Limits for LLMs

        Learning:
        The default Express `express.json()` middleware limits incoming JSON payloads to 100kb, which is too small for large language model (LLM) contexts or multi-shot prompts. Additionally, exceeding this limit throws an `entity.too.large` error that ungracefully drops to a generic 500 status without explicit handling.

        Action:
        Increased the JSON payload limit in `src/index.js` to 10mb, and added an explicit error handler to intercept `err.type === 'entity.too.large'` and r

        // ... 19894.6 characters truncated (middle section) ...

        ## 2024-05-18 — Express Payload Limits for LLMs

        Learning:
        The default Express `express.json()` middleware limits incoming JSON payloads to 100kb, which is too small for large language model (LLM) contexts or multi-shot prompts. Additionally, exceeding this limit throws an `entity.too.large` error that ungracefully drops to a generic 500 status without explicit handling.

        Action:
        Increased the JSON payload limit in `src/index.js` to 10mb, and added an explicit error handler to intercept `err.type === 'entity.too.large'` and r

        // ... 19894.6 characters truncated (middle section) ...

        ## 2026-05-12 — Compression Middleware Overhead
        Learning:
        Global `compression()` middleware introduces significant CPU and memory allocation overhead on unhandled routes (404s) and lightweight responses.
        Action:
        Always apply `compression()` as a route-specific middleware only to endpoints that return large payloads.
        ## $(date +%Y-%m-%d) — Multimodal Content Parsing Support
        Learning:
        OpenAI-compatible unified gateways must support multimodal requests, which structure the `content` field of a message as an array instead of a string.
        Action:
        Updated `isValidMessage` validation logic to permit arrays to support multimodal features without altering standard string validation. Tests were successfully added.