# Changelog

All notable changes to this project will be documented in this file.

## [v1.1.0] - 2024-06-21
### Added
* **[Performance]:** Added response compression middleware (gzip/deflate) to reduce bandwidth and latency.

### Fixed
* **[QA]:** Added `compression` mock to `tests/test.js` to ensure the module loads properly in restricted environments.
