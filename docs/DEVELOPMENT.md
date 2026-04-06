# Development Guide

## Testing Framework

The application uses Jest for running unit and integration tests. The test configuration is in `jest.config.cjs` and uses a CommonJS format to be compatible with the ES module setup of the main project.

### Running Tests

Tests can be run with the following npm commands:

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:summary     # Test summary services
npm run test:embedding   # Test embedding services 
npm run test:context     # Test context building services
npm run test:openai      # Test OpenAI integration

# Run tests in watch mode (automatically re-runs when files change)
npm run test:watch
```

### Test Structure

Tests are organized in the `server/tests` directory and follow the pattern of `*.test.ts`. The main test modules include:

- `llmContextService.test.ts` - Tests for context building functionality
- `embeddingService.test.ts` - Tests for vector embedding generation
- `advancedSummaryService.test.ts` - Tests for the summary generation service
- `summaryManager.test.ts` - Tests for scheduled summary tasks
- `openai.test.ts` - Tests for OpenAI integration
- `serviceInitializer.test.ts` - Tests for service initialization and shutdown

### Test Utilities

A `setup.ts` file provides common utilities and mock functions for tests, including:

- Test environment configuration
- Token estimation functions
- Mock implementations of external services
- Database test helpers

### Testing Database Operations

Tests that interact with the database are designed to handle cases where the database might not be available. They include checks to skip tests when necessary.

### Test Data Cleanup

Many tests are designed to clean up after themselves to avoid test data accumulation. For example, summary tests track created records and remove them during test cleanup.

### Common ES Module Errors

If you encounter "require is not defined in ES module scope" errors:
1. Replace `require.main === module` with `import.meta.url === process.argv[1]` for direct script execution checks
2. Use ES Module imports (e.g., `import x from 'y'`) instead of CommonJS require
3. Make sure imported paths include the `.js` extension
4. For TypeScript files imported from JS, use the `.js` extension in the import path (not `.ts`)

Example of correct ES module usage:
```typescript
// Check if file is being run directly
if (import.meta.url === process.argv[1]) {
  main().catch(console.error);
}
```

### Database Migration Best Practices

When implementing database migrations, keep in mind these key points:

1. **ES Module Compatibility**
   - Use ES Module syntax instead of CommonJS in migration files
   - Replace `require.main === module` with `import.meta.url === new URL(process.argv[1], 'file:').href`
   - Use proper ES imports (e.g., `import { drizzle } from 'drizzle-orm/postgres-js'`)

2. **Database Connection**
   - Always include proper database initialization in migration files
   - Import and use the drizzle instance correctly
   - Handle connection cleanup in finally blocks
   ```typescript
   if (import.meta.url === new URL(process.argv[1], 'file:').href) {
     import('postgres').then(async ({ default: postgres }) => {
       const client = postgres(process.env.DATABASE_URL);
       const db = drizzle(client);
       try {
         await up(db);
       } finally {
         await client.end();
       }
     });
   }
   ```

3. **Migration Execution**
   - Use `tsx` for running TypeScript migration files directly: `npx tsx db/migrations/your_migration.ts`
   - Avoid using drizzle-kit for complex migrations that require custom logic
   - Include proper error handling and logging in migration scripts

4. **Common Pitfalls**
   - Ensure all imports are ES Module compatible
   - Always handle database connection cleanup
   - Include proper error messages and logging
   - Test migrations in development before running in production

These practices help ensure reliable and maintainable database migrations.

# Development Guide

## Architecture Overview

### Frontend
- React 18 with TypeScript
- TanStack Query for state management
- shadcn/ui components
- Tailwind CSS for styling

### Backend
- Express.js with TypeScript
- PostgreSQL with Drizzle ORM
- OpenAI integration for AI insights

## Development Workflow

### Setting Up Local Environment
1. Install dependencies: `npm install`
2. Set up environment variables

## Local Development & Testing Migration (May 2025)
- Migrated from Replit to local development
- Transferred environment variables from Replit Secrets to a .env file (root, gitignored)
- Ensured .env is UTF-8 encoded (no BOM) and values are unquoted
- Placed dotenv.config() at the very top of server/index.ts
- Noted that ESM import order can cause env vars to be undefined if db/index.ts is imported before dotenv.config()
- As a workaround, added dotenv.config() to db/index.ts for local dev
- Documented this workaround and recommend future refactor for single-source env loading
- Successfully started dev server and verified DB connection

3. Start development server: `npm run dev`

### Code Structure
- Components: `/client/src/components`
- Pages: `/client/src/pages`
- API Routes: `/server/routes.ts`
- Database: `/db`

### Adding New Features
1. Create components in `/client/src/components`
2. Add routes in `/server/routes.ts`
3. Update types in `/client/src/lib/types.ts`
4. Add tests where applicable

### AI Integration System
- OpenAI Integration: `/server/openai.ts`
  - Current Model: GPT-4o-mini
  - System prompt defines assistant behavior
  - Customizable temperature and token settings

- Context Building: `/server/services/llmContextService.ts`
  - Constructs personalized user context
  - Retrieves supplement logs and previous chats
  - Will be expanded to include more data sources

- Chat Summarization: `/server/services/llmSummaryService.ts`
  - Maintains condensed chat history
  - Functional but needs further testing
  - Integration Points:
    - Cron job: `/server/cron/summarizeChats.ts`
    - Context building: `/server/services/llmContextService.ts`

- Frontend Implementation:
  - Main chat: `/client/src/components/llm-chat.tsx`
  - Hook: `/client/src/hooks/use-llm.ts`
  - Planned second interface for 'ask' page (upcoming)

### Database Architecture
- Single NeonDB PostgreSQL database
- Schema defined in `/db/schema.ts`
- Migrations in `/db/migrations`
- Drizzle ORM for type-safe queries

### Database Migrations
- Create migration files in `/db/migrations` with TypeScript (.ts extension)
- Run migrations using `npx tsx db/migrations/your_migration_file.ts`
- Import database connection from `/db/index.ts` rather than creating new connections
- Use SQL template literals with drizzle for creating tables and modifying schema
- Verify migrations with direct database queries using appropriate tools

#### Migration Best Practices
- Keep migrations simple and focused on a single responsibility
- Use proper error handling in migration scripts
- Log clear success/failure messages
- Follow existing project conventions for database access
- Reuse the established database connection rather than creating new ones

### Best Practices
- Use TypeScript types for all props
- Follow existing component patterns
- Use TanStack Query for data fetching
- Keep components small and focused

### Common Tasks
- Adding new API endpoint
- Creating new React component
- Updating database schema
- Adding new supplement type

## Deployment
Deployment is handled through Replit's deployment system.

## Development Environment Setup (Updated May 2025)

### Local Development Requirements
1. **Node.js Environment**
   - Node.js 18.x or later required
   - Use `nvm` for Node version management
   - Verify installation: `node --version` and `npm --version`

2. **Environment Variables**
   - Copy `.env.example` to `.env` in root directory
   - Required variables:
     ```
     DATABASE_URL=postgresql://...
     OPENAI_API_KEY=sk-...
     GOOGLE_CLIENT_ID_PROD=...
     GOOGLE_CLIENT_SECRET_PROD=...
     STRIPE_SECRET_KEY=sk_...
     STRIPE_WEBHOOK_SECRET=whsec_...
     SESSION_SECRET=...
     ```
   - Verify UTF-8 encoding (no BOM)
   - Never commit `.env` to version control
   - Use `dotenv` for local development only

3. **Database Setup**
   - PostgreSQL 15+ required
   - NeonDB for production
   - Local PostgreSQL for development
   - Run migrations: `npx tsx db/migrations/latest.ts`

### TypeScript Configuration
1. **Project-wide Settings**
   - Strict mode enabled
   - ES Module support
   - Path aliases configured
   - Proper type checking

2. **Common TypeScript Errors**
   - Use proper ES Module imports
   - Include `.js` extensions
   - Avoid mixing CommonJS/ES Modules
   - Use proper type definitions

## Service Architecture & Best Practices

### Service Initialization
1. **Proper Service Order**
   ```typescript
   // server/index.ts
   async function initializeServices() {
     // 1. Environment validation
     validateEnvironment();
     
     // 2. Database connection
     await initializeDatabase();
     
     // 3. Core services
     await initializeOpenAI();
     await initializeEmbeddingService();
     
     // 4. Feature services
     await initializeSummaryService();
     await initializeContextService();
     
     // 5. Start server
     startServer();
   }
   ```

2. **Error Recovery**
   - Implement proper shutdown hooks
   - Handle service initialization failures
   - Maintain service state
   - Proper cleanup on errors

### Context Building System
1. **Error Boundaries**
   - Implement proper fallbacks
   - Handle token limits
   - Manage rate limits
   - Track context quality

2. **Performance Optimization**
   - Cache frequently used contexts
   - Implement proper timeouts
   - Monitor token usage
   - Track response times

## Testing Strategy

### Test Categories
1. **Unit Tests**
   - Service-level testing
   - Utility function testing
   - Type validation
   - Error handling

2. **Integration Tests**
   - API endpoint testing
   - Database operations
   - Service interactions
   - Authentication flows

3. **Performance Tests**
   - Response time benchmarks
   - Token usage tracking
   - Database query optimization
   - Memory usage monitoring

### Test Implementation
1. **Jest Configuration**
   ```javascript
   // jest.config.cjs
   module.exports = {
     preset: 'ts-jest',
     testEnvironment: 'node',
     setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
     coverageThreshold: {
       global: {
         branches: 80,
         functions: 80,
         lines: 80,
         statements: 80
       }
     }
   };
   ```

2. **Test Utilities**
   - Mock database connections
   - Service stubs
   - Authentication helpers
   - Token estimation utilities

## Security Best Practices

### Authentication & Authorization
1. **Session Management**
   - Secure cookie settings
   - Proper session cleanup
   - Rate limiting per user
   - Session validation

2. **API Security**
   - CORS configuration
   - Rate limiting
   - Request validation
   - Error handling

### Audit Logging
1. **Log Categories**
   - Authentication events
   - API requests
   - Database operations
   - Error tracking

2. **Log Implementation**
   ```typescript
   // server/utils/auditLogger.ts
   export const auditLogger = {
     auth: (event: AuthEvent) => {
       // Log authentication events
     },
     api: (request: ApiRequest) => {
       // Log API requests
     },
     db: (operation: DbOperation) => {
       // Log database operations
     },
     error: (error: Error) => {
       // Log errors
     }
   };
   ```

## Database Management

### Migration Best Practices
1. **Migration Structure**
   ```typescript
   // db/migrations/YYYYMMDD_description.ts
   import { sql } from 'drizzle-orm';
   
   export async function up(db: DrizzleClient) {
     try {
       await db.execute(sql`
         CREATE TABLE IF NOT EXISTS table_name (
           // schema definition
         );
       `);
     } catch (error) {
       console.error('Migration failed:', error);
       throw error;
     }
   }
   
   export async function down(db: DrizzleClient) {
     // Rollback logic
   }
   ```

2. **Migration Guidelines**
   - One change per migration
   - Include rollback logic
   - Test migrations locally
   - Verify data integrity
   - Document breaking changes

### Query Optimization
1. **Best Practices**
   - Use proper indexes
   - Implement query timeouts
   - Monitor query performance
   - Use connection pooling

2. **Common Pitfalls**
   - N+1 query problems
   - Missing indexes
   - Large result sets
   - Connection leaks
