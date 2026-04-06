# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

### Development
- `npm run dev` - Start both client and server in development mode (concurrently)
- `npm run dev:server` - Start server only with hot reload
- `npm run dev:client` - Start client only (Vite dev server)
- `npm run dev:local` - Run local development script (./scripts/dev-local.sh)

### Build & Deploy
- `npm run build` - Build both client (Vite) and server (esbuild)
- `npm run start` - Start production server
- `npm run check` - TypeScript type checking

### Database
- `npm run db:push` - Push schema changes to database (Drizzle)
- `npx tsx db/migrations/<migration-file>.ts` - Run specific migration

### Testing
- `npm test` - Run all Jest tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:services` - Run service-specific tests
- `npm run test:context` - Run context service tests
- `npm run test:verbose` - Run tests with verbose output

### Code Quality
- `npm run lint` - ESLint checking
- `npm run lint:fix` - Fix ESLint issues
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check Prettier formatting

## Architecture Overview

### Tech Stack
- **Frontend**: React 18 + TypeScript, TailwindCSS + shadcn/ui, TanStack Query, Wouter routing
- **Backend**: Express + TypeScript (ESM modules), Passport.js authentication
- **Database**: PostgreSQL with Drizzle ORM, pgvector for embeddings
- **AI**: OpenAI GPT-4o-mini with streaming responses
- **Email**: SendGrid integration
- **Payments**: Stripe integration

### Project Structure
```
├── client/src/           # React frontend
│   ├── components/       # Reusable UI components
│   ├── pages/           # Page components
│   ├── hooks/           # Custom React hooks
│   └── lib/             # Utilities and types
├── server/              # Express backend
│   ├── services/        # Business logic services
│   ├── routes/          # API route handlers
│   ├── middleware/      # Express middleware
│   ├── auth/           # Authentication setup
│   ├── cron/           # Scheduled tasks
│   └── utils/          # Server utilities
├── db/                  # Database schema and migrations
└── docs/               # Comprehensive documentation
```

### Key Services Architecture
- **serviceInitializer.ts**: Manages service dependencies and graceful shutdown
- **llmContextService.ts**: Builds context for AI chat interactions
- **llmContextService_query.ts**: Builds context for AI supplement queries
- **advancedSummaryService.ts**: Creates intelligent daily/weekly summaries
- **embeddingService.ts**: Manages OpenAI embeddings for vector search
- **biomarkerExtractionService.ts**: Processes lab results with OCR/AI

### Database Schema (NeonDB)
- **users**: Authentication, subscription tiers, usage limits
- **healthStats**: User health metrics and profile data
- **supplements**: User's active supplement selections
- **supplementLogs**: Daily supplement intake tracking
- **qualitativeLogs**: AI chat interactions and observations
- **labResults**: Lab result storage with biomarker extraction
- **biomarkerResults**: Processed biomarker data points

## Development Guidelines

### Code Standards (from cursor_rules.md)
- Use ESM imports (`import x from 'y'`) - no require() statements
- Backend numeric/date fields return as string|null, convert in frontend
- React: functional components, named exports, ≤200 LOC per component
- Drizzle types: `SelectTableName` for selects, `InsertTableName` for inserts
- Never use pluralized table names as types

### Testing Requirements
- Jest for all tests, target ≥80% coverage
- New endpoints require Zod validation + integration tests
- Use helpers in `server/tests/setup.ts`

### Database Patterns
- Migrations: `YYYYMMDD_<description>.ts` pattern
- Use `npx tsx` to run migrations
- Always include rollback logic
- Clean up connections with `await client.end()` in finally blocks

### AI Integration
- Reuse OpenAI wrapper in `/server/openai.ts` - never instantiate SDK elsewhere
- Use GPT-4o-mini unless specifically overridden
- Strip PII before sending to AI
- Model uses streaming responses with SSE

### Security & Environment
- Never commit `.env` files
- Use Helmet and CORS middleware
- All secrets via `process.env`
- Session-based auth with MemoryStore

## Common Debugging Commands

### Authentication Testing
- `node scripts/test-auth.js` - Test authentication flow
- `node scripts/test_google_auth.js` - Test Google OAuth setup

### Database Debugging
- `node scripts/check_query_chats_table.js` - Verify chat table structure
- `npx tsx scripts/verify_lab_storage.ts` - Check lab result storage

### Service Testing
- `npm run test:context` - Test LLM context building
- `npm run test:embedding` - Test embedding service
- `npm run test:summary` - Test summary generation

## Important Notes

- This is a HIPAA-compliant health tracking application
- Contains dual AI chat systems: qualitative feedback + general queries  
- Uses session-based authentication (not JWT)
- Database migrations require manual execution
- Streaming AI responses use Server-Sent Events (SSE)
- Pro features gated by subscription tier limits