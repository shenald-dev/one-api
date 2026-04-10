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
Modified the custom generic error handler in `src/index.js` to check if `res.headersSent` is true. If it is, `next(err)` is returned to delegate handling to the default Express error handler, which safely closes the connection and prevents application crashes. Always add this check when writing custom error handlers in Express.

## 2024-06-10 — Hardening API Payload Validation

Learning:
Relaxed API validation parameters can allow bad input to bypass basic shape checks resulting in unpredictable application state or potential prototype pollution / downstream SDK failure. For example, simply checking `!Array.isArray(messages)` allowed empty arrays to pass. Furthermore, deep validation of individual objects within arrays is crucial since LLM libraries rely on specific internal array structures.

Action:
Strengthened `/v1/chat/completions` API boundary checks in `src/index.js` by explicitly verifying that string variables (`model`) are not empty (`!model.trim()`), ensuring that `messages` has a `length > 0`, and heavily validating the shape of each individual message object (verifying types, required fields, and preventing accidental arrays from masquerading as object inputs) before passing the data onward.

## 2024-06-16 — Express Graceful Shutdown and Connection Timeouts

Learning:
In a long-running Express server or API gateway, sudden process termination drops active client connections mid-flight, causing errors and degrading reliability. Furthermore, default Express keep-alive timeouts (5 seconds) are often shorter than those of upstream load balancers (e.g., AWS ALB is 60s), which can lead to intermittent 502/504 errors when the load balancer tries to reuse a connection the Express server has just closed.

Action:
Added graceful shutdown logic in `src/index.js` to handle `SIGINT` and `SIGTERM` signals by calling `server.close()` to cleanly finish active requests before exiting, with a 10-second timeout fallback. Additionally, increased `server.keepAliveTimeout` to 65000ms (65s) and `server.headersTimeout` to 66000ms (66s) to ensure the server gracefully handles long-lived connections from load balancers or slower clients without abruptly terminating them.

## 2024-06-21 — API Response Compression

Learning:
LLM API interactions often involve large JSON payloads (both requests and responses). Without response compression, serving large API payloads consumes excess bandwidth and increases API latency, particularly over slower networks.

Action:
Introduced the `compression` middleware to `src/index.js` to automatically compress API responses using gzip/deflate. This improves overall throughput, reduces payload sizes, and lowers API latency.

## 2024-06-25 — Map Cache Single Get Lookup

Learning:
In performance-critical caching logic using a JavaScript `Map`, using `.has()` followed by `.get()` results in redundant hash lookups.

Action:
Optimized the caching logic in `heavyComputation` within `src/index.js` to use a single `.get()` call followed by a strict `!== undefined` check. This reduces lookup overhead, assuming `undefined` is not a valid cached result.

## 2026-03-31 — Array Validation Loop Optimization

Learning:
Iterating through arrays using standard `for (let i = 0; ...)` loops inside critical hot paths, such as the payload validation sequence in `/v1/chat/completions`, requires extra syntax overhead, continuous `length` lookups, index variable allocation, and array indexing calls.

Action:
Replaced the `for` loop in `app.post('/v1/chat/completions')` array validation in `src/index.js` with a `for...of` loop. `for...of` in modern V8 engines is slightly faster for straightforward iteration and provides more readable and cleaner code than classical `for` loops by avoiding indexing operations on every iteration.

## 2026-04-02 — Speeding Up Graceful Shutdown of Keep-Alive Connections

Learning:
When calling `server.close()` to cleanly shut down an Express server, Node.js waits for all existing connections to naturally end. Because we increased `server.keepAliveTimeout` to 65s for load balancer compatibility, idle keep-alive connections will block the shutdown process for up to a minute, causing the fallback timeout (10s) to be hit unnecessarily.

Action:
Added `server.closeIdleConnections()` before `server.close()` in `src/index.js` to instantly close all inactive keep-alive connections without dropping active requests. Also added `server.closeAllConnections()` inside the force-shutdown timeout to explicitly sever any stalled connections before `process.exit(1)`. This speeds up deployment rollouts and cleanly terminates idle load balancer sockets.

## 2026-04-03 — Disable Express ETag for Highly Dynamic JSON APIs

Learning:
For Express applications serving highly dynamic JSON APIs (such as an LLM gateway), default `ETag` generation consumes CPU cycles computing MD5 hashes for caching. Since these responses are always unique (e.g., chat completions with UUIDs), the ETag is pure overhead and never results in a cache hit.

Action:
Disabled ETag generation globally via `app.set('etag', false);` in `src/index.js` to save CPU cycles and reduce latency, aligning with the performance standard to eliminate duplicate/unnecessary computation.

## 2026-04-03 — Graceful Shutdown Idempotency

Learning:
When multiple termination signals (e.g., SIGINT and SIGTERM) are received concurrently by the Express server, the graceful shutdown logic executes multiple times, potentially leading to redundant `server.close()` calls and race conditions during process termination.

Action:
Added an `isShuttingDown` idempotency flag to the `shutdown` function in `src/index.js`. This ensures the shutdown sequence only executes once, ignoring subsequent termination signals, resulting in cleaner and more reliable process termination.

## 2026-04-04 — Always Remove Scratchpad Files Before Commit

Learning:
When writing temporary scripts (e.g., `test-crash-error.js`) to explore the codebase or verify bugs/fixes in isolation, leaving them in the repository root pollutes the workspace and leads to dirty commits that degrade codebase quality.

Action:
Always execute a cleanup command (e.g., `rm -f test-*.js`) to remove any scratchpad files created during exploration before concluding the run and finalizing the commit.
## 2026-04-09 — Abstract multi-clause conditionals to helper functions

Learning:
Multi-clause logic conditionals inside API route handlers decrease readability and make unit testing logic boundaries difficult.

Action:
Extracted complex boolean conditionals used to validate the `model` and `messages` arrays in `/v1/chat/completions` into standalone `isValidModel` and `isValidMessagesArray` helper functions, and exported them to `tests/api.test.js` to individually verify input boundaries.

## 2026-04-10 — Restrict CORS Default Configuration

Learning:
Defaulting the `cors` middleware to allow all origins (`*`) opens the API to cross-origin requests from any domain, which can be a security risk if the API gateway is meant to serve a specific client application.

Action:
Modified the CORS configuration in `src/index.js` to strictly adhere to the `ALLOWED_ORIGINS` environment variable. If `ALLOWED_ORIGINS` is unset, the app defaults to `origin: false` to disable cross-origin resource sharing.
