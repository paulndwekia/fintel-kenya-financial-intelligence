# FINTEL AI Security Model

- Research procedures require authentication.
- Session reads, writes and deletes are owner-scoped.
- Portfolio data is not implicitly exposed to research.
- Provider credentials remain server-side.
- AI output is not permitted to execute arbitrary SQL or filesystem operations.
- Research executions are written to the existing audit log.
