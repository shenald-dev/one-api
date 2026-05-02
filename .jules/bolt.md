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
2026-04-15 — Dynamic CORS Configuration
Learning: Express cors middleware interprets origin: ['*'] as an exact string match for an asterisk, preventing wildcard functionality.
Action: Ensure * is extracted from parsed environment lists and passed directly as origin: '*' when configuring CORS.

2026-04-16 — Prevent redundant iteration in benchmark runner
Learning: The benchmark runner script `benchmarks/run.js` was duplicating iteration and performance reporting logic already present in the target exported functions (e.g., `main`), leading to redundant execution and inaccurate outer timing results.
Action: Simplified `benchmarks/run.js` to purely invoke the exported function and delegate iteration and measurement to the target script.

## 2026-04-24 — Optimize Module Mocking in Tests

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

## 2026-04-21 — Optimize API Response Serialization

Learning:
Using Express's `res.json()` adds considerable overhead when serving static JSON payloads (such as error states and health checks) due to internal formatting, type checking, and content-type resolution. Similarly, for highly dynamic endpoints, directly utilizing `JSON.stringify()` combined with `res.send()` provides significantly faster throughput.

Action:
Replaced `.json()` calls across `src/index.js` with direct `.send(Buffer)` for precomputed, immutable error and health objects to skip serialization entirely. For the dynamically generated completions response, replaced `.json()` with manual `JSON.stringify()` and explicit `res.send()`. Also optimized timestamp generation by switching from `Math.floor()` to `Math.trunc()`. These changes notably improve overall gateway throughput and latency in benchmarks.
2026-04-22 — Pre-stringified static JSON mock structures
Learning: For highly dynamic JSON API responses containing large static structures, using full-object JSON.stringify() causes significant serialization overhead. Pre-stringifying the static parts and using template literal interpolation for the dynamic fields reduces serialization overhead and improves throughput.
Action: Pre-stringify large static mock structures during module initialization and assemble the final JSON dynamically using string interpolation instead of `JSON.stringify`.

## 2026-04-24 — Abstract Content-Type and Fix 404 XSS Risk

Learning:
Setting `res.setHeader('Content-Type', 'application/json; charset=utf-8')` individually in every route handler and error path creates redundant, duplicated code and leaves room for bugs if missed. Additionally, reflecting the requested `req.path` back in the JSON body of a 404 handler without sanitization creates a potential vector for Cross-Site Scripting (XSS) if the client misinterprets the Content-Type.

Action:
Extracted the `Content-Type` header assignment into a global middleware placed before all routes but after security middleware (helmet/cors) in `src/index.js`. Optimized the 404 handler to return a frozen, precomputed Buffer `ERROR_NOT_FOUND` rather than a dynamic string, and explicitly removed `req.path` from the body to mitigate XSS vulnerabilities and improve throughput.
## 2026-04-24 — Optimize Validation Function Checks

Learning:
In highly trafficked functions such as `isValidModel`, `isValidMessagesArray`, and `isValidMessage` called repeatedly within request paths (and notably inside `for` loops validating arrays of objects), redundant object coercions (`!!`), array checks (`!Array.isArray(msg)` when testing object validity), and indirect checks (`msg.trim()` reliance for boolean logic rather than explicit string length checks) produce measurable CPU cycle and garbage collection overhead. Using explicit equality operators (e.g. `msg != null`, `!== ''`) offers a substantial speedup over indirect truthy evaluation via object coercion.

Action:
Optimized validation helper logic in `src/index.js` to strictly rely on explicit type checks and avoid double negations (`!!`). Simplified truthiness evaluations into direct equality checks (`trim() !== ''` instead of `!!trim()`).
2026-04-25 — DoS Mitigation via Route-Specific Parsing
Learning: Global `express.json()` middleware forces the application to buffer and parse request bodies even for unknown or non-existent routes, exposing a Denial of Service (DoS) vulnerability via large payloads to 404 endpoints.
Action: Apply `express.json()` strictly as route-specific middleware to the exact endpoints that require body parsing, and ensure dependent JSON error handlers are positioned correctly after those specific route definitions in the middleware chain.

