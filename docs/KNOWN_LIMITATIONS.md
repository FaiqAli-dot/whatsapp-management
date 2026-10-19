# Known limitations

1. **Meta live messaging** requires human setup — not covered by default CI.
2. **Embedded Signup** is documented/config-gated; pilot uses manual Phone Number ID / WABA / token entry.
3. **Billing** defaults to test adapter; Stripe live needs credentials + webhook verification implementation completion.
4. **Google URL validation** checks format + reachability; does not prove Place ownership via Places API.
5. **Drafts** never auto-publish to Google; click ≠ published review.
6. **Email** uses console logging unless SMTP configured.
7. **LLM drafts** require `OPENAI_API_KEY`; otherwise deterministic templates.
8. **Backups/restores** are documented but not executed/verified in this repository.
9. Production must set strong secrets; `dev-only` defaults are rejected when `NODE_ENV=production`.
