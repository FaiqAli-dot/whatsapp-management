# Review request / message status rules

Statuses: `CREATED → QUEUED → SENDING → SENT → DELIVERED → READ` with terminals `FAILED`, `CANCELLED`.

## Permitted transitions

| From | To |
|------|-----|
| CREATED | QUEUED, CANCELLED |
| QUEUED | SENDING, CANCELLED, FAILED |
| SENDING | SENT, FAILED |
| SENT | DELIVERED, READ, FAILED |
| DELIVERED | READ, FAILED* |
| READ | (terminal) |
| FAILED / CANCELLED | (terminal) |

\* Late `FAILED` after `DELIVERED`/`READ` is **not** applied automatically — reconcile first (ambiguous provider failures).

## Semantics

- Provider API acceptance (`SENT`) **≠** delivery (`DELIVERED`)
- Duplicate / out-of-order webhooks: apply only if `shouldApplyStatusUpdate` allows; analytics use `dedupeKey`
- Opt-out → future sends blocked; in-flight may `CANCELLED`
- Disconnected WhatsApp → send job fails with actionable `failureReason`
- Worker restart: jobs remain `pending`/`processing` with lock expiry; claim is atomic

## Lifecycle edge cases

- Duplicate request window: 7 days per customer (configurable constant)
- Multiple active requests: inbound associates to most recent active
- Late/ambiguous replies: clarification prompt once per request
- No blind infinite retries: exponential backoff then `dead`
