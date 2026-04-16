Always execute a cleanup command (e.g., `rm -f test-*.js`) to remove any scratchpad files created during exploration before concluding the run and finalizing the commit.
## 2026-04-09 — Abstract multi-clause conditionals to helper functions

Learning:
Multi-clause logic conditionals inside API route handlers decrease readability and make unit testing logic boundaries difficult.

Action:
Extracted complex boolean conditionals used to validate the `model` and `messages` arrays in `/v1/chat/completions` into standalone `isValidModel` and `isValidMessagesArray` helper functions, and exported them to `tests/api.test.js` to individually verify input boundaries.

## 2026-04-15 — Restrict CORS Origins

Learning:
The default CORS configuration allows requests from any origin (`*`), which is unsafe if the API is exposed to browsers and not intended for public cross-origin access. Without environment-specific restriction capability, the application cannot securely integrate with internal web applications.

Action:
Replaced the wildcard `app.use(cors())` configuration in `src/index.js` with a dynamic configuration that reads allowed origins from the `ALLOWED_ORIGINS` environment variable. It parses the variable as a comma-separated list. If left unset or if it contains `*`, it gracefully falls back to wildcard behavior for backward compatibility.
