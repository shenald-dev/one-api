## 2024-05-18 — Process Reliability: Exiting on Uncaught Exceptions

Learning:
Swallowing `uncaughtException` and `unhandledRejection` leaves the Node.js process in an undefined and potentially corrupted state, which is a significant reliability and security flaw, especially for a continuously running API gateway.

Action:
Fixed the global error handlers in `src/index.js` to call `process.exit(1)`, ensuring the process terminates safely and allows a process manager to restart it cleanly. Always ensure future Node.js applications follow this pattern rather than swallowing exceptions.