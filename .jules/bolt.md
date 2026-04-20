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
Modified the custom generic error handler in `src/index.js` to check if `res.headersSent` is true. If it is, `next(err)` is returned to delegate handling to the default Express error hand

// ... 6438 characters truncated (middle section) ...

hat/completions` into standalone `isValidModel` and `isValidMessagesArray` helper functions, and exported them to `tests/api.test.js` to individually verify input boundaries.
2026-04-15 — Dynamic CORS Configuration
Learning: Express cors middleware interprets origin: ['*'] as an exact string match for an asterisk, preventing wildcard functionality.
Action: Ensure * is extracted from parsed environment lists and passed directly as origin: '*' when configuring CORS.

2026-04-16 — Prevent redundant iteration in benchmark runner
Learning: The benchmark runner script `benchmarks/run.js` was duplicating iteration and performance reporting logic already present in the target exported functions (e.g., `main`), leading to redundant execution and inaccurate outer timing results.
Action: Simplified `benchmarks/run.js` to purely invoke the exported function and delegate iteration and measurement to the target script.

## $(date +%Y-%m-%d) — Optimize Module Mocking in Tests

Learning:
In `tests/test.js`, the mock module loader (`Module.prototype.require`) was allocating a new array `['express', 'cors', 'helmet', 'dotenv', 'compression']` and performing an O(n) `.includes()` lookup on *every single module require*. In hot paths like module loading, this causes unnecessary allocations and CPU overhead.

Action:
Extracted the array into a persistent `Set` named `MOCKED_MODULES` outside the hook, transforming the lookup into an O(1) operation (`MOCKED_MODULES.has(name)`) and completely eliminating the repeated memory allocations on every require call.

## 2026-04-18 — Optimize Health Check Endpoint

Learning:
High-frequency, simple endpoints like `/health` that don't require request bodies or response compression incur unnecessary CPU and latency overhead when placed below heavy global middleware like `express.json` and `compression`.

Action:
Moved the `/health` endpoint definition in `src/index.js` to be placed before `compression` and `express.json` middleware declarations. This avoids redundant parsing and compression overhead for simple pings, maximizing throughput.

## 2026-04-19 — Optimize Static Object Allocation

Learning:
The `/v1/chat/completions` endpoint was previously allocating the exact same static mock response structures (`choices` and `usage` blocks) internally on every incoming API request. In a high-traffic gateway or mock server, re-allocating static, unchanging objects for every request puts unnecessary pressure on the V8 Garbage Collector and wastes CPU cycles traversing object literals.

Action:
Extracted the repeated `choices` and `usage` data structures out of the `app.post` route handler, placed them in module-scoped constants (`MOCK_CHOICES`, `MOCK_USAGE`), and deeply applied `Object.freeze()` to them. This ensures these constant payload fragments are allocated exactly once at startup, enforcing immutability and preventing repeated memory allocations during high-throughput benchmarks.