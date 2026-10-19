# Deployment

## Production build

```bash
npm ci
npm run build
NODE_ENV=production node apps/server/dist/index.js
# optional dedicated worker:
node apps/server/dist/worker.js
```

Or: `docker compose up -d --build` with a filled `.env`.

## Env validation

`loadEnv()` rejects production starts with `dev-only` secrets or `WHATSAPP_MODE=meta` without `META_APP_SECRET`.

## HTTPS / domain

Terminate TLS at a reverse proxy (Caddy/nginx/ALB). Set `TRUST_PROXY=true`, `COOKIE_SECURE=true`, `APP_URL`/`CLIENT_URL` to `https://…`, and CORS origins accordingly. Point Meta webhooks at `https://<api>/api/v1/webhooks/whatsapp`.

## Health

- Liveness: `/health`
- Readiness: `/ready`

## Migrations / indexes

`npm run migrate` runs `syncIndexes` only — **no automatic destructive migrations**.

## Secrets rotation

1. Issue new `SESSION_SECRET` / `CREDENTIAL_ENCRYPTION_KEY` / Meta token.
2. Re-encrypt or re-enter WhatsApp tokens after key rotation (old ciphertext won’t decrypt).
3. Restart API + worker; invalidate sessions if session secret changed.

## Backup / restore

**Not claimed as configured or restore-tested in this repo.** Suggested ops:

- MongoDB continuous backups / snapshots of the `mongo_data` volume
- Restore to a staging URI and run `/ready` + smoke login
- Never restore over production without a rollback snapshot

## Deploy & rollback

1. Build immutable image tagged with git SHA
2. Deploy API then worker
3. Smoke: `/health`, `/ready`, login, simulator or Meta health
4. Rollback: redeploy previous image tag; jobs remain in Mongo

## Monitoring

- Structured JSON logs (pino) with secret redaction
- Job counts via `/ready` `pendingJobs`
- Hook your APM to process stderr/stdout; no debug stack traces in production responses

## Incident response (short)

1. Disable sends: set WhatsApp connections to disconnected or `WHATSAPP_MODE=simulator` (staging only)
2. Rotate compromised tokens
3. Inspect `AuditEvent`, `WebhookEvent`, `Job` for blast radius
4. Communicate retention/deletion per `docs/SECURITY.md`
