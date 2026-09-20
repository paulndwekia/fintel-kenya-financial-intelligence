# FINTEL Security Posture

This document separates controls implemented in the current repository from controls that remain deployment or product decisions.

## Implemented

**Authentication.** Manus OAuth and the existing session-cookie flow are integrated through `server/_core/sdk.ts`, `context.ts`, and the OAuth callback. Protected tRPC procedures require a current authenticated user.

**Authorization.** `server/_core/permissions.ts` defines `admin`, `analyst`, `client`, `viewer`, and legacy `user` roles. Server-side permission procedures protect portfolio writes, portfolio reads, risk execution, ingestion controls, research access, and audit access. Portfolio position writes verify that the target portfolio belongs to the authenticated user.

**Sessions.** Session validation is performed by the existing Manus SDK. The frontend does not manually handle cookies or construct session tokens.

**API security.** `server/security.ts` adds request IDs, `X-Content-Type-Options`, `X-Frame-Options`, referrer and permissions policies, and endpoint-class rate limiting. Sensitive REST routes authenticate before work. Zod schemas validate derivative, backfill, portfolio, and position inputs.

**Rate limiting.** Endpoint classes include ingestion, pricing, risk, scheduled callbacks, OAuth, and general API traffic. The current bucket store is process-local.

**Audit logging.** Portfolio creation, position creation, and authorization denials write events to `audit_logs` with actor, action, resource, result, request ID, and optional metadata.

**Secrets handling.** Runtime secrets are environment-managed. No live credentials are included in `.env.example`, the source package, or the portable archive. `.env`, local variants, logs, build output, caches, and project metadata are ignored.

**Validation and lineage.** Ingestion validates source rows, tracks rejected rows, detects duplicates, and preserves source/timestamp metadata. Financial calculations return explicit error or unavailable states rather than silently substituting mock values.

**Database security.** The application uses parameterized Drizzle queries and owner-scoped portfolio reads. The schema and migrations are versioned; database access is external to the archive.

## Planned or deployment-required

A production deployment should use a shared rate-limit store when horizontally scaled. MFA and email verification require a policy decision. Operational monitoring, alerting, log retention, restore drills, and incident response need to be configured for the chosen deployment. Database credentials must be rotated and managed by the deployment secret store. CORS should be restricted to the final approved origins rather than relying on preview defaults.

Production Heartbeat tasks must be registered only after deployment. The current sandbox has no production scheduler activation. A formal threat model, dependency scanning policy, and external penetration test are not included in this checkpoint.

## Backup boundary

The portable archive is a source/configuration backup. It contains no live database credentials and no user records. The database status is documented separately in `docs/DATABASE_BACKUP_STATUS.md`.
