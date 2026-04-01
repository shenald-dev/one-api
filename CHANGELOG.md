# Changelog

All notable changes to this project will be documented in this file.

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
