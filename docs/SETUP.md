# Local setup

## Prerequisites

- Node.js 20+
- MongoDB 7+ (local or Docker)
- npm 10+

## Steps

1. `cp .env.example .env` and set secrets (≥32 chars for `SESSION_SECRET` and `CREDENTIAL_ENCRYPTION_KEY`).
2. `docker compose up -d mongo` (or point `MONGODB_URI` at your instance).
3. `npm install`
4. `npm run build --workspace=@wrs/shared`
5. `npm run migrate` (syncs indexes — non-destructive)
6. `npm run dev:server` and `npm run dev:client`

## Environment variables

See `.env.example`. Critical:

| Variable | Purpose |
|----------|---------|
| `MONGODB_URI` | Persistence |
| `SESSION_SECRET` | Session signing |
| `CREDENTIAL_ENCRYPTION_KEY` | Encrypt WhatsApp tokens |
| `WHATSAPP_MODE` | `simulator` \| `meta` |
| `META_*` | Live Meta app credentials |
| `BILLING_MODE` | `test` \| `stripe` |
| `OPENAI_API_KEY` | Optional LLM drafts |

## Simulator workflow (no Meta)

1. Register → onboard business (auto-connects simulator)
2. Add customer with consent
3. Preview & confirm review request
4. Use simulator controls: deliver / fail / inbound rating
5. Open landing link (reveal via Settings/API in simulator)
6. Copy draft / Open Google / private feedback
7. Check Analytics

## Missing credentials UX

- Disconnected WhatsApp → setup hints + request preview issues
- Invalid/unreachable Google URL → validation status + re-validate action
- Missing templates (live) → connection `lastError` after health check
- Incomplete onboarding → `complete-onboarding` returns hint list
