# Changelog

All notable changes to this project will be documented in this file.

## [1.1.16] - 2026-04-19
### Changed
* **[Performance]:** Moved the `/health` endpoint above heavy global middlewares (`express.json()` and `compression()`) to avoid redundant parsing overhead, reducing CPU usage and latency for simple health checks. Zero dead code was pruned.

## [1.1.12] - 2026-04-16
### Changed
* **[Developer Experience]:** Fixed `benchmarks/run.js` to delegate iteration and reporting to the target benchmark functions, avoiding redundant execution and inaccurate timing results.

## [1.1.11] - 2026-04-10
### Changed
* **[Lifecycle]:** Safely bu
... (truncated)

## [1.1.10] - 2026-04-09
### Changed
* **[Maintainability]:** Extracted complex boolean conditionals used to validate the API payloads into standalone helper functions, improving readability and testability. Zero dead code was pruned.

## [1.1.9] - 2026-04-09
### Changed
* **[Reliability]:** Safely skip generic error handlers if response headers are already sent, preventing `ERR_HTTP_HEADERS_SENT` application crashes. Zero dead code was pruned.

## [1.1.8] - 2026-04-03
* **Dependencies:** Safely bumped patch version of `dotenv` dependency and verified survival. No regressions found, zero dead code pruned.

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
* **[Reliability]:** Added `server.closeIdleConnections()` and `server.closeAllConnections()`