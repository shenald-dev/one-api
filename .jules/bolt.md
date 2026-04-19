## 2024-05-18 — Process Reliability: Exiting on Uncaught Exceptions

Learning:
Swallowing `uncaughtException` and `unhandledRejection` leaves the Node.js process in an undefined and potentially corrupted state, which is a significant reliability and security flaw, especially for a continuously running API gateway.

Action:
Fixed the global error handlers in `src/index.js` to call `process.exit(1)`, ensuring the process terminates safely and allows a process manager to restart it cleanly. Always ensure future Node.js applications follow this pattern rather than swallowing exceptions.
## 2024-05-18 — Express Payload Limits for LLMs

Learning:
The default Express `express.json()` middleware limits incoming JSON payloads to 100kb, which is too small for large language model (LLM) contexts or multi-shot prompts. Additionally, exceeding this limit throws an `entity.too.large` error that ungracefully drops to a generic 500 status without explicit handling.

Action:
Increased the JSON payload limit in `src/index.js` to 10mb, and added an explicit error handler to intercept `err.type === 'entity.too.large'` and return a standardized `413 Payload Too Large` JSON response.

## 2024-05-24 — Improve array validation and bound computationCache memory map size

Learning:
Unbounded Map caches in repeated serverless or long-running operations can cause memory leaks. Also, `req.body.messages` without `Array.isArray()` validation can lead to crashes if a string is provided and later mapped.

Action:
Added strict `!Array.isArray(messages)` validation to the `/v1/chat/completions` API route, and restricted the `computationCache` Map size to 1000 items in `src/index.js` to ensure long-term stability and resilience.

## 2024-05-30 — Implemented LRU Cache Eviction

Learning:
Clearing an entire `Map` cache (cache stampede) when it reaches its size limit causes subsequent calls to experience cache misses all at once, leading to sudden performance drops.

Action:
Modified the memoization cache logic in `src/index.js` to refresh items on hit and evict only the single oldest entry (LRU - Least Recently Used) using `computationCache.keys().next().value` when the size limit of 1000 is reached. This maintains a bounded cache while smoothing out performance and avoiding sudden cache misses for active items.

## 2024-06-05 — Delegating Error Handling When Headers Are Sent

Learning:
If headers have already been sent to the client (`res.headersSent === true`) in an Express application and an error occurs, attempting to send another response in a custom error handler using methods like `res.status(500).json(...)` throws an `ERR_HTTP_HEADERS_SENT` exception. This crashes the application and leaves the client connection hanging indefinitely.

Action:
Modified the custom generic error handler in `src/index.js` to check if `res.headersSent` is true. If it is, `next(err)` is returned to delegate handling to the default Express error handler, which safely closes the connection and preven
... (truncated)