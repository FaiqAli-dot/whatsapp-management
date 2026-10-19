# Architecture

## Modules

```
apps/client     Merchant UI + customer landing (/r/:token)
apps/server     REST API v1, webhooks, worker, simulator
packages/shared Zod schemas, phone/rating/draft/status helpers
```

## Boundaries

- **Tenant scope:** `req.businessId` comes only from the authenticated session user. Client-supplied tenant IDs are never trusted for authorization.
- **WhatsApp:** `IWhatsAppProvider` — `SimulatorProvider` vs `MetaCloudApiProvider`. Test/`NODE_ENV=test` always uses simulator (cannot send live).
- **Jobs:** `Job` collection outbox; `runWorkerOnce` claims with lock. Survives restarts; idempotent send.
- **Webhooks:** Persist `WebhookEvent` by `(provider, eventId)` before processing; duplicates no-op.
- **Analytics:** Append-only `AnalyticsEvent` with unique `dedupeKey`.
- **Credentials:** WhatsApp access tokens AES-GCM encrypted; landing/reset/verify tokens stored hashed.
- **Billing:** Domain limits on `Business`; `TestBillingAdapter` when `BILLING_MODE=test`.

## API surface (`/api/v1`)

Auth, business, customers (+ CSV), review-requests, whatsapp, analytics, billing, account, simulator, landing `/r/:token`, webhooks.

## Health

- `GET /health` — liveness
- `GET /ready` — Mongo ready + pending job count
