# Security & privacy

## Multi-tenant

Every customer, request, message, feedback, analytics, WhatsApp connection, and billing usage query is scoped by session `businessId`. Integration tests prove Business A cannot read/modify Business B.

## Auth

- bcrypt password hashing (cost 12)
- HttpOnly session cookie `wrs.sid`, SameSite=Lax, Secure in production
- CSRF double-submit (`csrf-csrf`) on cookie-authenticated mutations
- Login & password-reset rate limits
- Email verification + hashed reset tokens with expiry
- Account deletion purges credentials and tenant data (see policy below)

## Input & abuse

- Zod validation on inputs
- Helmet security headers
- CORS allowlist
- Mongoose `sanitizeFilter` against operator injection
- CSV size/row limits + formula-injection sanitization on export
- Webhook signature verification when `WHATSAPP_MODE=meta`
- Oversized webhook body rejection (1MB)

## Secrets

- WhatsApp tokens encrypted at rest (AES-256-GCM)
- Landing / verify / reset tokens stored as SHA-256 hashes only
- Logger redacts password/token/cookie/authorization paths
- Never log full sensitive payloads

## Retention & deletion policy

On `DELETE /api/v1/account` with `{ confirm: "DELETE" }`:

- Hard-delete WhatsApp credentials, jobs, messages, feedback, analytics events, review requests, customers
- Soft-anonymize business + user (email rewritten, password invalidated)

Landing tokens expire (default 30 days) and can be revoked.

## Dependency audit

Run `npm run audit:deps`. Triage high/critical; do not blind-upgrade. Known toolchain advisories (vitest/vite/tailwind transitive) are tracked in FINAL_REPORT — prefer pinned upgrades after regression tests.

## Known limitations

- Embedded Signup UI is config-gated, not a fake self-serve Meta flow
- Live Stripe billing requires separate credentials (test adapter only by default)
- Google URL validation checks reachability/format — not Places API ownership proof
