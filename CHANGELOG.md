## [1.1.30] - 2026-05-02
            ### Changed
            * **[Performance]:** Configured `cors` middleware with a high `maxAge` (86400) to instruct browsers to cache pref

            // ... 7186 characters truncated (middle section) ...

            ## [1.1.8] - 2026-04-08
            ### Changed
            * **[Performance]:** Optimized test module mock loading in `tests/test.js` by utilizing a persistent `Set` for O(1) lookup performance.