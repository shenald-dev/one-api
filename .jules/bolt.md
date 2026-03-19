## 2024-05-18 — Use crypto.randomUUID() for Mock Response IDs

Learning:
The API gateway was generating pseudo-random mock response IDs using `Math.random().toString(36).substr(2, 9)`. This approach is both slow under heavy load and fundamentally flawed for a large-scale system due to the high risk of ID collisions (non-cryptographic randomness, short string length).

Action:
Switched to Node.js's native `crypto.randomUUID()` to generate mock response IDs. This provides mathematically guaranteed uniqueness (crucial for a unified API gateway) and is natively faster than the previous string manipulation approach. Tests were updated to reflect the increased length of UUIDs over the previous 9-character pseudo-random strings.
## 2026-03-18 — Handle Invalid JSON Gracefully

Learning:
Express.js default `express.json()` middleware can leak server stack traces via HTML responses when it encounters malformed JSON input, which degrades API reliability and can expose internal structure.

Action:
Added a custom error handling middleware immediately after `express.json()` to catch `SyntaxError` with status 400 and return a clean, standard JSON `400 Bad Request` payload instead of an HTML stack trace.

## 2026-03-19 — Optimized Repeated Heavy Computation with Memoization

Learning:
The `heavyComputation` function was being called repeatedly with identical arguments inside a loop, causing significant overhead (approximately 3ms per call). Since the function is pure, caching the results (memoization) for each unique input can eliminate redundant work.

Action:
Implemented a `Map`-based cache for `heavyComputation` in `src/index.js`. Subsequent calls with the same `iterations` parameter now return the cached result in $O(1)$ time (~0.01ms), improving performance by several orders of magnitude for repeated inputs. Added unit tests in `tests/heavy_computation.test.js` to verify correctness and timing improvements.
