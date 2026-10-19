# Testing

## Main local verification

```bash
npm run verify
```

## Suites

| Suite | Command | Notes |
|-------|---------|-------|
| Shared unit | `npm run test:unit --workspace=@wrs/shared` | Rating parse, phone, status, drafts |
| Server unit | `npm run test:unit --workspace=@wrs/server` | Crypto, CSV |
| Integration | `npm run test:integration` | mongodb-memory-server, API+DB |
| Security | `npm run test:security` | CSRF, IDOR, rate limit, CSV injection |
| Build/typecheck | `npm run build && npm run typecheck` | |
| Playwright | `npm run test:e2e` | Real app + memory Mongo via `scripts/e2e-api.mjs` |
| Load | `npm run test:load` | Requires isolated API up; writes `load-test-results.json` |
| Meta live | `npm run test:meta-manual` | **MANUAL VERIFICATION REQUIRED** |

## Playwright setup

```bash
cd apps/client
npx playwright install --with-deps chromium
npm run test:e2e
```

## Rules

- Never delete production data in tests (disposable memory Mongo / dedicated DB).
- Never weaken assertions or authz to pass.
- Simulator events always marked `simulated: true`.
- Live Meta sends are forbidden when `NODE_ENV=test`.
