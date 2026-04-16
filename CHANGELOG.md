# Changelog

All notable changes to this project will be documented in this file.

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

## [1.1.10] - 2026-04-10
### Changed
* **[Security]:** Hardened CORS configuration to default to `false` (disabled) instead of allowing all origins (`*`) unless explicitly allowed via the `ALLOWED_ORIGINS` environment variable.
