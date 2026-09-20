# FINTEL Production Deployment

## Recommended topology

FINTEL is currently a single deployable Node/Express application with a Vite-built React client, tRPC/REST APIs, a MySQL/TiDB database, and the Python quant engine invoked by the server adapter.

## Required environment

- `DATABASE_URL`
- `JWT_SECRET`
- `ALLOWED_ORIGIN`
- authentication/OAuth variables required by the existing SDK
- `OPENAI_API_KEY` only if the OpenAI-backed research provider is enabled
- optional provider keys for future adapters

## Container

The repository contains a production `Dockerfile`. It runs type checking and the production build during the image build and starts `dist/index.js`.

## Database

Run migrations against the production database using the existing Drizzle migration workflow. Never reset a production database.

## Scheduler

Deploy the application first. Only then enable the four CBK scheduled ingestion jobs documented in `docs/CBK_SCHEDULER_OPERATIONS.md`.

## Production checklist

- configure database
- configure authentication/OAuth
- configure allowed origin
- configure AI provider if desired
- run additive migrations
- deploy container
- verify health/API/auth
- verify data-health
- verify quant engine
- verify research authorization
- enable CBK schedules
- inspect ingestion runs
- enable backups and monitoring

The application does not claim live/current data unless validated persisted observations exist.
