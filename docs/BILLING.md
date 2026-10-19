# Billing

## Current mode: test adapter

`BILLING_MODE=test` (default) uses `TestBillingAdapter`:

- Plan catalog from `@wrs/shared` `PLANS` (free / starter / growth)
- Usage counters on `Business.usageRequestsThisPeriod`
- Change-plan / cancel endpoints clearly return `testMode: true`
- **Redirect ≠ payment proof** — there is no live checkout

## Enforcement

- Monthly request limit per plan (`assertWithinRequestLimit`)
- Customer count limit on create/import
- Grace / cancelled statuses modeled on `subscriptionStatus`

## Remaining steps for live Stripe

1. Set `BILLING_MODE=stripe`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
2. Implement Checkout Session creation + Customer portal
3. Verify Stripe webhooks with signing secret (endpoint currently returns 501 until configured)
4. Map price IDs → `planId`; update usage period on invoice.paid
5. Never treat a browser redirect alone as paid

## Idempotency

Billing webhooks store `WebhookEvent` with unique `eventId` before applying side effects.
