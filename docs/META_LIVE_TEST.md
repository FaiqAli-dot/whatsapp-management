# Live Meta WhatsApp Cloud API test

**Status: MANUAL VERIFICATION REQUIRED**

This procedure is **separate from the default automated suite**. Do **not** message real customers. Use only Meta-authorized test recipients.

## Prerequisites (human / external approvals)

1. Meta Developer App with WhatsApp product
2. WhatsApp Business Account (WABA) + phone number
3. Permanent or long-lived access token (or Embedded Signup token exchange — see below)
4. Approved message template (e.g. `review_request`) in the business language
5. Public **HTTPS** webhook URL reachable by Meta
6. `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`, `WHATSAPP_MODE=meta`
7. Test recipient phone added in Meta “API Setup” / allowed list

## Procedure

1. Set env: `WHATSAPP_MODE=meta`, fill `META_APP_ID`, `META_APP_SECRET`, verify token.
2. Deploy/tunnel API so `GET/POST /api/v1/webhooks/whatsapp` is public HTTPS.
3. In Meta App → WhatsApp → Configuration: set callback URL + verify token; subscribe to `messages`.
4. In ReviewRelay: Settings → Manual pilot onboarding — enter Phone Number ID, WABA ID, access token, template name/language.
5. Confirm connection health (Settings / `POST /api/v1/whatsapp/health`).
6. Add a consenting **test** customer with the authorized test phone (E.164).
7. Preview & confirm a review request; confirm status moves to `SENT` and `providerMessageId` stored.
8. Confirm delivery/read webhooks update status exactly once (re-deliver webhook → no duplicate analytics).
9. Reply from the test phone with `5 - Great service!`; confirm rating, draft, landing link inbound handling.
10. Open landing page; copy draft; click Open Google Reviews; confirm analytics increments (click ≠ published review).
11. Disconnect WhatsApp; confirm preview blocks sends with actionable error; reconnect.

## Embedded Signup

If `META_EMBEDDED_SIGNUP_CONFIG_ID` is set, the UI exposes that config is available. Full self-serve Embedded Signup requires Meta App Review, Facebook Login for Business, and frontend FB SDK integration. **Pilot path is manual credential entry** until those approvals exist. Do not fake self-service completion.

## Record missing permissions

Document any Graph API errors (`code`, `message`) from Meta — typically missing `whatsapp_business_messaging`, template not approved, or token scopes.

## Outcome label

After completing the checklist by hand, record results in `docs/FINAL_REPORT.md` as **MANUAL VERIFICATION REQUIRED** until a human signs off — automated CI must never claim this passed.
