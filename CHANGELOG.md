We need to merge two versions of CHANGELOG.md. Base branch (master) and head branch (perf/api-allocations-11360933505244425714). We need to keep all meaningful changes from both. Let's examine both.

Base branch content (master) includes many entries. Let's copy it fully:

```
# Changelog

All notable changes to this project will be documented in this file.

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

## [1.1.10] - 2026-04-
... (truncated)
```

Note: The base branch truncated at [1.1.10] - 2026-04- (no day). Possibly incomplete.

Now head branch content:

```
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
```

We see head branch includes [1.1.11] entry (truncated) and [1.1.10] entry (full). Base branch had [1.1.10] truncated (no day) and didn't have [1.1.11]. Also base branch had [1.1.9] and [1.1.8] etc. Head branch also has [1.1.9] same as base. Also head branch includes [1.1.10] with Maintainability change.

We need to merge all meaningful changes from both. So final changelog should contain entries for all versions present in either branch, with the description from whichever branch (if both have same version, we need to combine if they differ). Let's list versions:

From base:
- 1.1.16
- 1.1.12
- v1.1.7
- v1.1.6
- v1.1.5
- v1.1.4
- v1.1.3
- v1.1.2
- v1.1.1
- v1.1.0
- 1.1.8
- 1.1.9
- 1.1.10 (truncated)
(Note: also maybe 1.1.?? but that's it)

From head:
- 1.1.16
- 1.1.12
- 1.1.11 (truncated)
- 1.1.10 (full)
- 1.1.9
- 1.1.8
- v1.1.7
- v1.1.6
- v1.1.5
- v1.1.4 (truncated? Actually head shows same as base but truncated after "Added server.closeIdleConnections()" maybe missing rest)
- (others same)

We need to produce a full changelog with all entries, sorted descending by version (likely as they appear). The base had ordering: 1.1.16, 1.1.12, v1.1.7, v1.1.6, v1.1.5, v1.1.4, v1.1.3, v1.1.2, v1.1.1, v1.1.0, 1.1.8, 1.1.9, 1.1.10 (truncated). That ordering is weird: after v1.1.0 they go to 1.1.8 etc. Probably they just inserted later entries out of order. But we should maintain chronological order descending by date? Usually changelog newest first. Let's examine dates:

- 1.1.16 - 2026-04-19
- 1.1.12 - 2026-04-16
- v1.1.7 - 2026-04-03
- v1.1.6 - 2026-04-03
- v1.1.5 - 2026-04-03
- v1.1.4 - 2026-04-02
- v1.1.3 - 2026-04-01
- v1.1.2 - 2026-03-31
- v1.1.1 - 2026-03-30
- v1.1.0 - 2024-06-21
- 1.1.8 - 2026-04-03
- 1.1.9 - 2026-04-09
- 1.1.10 - 2026-04-? (maybe 2026-04-09? Actually head says 1.1.10 - 2026-04-09)
- 1.1.11 - 2026-04-10 (head)
- maybe 1.1.12 already
- 1.1.16 already

Thus correct descending order by date would be:
1.1.16 (2026-04-19)
1.1.12 (2026-04-16)
1.1.11 (2026-04-10)
1.1.10 (2026-04-09)
1.1.9 (2026-04-09) (same date as 1.1.10 but maybe order doesn't matter)
1.1.8 (2026-04-03)
v1.1.7 (2026-04-03)
v1.1.6 (2026-04-03)
v1.1.5 (2026-04-03)
v1.1.4 (2026-04-02)
v1.1.3 (2026-04-01)
v1.1.2 (2026-03-31)
v1.1.1 (2026-03-30)
v1.1.0 (2024-06-21)

But note that base had v1.1.7 etc before 1.1.8 etc. Actually dates: v1.1.7 is 2026-04-03, same as 1.1.8. So ordering among same date can be arbitrary but we should keep as they appear maybe.

We need to combine entries for same version if both branches have them and they differ.

Which versions appear in both? Let's list:

- 1.1.16: identical in both.
- 1.1.12: identical.
- v1.1.7: identical.
- v1.1.6: identical.
- v1.1.5: identical.
- v1.1.4: base has full description; head truncated after "Added server.closeIdleConnections()" but likely same as base. We'll keep base full.
- v1.1.3: base only; head not shown but likely same? Not present in head snippet; we assume base version.
- v1.1.2: base only.
- v1.1.1: base only.
- v1.1.0: base only.
- 1.1.8: identical.
- 1.1.9: identical.
- 1.1.10: base truncated (no day) while head has full description with Maintainability change. So we should use head's full entry (since it's more complete). Also base had just the line "## [1.1.10] - 2026-04-" with no description; head has description. So we take head's.
- 1.1.11: only in head (truncated). We need to include it, but it's truncated; we might need to infer the full description? The head snippet shows:

```
## [1.1.11] - 2026-04-10
### Changed
* **[Lifecycle]:** Safely bu
... (truncated)
```

It's truncated after "Safely bu". We don't have the full text. We need to decide what to do. Since we cannot guess, maybe we keep the truncated line as is? But that would be invalid. Perhaps we can assume it's similar to other lifecycle bumps? But we shouldn't fabricate. The instruction: keep ALL meaningful changes from BOTH branches. If a branch has truncated content, we cannot know the meaningful change. Possibly the truncation is just due to snippet for display; the actual file would have full content. Since we don't have it, we might need to include the entry as it appears in head (including the truncated line) but that would be incomplete. However maybe we can approximate by looking at pattern: previous lifecycle entries are like "Safely bumped X dependency". For 1.1.11, likely "Safely bumped ...". The truncation "Safely bu" maybe "Safely bumped". Could be "Safely bumped something". But we cannot be sure.

Given the task, we likely should include the entry as it appears in head, but we need to output a valid changelog. Perhaps we can complete it based on typical pattern: "Safely bumped ...". But we risk being wrong.

Alternatively, we could omit 1.1.11 because it's truncated and we cannot guarantee correctness. But the instruction says keep ALL meaningful changes from both branches. If we omit, we lose a change. However we cannot know what it is.

Maybe we can infer from the base branch: base didn't have 1.1.11 at all, meaning head added it. So we need to include whatever head had. Since we only have truncated, we might need to assume the rest is similar to other lifecycle entries: maybe "Safely bumped ...". Let's look at head's other lifecycle entries:

- 1.1.8: Dependencies: Safely bumped patch version of `dotenv` dependency and verified survival.
- v1.1.7: Safely bumped `minimatch` and `path-to-regexp` minor/patch versions.
- v1.1.5: Safely bumped `dotenv` dependency to version `17.4.0`.
- 1.1.11: likely also a dependency bump.

Given the pattern, maybe it's "Safely bumped ...". But we cannot know what.

Given the ambiguity, perhaps we should output the entry as we have it, but complete the line with a placeholder? That would be wrong.

Better approach: Since the truncation is likely due to the snippet for the prompt, we can assume the full entry is present in the actual file, and we can reconstruct it by looking at the base branch for similar entries? But base doesn't have 1.1.11.

Maybe we can search memory: I recall seeing a changelog for some project where 1.1.11 was "Safely bumped something". Not sure.

Given the instruction to output only merged file content, we need to produce something plausible. I think we should include the entry as it appears in head but we need to complete it. Perhaps we can look at the head snippet: after "[Lifecycle]:" it says "Safely bu". Likely "Safely bumped". Then maybe "some dependency". Could be "Safely bumped ...". Since we cannot know, maybe we can leave it as "Safely bumped ..."? But that's not accurate.

Alternatively, we could drop the asterisk line and just keep the header? That would be weird.

Given the difficulty, maybe we assume that the truncation is just an artifact and the actual entry is same as other lifecycle entries: "Safely bumped ...". But we need to be safe.

Let's examine the head snippet more: It shows:

```
## [1.1.11]