# DNAlivingdoc

DNAlivingdoc is a genetics web application for uploading consumer DNA files, measuring data coverage and integrity, and generating a vetted, versioned report from approved facts only.

The product direction in this repository is a living genetics document:

- upload a DNA file and immediately see coverage and integrity
- generate a deterministic report pinned to a factset snapshot
- track report history as evidence changes over time
- notify users when relevant facts are updated, retired, or reclassified

The current product plan lives in [docs/PRODUCT_PLAN.md](/Users/benjamincox/Downloads/dnaliving/docs/PRODUCT_PLAN.md).

## Repository Scope

This repository contains:

- React + TypeScript client
- Express + TypeScript server
- Drizzle/Postgres schema and migrations
- genetics upload, parsing, coverage, and report-generation flows
- supporting docs for environment setup, development, and release planning

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file with the values required for your environment. At minimum, most local work will need:

```bash
DATABASE_URL=postgres://...
SESSION_SECRET=change-me
OPENAI_API_KEY=...
SENDGRID_API_KEY=...
APP_URL=http://localhost:5173
CUSTOM_DOMAIN=
```

3. Apply database changes:

```bash
npm run db:push
```

4. Start the app locally:

```bash
npm run dev:local
```

Frontend runs at `http://localhost:5173`. The API server runs at `http://localhost:3001`.

## Key Docs

- [docs/PRODUCT_PLAN.md](/Users/benjamincox/Downloads/dnaliving/docs/PRODUCT_PLAN.md)
- [docs/PROJECT_OVERVIEW.md](/Users/benjamincox/Downloads/dnaliving/docs/PROJECT_OVERVIEW.md)
- [docs/DEVELOPMENT.md](/Users/benjamincox/Downloads/dnaliving/docs/DEVELOPMENT.md)
- [docs/ENVIRONMENT_CONFIGURATION.md](/Users/benjamincox/Downloads/dnaliving/docs/ENVIRONMENT_CONFIGURATION.md)
- [docs/QUICK_REFERENCE_ENV.md](/Users/benjamincox/Downloads/dnaliving/docs/QUICK_REFERENCE_ENV.md)

## Standalone Cleanup Status

This repository was extracted from an earlier project and still contains some inherited product copy and operational assumptions. This pass removes the most obvious project-specific configuration defaults, but there is still follow-up cleanup to do in user-facing pages, transactional emails, and optional infrastructure code.
