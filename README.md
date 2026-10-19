# ReviewRelay — WhatsApp Google Review Requests (Multi-tenant SaaS)

Merchants (salons, clinics, restaurants, auto shops) send Google review requests via **their own WhatsApp Business accounts** using the **official Meta Cloud API** only. No unofficial WhatsApp APIs, scraping, or app automation.

## Stack

- **Client:** React + TypeScript + Vite + Tailwind
- **Server:** Node + Express + TypeScript + MongoDB/Mongoose
- **Auth:** Secure sessions (Mongo store in non-test), CSRF, rate limits
- **Jobs:** Durable MongoDB outbox/worker (not in-memory)
- **WhatsApp:** Provider abstraction — `simulator` (default) + `meta`
- **Tests:** Vitest unit/integration/security + Playwright E2E

## Quick start (local)

```bash
cp .env.example .env
npm install
# MongoDB required for `npm run dev` (or use Docker Compose mongo service)
docker compose up -d mongo
npm run build --workspace=@wrs/shared
npm run dev:server   # :4000
npm run dev:client   # :5173
```

Default WhatsApp mode is **simulator** — full workflow without Meta credentials.

## Main verification command

```bash
npm run verify
```

Runs format check, lint/typecheck, unit, integration, security, and production build.

Full suite including Playwright:

```bash
npm run verify:full
```

Slow / external:

```bash
npm run test:e2e
npm run test:load          # requires a running isolated API
npm run test:meta-manual   # prints MANUAL VERIFICATION REQUIRED
```

## Documentation

| Doc | Contents |
|-----|----------|
| [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) | Plan, acceptance criteria, external deps |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Modules & boundaries |
| [docs/SETUP.md](docs/SETUP.md) | Local setup & env vars |
| [docs/TESTING.md](docs/TESTING.md) | All test commands |
| [docs/META_LIVE_TEST.md](docs/META_LIVE_TEST.md) | Manual Meta Cloud API procedure |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Deploy, rollback, backups |
| [docs/SECURITY.md](docs/SECURITY.md) | Security & privacy |
| [docs/STATE_MACHINE.md](docs/STATE_MACHINE.md) | Message status rules |
| [docs/BILLING.md](docs/BILLING.md) | Test billing + live Stripe steps |
| [docs/FINAL_REPORT.md](docs/FINAL_REPORT.md) | Verification report with status labels |

## License

Proprietary — all rights reserved.
