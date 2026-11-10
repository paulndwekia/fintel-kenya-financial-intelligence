# FINTEL Security Posture

This document separates controls implemented in the current application from protections that still require deployment configuration, operational work or independent review.

## Implemented in the application

**Authentication and sessions.** The existing OAuth and session flow is integrated through the server SDK. Session cookies are HttpOnly, host/path scoped, use SameSite=Lax, and are marked Secure when the request is HTTPS.

**Authorisation.** Server-side role checks protect portfolio, risk, research, ingestion and audit operations. Portfolio records and research sessions are scoped to their authorised owner. Portfolio position writes verify ownership before persistence.

**OAuth request protection.** The OAuth flow uses the host-only `__Host-oauth_state` cookie to bind the sign-in callback to the browser that started the flow.

**API protection.** The security middleware adds request IDs, content-type, frame, referrer and permissions headers. Production responses also receive HSTS. Request inputs use Zod validation where applicable. Selected endpoint groups have rate limits.

**Data access and audit.** Database access uses the existing data layer and parameterised Drizzle queries. Portfolio creation, position creation, research runs and permission denials are recorded in the audit log where implemented. AI research receives selected, typed context and cannot execute arbitrary SQL or filesystem operations.

**Secrets and provenance.** Provider and database credentials are expected in server-side environment variables. Source records retain observation and retrieval metadata where available. Missing or stale data is not silently replaced with invented values.

## Deployment and operational work still required

The current rate-limit counters are held in process memory, so they are not shared across instances or restarts. A shared store is needed before horizontal scaling.

Production monitoring, alerting, centralised log retention, scheduled backup verification and restore drills must be configured and exercised. MFA and email-verification policy, dependency scanning and an independent penetration test remain open security work.

The application is hosted on a public Render service. The repository's service configuration does not itself prove that every required secret, scheduled workflow or database backup is configured correctly. Those settings need to be checked in their respective dashboards.

## Cookie and privacy boundary

The session cookie is HttpOnly and is not readable by frontend scripts. The separate `fintel_consent` preference cookie stores only the categories selected in the cookie panel and the time of that choice. Optional analytics and personalisation are not enabled by the current release.

## Responsible disclosure

Do not publish credentials, session tokens, private portfolio records or exploit details in public issues. Report security concerns through the repository's private contact route where available.

No website can honestly promise to be impossible to hack. These controls reduce risk; they do not replace ongoing maintenance, monitoring and independent security review.
