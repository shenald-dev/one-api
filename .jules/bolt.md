## 2024-05-18 — Process Reliability: Exiting on Uncaught Exceptions

Learning:
Swallowing `uncaughtException` and `unhandledRejection` leaves the Node.js process in an undefined and potentially corrupted state, which is a significant reliability and security flaw, especially for a continuously running API gateway.

Action:
Fixed the global error handlers in `src/index.js` to call `process.exit(1)`, ensuring the process terminates safely and allows a process manager to restart it cleanly. Always ensure future Node.js applications follow this pattern rather than swallowing exceptions.
## 2024-05-18 — Handle Large Payload Sizes for LLM APIS

Learning:
Unrestricted payload limits can cause Node.js processes to crash or run out of memory when dealing with large LLM prompts. `express.json()` doesn't have a large enough default payload limit for these contexts. Also, when payload size exceeds the limit, Express throws an `entity.too.large` error that needs to be explicitly caught and converted to a 413 response; otherwise, a generic 500 error is returned.

Action:
Increased the `express.json()` payload limit to `10mb` in `src/index.js` and added a specific error handler for `entity.too.large` errors to return a clean 413 Payload Too Large response.
