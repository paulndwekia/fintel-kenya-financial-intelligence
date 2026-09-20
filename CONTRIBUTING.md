# Contributing to FINTEL

FINTEL is a Kenyan financial intelligence platform. Contributions must preserve data integrity, source provenance, security, and separation between market data, quantitative calculation, and AI interpretation.

- Never commit secrets or credentials.
- Never introduce fabricated market data.
- Preserve source and observation timestamps.
- Add tests for financial calculations and ingestion changes.
- Do not bypass portfolio authorization.
- Document schema migrations.
- Keep AI outputs distinguishable from authoritative market data and quant-engine results.

## Local development

```bash
corepack enable
pnpm install
cp .env.example .env
pnpm check
pnpm test
pnpm build
pnpm dev
```