## 2026-04-29 — Optimize Health Check Placement

Learning: In Express API gateways, declaring high-frequency, simple endpoints (like `/health`) below global middleware such as `helmet` and `cors` introduces significant and unnecessary CPU parsing overhead for every ping, even if the ping does not require CORS or security headers.
Action: Moved the `/health` endpoint definition above `helmet()` and `cors()` in `src/index.js`, while manually explicitly setting the `Content-Type` header. This drastically reduces CPU overhead and latency for load balancer pings while maintaining correct response headers.

## 2026-04-27 — Optimize Cache Lookups

Learning:
In highly trafficked functions like `heavyComputation` that rely on an LRU map cache, repeated calls with identical parameters incur significant overhead due to Map `delete` and `set` operations used to refresh the LRU order.

Action:
Added an L1 cache using module-scoped variables (`lastIterations` and `lastResult`) to `heavyComputation` in `src/index.js`. This avoids redundant Map lookups and mutations for consecutive identical calls, transforming a hot path from an (1)$ Map operation to a much faster strict equality check.

## 2026-04-29 — Optimize Hot Path Iteration and Destructuring

Learning:
In highly trafficked endpoints like `/v1/chat/completions`, destructuring properties directly from potentially undefined objects (e.g., `const { model, messages } = req.body || {}`) creates unnecessary object allocations for the fallback `{}` and is slower than explicitly checking for the object's existence and accessing properties directly. Additionally, using `for...of` loops incurs iterator allocation and traversal overhead compared to classic `for` loops with a cached array length, especially for large arrays like `messages`.

Action:
Replaced the object destructuring and `|| {}` fallback with direct property access after an explicit check of `req.body`. Replaced the `for...of` loop with a classic `for` loop caching the `messages.length` in a local variable `messagesLen` before the loop. This reduces garbage collection pressure and significantly improves execution speed on hot paths.

2026-04-30 — Handle Express body-parser Client Errors
Learning: In Express.js applications using `body-parser` or `express.json()`, failing to explicitly handle specific 4xx client errors (such as `charset.unsupported`, `encoding.unsupported`, and `request.aborted`) causes them to fall through to the global error handler, resulting in 500 Internal Server Error responses and log spam, presenting a minor DoS risk.
Action: Updated the global error handler in `src/index.js` to explicitly intercept these error `.type` properties and return proper 415 or 400 JSON responses.

2026-04-30 — Avoid Modifying Express Router Internals in Tests
Learning: When writing isolated unit tests using `supertest`, attempting to mutate `app._router.stack` to dynamically inject routes before global error handlers fails because `app._router` is lazily initialized and can be undefined at module load time.
Action: Test error handlers by constructing an isolated `mockApp` using `express()` that mirrors the production routing logic rather than mutating the internals of the exported `app`.

2026-04-30 — Prevent X-Powered-By Header Leak on Unprotected Endpoints
Learning: When using Express, disabling the `x-powered-by` header using `app.disable('x-powered-by')` at the application level prevents the framework from automatically setting the header. Endpoints declared above global security middlewares like `helmet()` (which normally strips this header) will inadvertently leak this header if it is not explicitly disabled globally. Disabling it also saves a small amount of CPU overhead across all requests.
Action: Add `app.disable('x-powered-by')` near application initialization in `src/index.js` to guarantee the header is never generated, protecting routes that intentionally bypass global middleware for performance reasons.

## 2026-05-02 — Optimize CORS Preflight Caching

Learning:
In Express applications handling cross-origin traffic, failing to explicitly configure the `cors` middleware with a high `maxAge` instructs browsers to not cache preflight `OPTIONS` requests, significantly increasing redundant network traffic, API latency, and backend CPU overhead.

Action:
Configured the `cors` middleware in `src/index.js` with a high `maxAge` (e.g., `maxAge: 86400`) to instruct browsers to cache preflight `OPTIONS` requests, mitigating the overhead.
