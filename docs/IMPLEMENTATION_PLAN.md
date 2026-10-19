# Implementation Plan — WhatsApp Review Request SaaS

## Baseline Inspection

| Item | Finding |
|------|---------|
| Repo | Empty monorepo (`README.md` only, commit `79959f7`) |
| Branch | Started from `main`; work on `cursor/review-request-saas-c209` |
| Pre-existing failures | None (no code/tests yet) |
| Stack | Greenfield — select React+TS+Vite+Tailwind / Node+Express+TS / MongoDB+Mongoose |

## Architecture Decisions

1. **Monorepo** (`apps/server`, `apps/client`, `packages/shared`) with npm workspaces.
2. **Multi-tenant**: every authenticated request binds `businessId` from the session user; never from client body/query for authorization.
3. **WhatsApp**: `IWhatsAppProvider` with `MetaCloudApiProvider` + `SimulatorProvider`; production cannot use simulator sends.
4. **Jobs**: MongoDB-backed outbox (`Job` collection) + durable worker poller (not in-memory queues).
5. **Auth**: express-session + connect-mongo; CSRF double-submit; bcrypt passwords; hashed reset/verify/landing tokens.
6. **Validation**: Zod (single runtime schema lib) on all inputs.
7. **Billing**: domain model + `TestBillingAdapter` (clearly marked); live Stripe steps documented.
8. **Drafts**: deterministic template fallback; optional OpenAI if `OPENAI_API_KEY` set.

## Phases

1. Scaffold + config + shared types
2. DB models, migrations/indexes, env validation
3. Auth, CSRF, rate limits, security middleware
4. Business onboarding, WhatsApp connection, Google URL validation
5. Customers CRUD + CSV import
6. Review request lifecycle + outbox worker + status machine
7. Webhooks (verify, signature, idempotency) + reply parsing
8. Landing page tokens + draft generation + analytics events
9. Billing domain + usage enforcement
10. Frontend UI (auth → analytics → landing)
11. Unit / integration / security / Playwright / load tests
12. CI, Docker, docs, FINAL_REPORT

## Acceptance Criteria (must be demonstrably true)

- [ ] `npm run verify` passes: format, lint, typecheck, unit, integration, build
- [ ] Playwright E2E covers register→send→reply→draft→analytics + tenant isolation
- [ ] Security suite: IDOR, CSRF, rate limit, webhook sig, token guessing, CSV injection
- [ ] Simulator demos full workflow; cannot send live messages in test mode
- [ ] Tenant A cannot access tenant B resources (automated tests)
- [ ] No plaintext passwords/tokens in DB; secrets redacted from logs
- [ ] Durable jobs survive process restart without duplicate sends
- [ ] Docs cover setup, Meta, deploy, limitations; FINAL_REPORT with honest status labels

## External Dependencies (credentials / approvals)

| Dependency | Required for | Pilot default |
|------------|--------------|---------------|
| MongoDB | Persistence | Local / memory-server in tests |
| Meta WhatsApp Cloud API (App ID, App Secret, WA token, Phone Number ID, WABA ID, webhook verify token) | Live messaging | Simulator + manual pilot docs |
| Meta Embedded Signup (config_id, etc.) | Self-serve connect | Documented; manual pilot first |
| Approved message templates | Outbound review requests | Simulator templates |
| HTTPS public URL | Webhooks | Documented for staging/prod |
| SMTP / email provider | Verify + password reset | Ethereal/console adapter in dev |
| OpenAI (optional) | LLM drafts | Deterministic fallback |
| Stripe (optional) | Live billing | TestBillingAdapter |
| Redis (optional) | Not required; sessions in Mongo |

## Human / External Approval Items

1. Meta Business verification & WhatsApp Business Account creation
2. Template approval for review-request messages
3. Webhook callback URL on a public HTTPS endpoint
4. Test phone numbers authorized in Meta developer console
5. Privacy policy / terms for merchant + customer data
6. Production secrets rotation process owner
7. Live billing (Stripe) account + webhook signing secret
8. Domain + TLS certificates for production
