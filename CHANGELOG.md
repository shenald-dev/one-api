## [1.1.29] - 2026-05-01
### Changed
* **[Security & Performance]:** Fixed an issue where high-frequency endpoints bypassing global middlewares leaked the `X-Powered-By` framework identifier. Globally disabled the header during application initialization, successfully mitigating the leak and saving CPU overhead across all requests. Zero dead code was pruned.

## [1.1.28] - 2026-04-30
### Changed
* **[Reliability & Security]:** Gracefully handle Express body-parser 4xx client errors (`charset.unsupported`, `encoding.unsupported`, `request.aborted`) by returning explicit 415 or 400 JSON responses instead of falling through to the generic 500 error handler. Precomputed standard JSON responses to optimize error paths. Zero dead code pruned.

## [1.1.27] - 2026-04-29
### Changed
- Optimized `/v1/chat/completions` parsing and validation loops.

## [1.1.26] - 2026-04-28
### Changed
* **[Reliability]:** Fixed an issue in `heavyComputation` where the L1 cache was incorrectly returning false cache hits when `undefined` was passed as a parameter. The cache is now properly initialized with a unique `Symbol`. Zero dead code pruned.

## v1.1.25 - 2026-04-27
### Changed
- **Performance:** Moved the `/health` endpoint above `helmet()` and `cors()` middlewares, saving significant CPU cycle overhead on load balancer pings by skipping unnecessary security header injections and CORS processing for this specific endpoint. No dead code pruned.

## v1.1.24 - 2026-04-25
### Changed
- **Security/Performance:** Modified the `express.json()` middleware to act as a route-specific middleware on `/v1/chat/completions` rather than globally. This prevents unnecessary JSON parsing for non-existent endpoints (like 404 routes), mitigating potential CPU exhaustion DoS vectors from large arbitrary payloads.


## [1.1.23] - 2026-04-24
### Performance
- Optimized validation functions (`isValidModel`, `isValidMessagesArray`, `isValidMessage`) to use faster, explicit type and equality checks instead of object coercions. This improves throughput during payload validation loops.

## [1.1.22] - 2026-04-24
### Changed
* **[Performance & Security]:** Extracted duplicate Content-Type header assignments into a single global middleware, reducing repeated calls. Mitigated potential XSS risk in 404 handler by removing reflected `req.path` and optimized it by replacing dynamic serialization with a precomputed, static Buffer.

## [1.1.21] - 2026-04-22
### Changed
* **[Performance]:** Pre-stringified static JSON mock structures to reduce serialization overhead during API responses. Zero dead code pruned.
## [1.1.20] - 2026-04-22
### Changed
* **[Performance]:** Verified BOLT's optimization extracting static error and health response objects into frozen module-level constants. Zero dead code pruned.

## [1.1.19] - 2026-04-21
### Changed
* **[Performance]:** Extracted static error responses into frozen module-level constants to prevent redundant memory allocations and garbage collection pressure across API routes. Zero dead code pruned.


## [1.1.18] - 2026-04-20
### Changed
* **[Performance]:** Extracted static error and health response objects into frozen module-level constants to prevent redundant memory allocations and garbage collection pressure across API routes.

## [1.1.17] - 2026-04-20
### Changed
* **[Performance]:** Extracted static mock response objects (`MOCK_CHOICES` and `MOCK_USAGE`) into frozen module-level constants to avoid redundant memory allocations and garbage collection pressure on every `/v1/chat/completions` request. Zero dead code was pruned.

## [1.1.16] - 2026-04-19
### Changed
* **[Performance]:** Moved the `/health` endpoint above heavy global middlewares (`express.json()` and `compression()`) to avoid redundant parsing overhead, reducing CPU usage and latency for simple health checks. Zero dead code was pruned.

## [1.1.12] - 2026-04-16
### Changed
* **[Developer Experience]:** Fixed `benchmarks/run.js` to delegate iteration and reporting to the target benchmark functions, avoiding redundant execution and inaccurate timing results.

## [v1.1.7] - 2026-04-03
### Changed
* **[Lifecycle]:** Safely bumped `minimatch` and `path-to-regexp` minor/patch versions. Verified baseline tests pass. Zero dead code was pruned as the codebase remains highly optimized following previous improvements.

## [v1.1.6] - 2026-04-03
### Changed
* **[Performance]:** Disabled Express ETag generation globally to save CPU cycles and reduce latency, as generating MD5 hashes for purely dynamic LLM JSON API responses is unnecessary overhead. Zero unused files pruned.

## [v1.1.5] - 2026-04-03
### Changed
* **[Lifecycle]:** Safely bumped `dotenv` dependency to version `17.4.0`. No dead code was pruned as the codebase remains highly optimized following previous improvements.

## [v1.1.4] - 2026-04-02
### Changed
* **[Reliability]:** Added `server.closeIdleConnections()` and `server.closeAllConnections()` to the Express server shutdown sequence to speed up process termination by explicitly severing inactive keep-alive connections rather than waiting for them to naturally time out. No dead code pruned.

## [v1.1.3] - 2026-04-01
### Changed
* **[Performance]:** Replaced traditional `for` loop with a `for...of` loop in the `/v1/chat/completions` API payload validation to improve V8 execution speed and code readability.

## [v1.1.2] - 2026-03-31
### Changed
* **[Lifecycle]:** Verified JULES/BOLT's optimization replacing `.has()` and `.get()` with a single `.get()` in `heavyComputation`. No dead code found to prune. Bumped patch version for release.

## [v1.1.1] - 2026-03-30
### Changed
* **[Performance]:** Optimized cache Map lookups in `heavyComputation` by combining `.has()` and `.get()` into a single `.get()` call with an `undefined` check, reducing hash lookup overhead.


## [v1.1.0] - 2024-06-21
### Added
* **[Performance]:** Added response compression middleware (gzip/deflate) to reduce bandwidth and latency.

### Fixed
* **[QA]:** Added `compression` mock to `tests/test.js` to ensure the module loads properly in restricted environments.

## [1.1.8] - 2026-04-03
* **Dependencies:** Safely bumped patch version of `dotenv` dependency and verified survival. No regressions found, zero dead code pruned.

## [1.1.9] - 2026-04-09
### Changed
* **[Reliability]:** Safely skip generic error handlers if response headers are already sent, preventing `ERR_HTTP_HEADERS_SENT` application crashes. Zero dead code was pruned.

## [1.1.10] - 2026-04-09
### Changed
* **[Maintainability]:** Extracted complex boolean conditionals used to validate the API payloads into standalone helper functions, improving readability and testability. Zero dead code was pruned.

## [1.1.11] - 2026-04-10
### Changed
* **[Lifecycle]:** Safely bumped patch version of `dotenv` dependency and verified survival. No regressions found, zero dead code pruned.

## [1.1.14] - 2026-04-17
### Changed
* **[Lifecycle]:** Pruned unused `performance` import in `benchmarks/run.js` following the iteration execution delegation optimization.

## [1.1.15] - 2026-04-18
### Changed
* **[Performance]:** Optimized test module mock loading in `tests/test.js` by utilizing a persistent `Set` for O(1) lookup performance.
