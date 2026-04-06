description: "StackTracker – General development & architecture rules for AI collaborators"
globs:

* "\*\*/\*"
  alwaysApply: true

---

# StackTracker Cursor Rules

These rules apply to every file in the repository and are always injected into the AI's context. They encode our core conventions so that automated edits stay aligned with human expectations.

## Core Principles

* **Plan → Act**: Before making code changes, generate a short plan (bullet list, MECE). Revise it if the human asks, then implement.
* **Minimal disruption**: Prefer additive edits; avoid large rewrites unless explicitly requested.
* **Context awareness**: Read referenced files and reuse existing patterns. Do not introduce redundant libraries.

## Front‑end Standards

* React 18 + TypeScript, functional components, named exports.
* TanStack Query for data, shadcn/ui + TailwindCSS for styling, Framer Motion for animations.
* Keep components ≤200 LOC; split if larger.
* Place UI in `/client/src/components`, pages in `/client/src/pages`.

## Back‑end Standards

* Express + TypeScript with ESM imports (`import x from 'y';`), `.js` extensions in compiled imports.
*do not use require, as we are using es modules
* Reuse OpenAI wrapper in `/server/openai.ts`; never instantiate the SDK elsewhere.
* All new endpoints must include input validation with Zod and integration tests.
# Cursor Rules

- Ensure that backend fields (e.g. numeric, date) are returned as string | null (or Date) and convert them appropriately in the frontend (e.g. using Number(...) or new Date(...).toISOString().split('T')[0]) to avoid type mismatches in forms and API interactions.

# (Additional rules or notes can be added below.) 
## Testing

* Jest for all unit/integration tests.
* New features must raise global coverage (target ≥ 80 %).
* Tests live in `server/tests` and use the helpers in `test/setup.ts`.

## Database & Migrations

* Drizzle ORM over Postgres (Neon for prod, local for dev).
* Each migration: single concern, file pattern `YYYYMMDD_<description>.ts`.
* Use `npx tsx` to run migrations; clean up connections with `await client.end()` in `finally`.
* Rollback logic is mandatory.

### Drizzle Type Conventions

* Table definitions use camelCase (e.g., `labResults`, `biomarkerResults`).
* Type definitions use PascalCase with prefixes:
  * `Select` prefix for types used when selecting records (e.g., `SelectLabResult`)
  * `Insert` prefix for types used when inserting records (e.g., `InsertBiomarkerResult`)
* Import types explicitly: `import type { SelectLabResult, InsertBiomarkerResult } from '../../db/schema'`
* Never use pluralized table names as types (e.g., avoid `LabResults`, use `SelectLabResult` instead)

## AI / LLM Integration

* Keep requests within token and rate limits; prefer GPT‑4o‑mini unless overridden.
* Strip PII before sending user data.
* Update context–building tests when adding new sources.

## Security

* Never commit `.env`; update `.env.example` instead.
* Use Helmet and CORS middleware defaults.
* All secrets accessed via `process.env`.

## Style Guide

* TypeScript strict mode must pass.
* Use Prettier default config; 100‑char line width.
* CamelCase for variables, PascalCase for components, snake\_case for SQL identifiers.

## Example — Adding a biomarker feature

1. Write migration and update Drizzle schema.
2. Add service & route in `/server`.
3. Create React chart component in `/components/charts`.
4. Add hook with TanStack Query.
5. Write unit + integration tests.
6. Document in `docs/biomarkers.md`.

@development.md
@db/migrations/migration_template.ts
@client/src/components/component_template.tsx

# Coding Standards and Naming Conventions

## General Principles

1. **Code Organization**
   - Follow single responsibility principle
   - Keep files focused and modular
   - Use proper directory structure
   - Maintain clear separation of concerns

2. **TypeScript Best Practices**
   - Use strict type checking
   - Avoid `any` type
   - Use proper type definitions
   - Leverage TypeScript features

## Naming Conventions

### Files and Directories
- Use kebab-case for file names: `user-service.ts`
- Use PascalCase for React components: `UserProfile.tsx`
- Use camelCase for utility files: `dateUtils.ts`
- Group related files in directories: `services/`, `components/`, `utils/`

### Variables and Functions
- Use camelCase for variables and functions: `getUserData`, `currentUser`
- Use PascalCase for classes and interfaces: `UserService`, `AuthConfig`
- Use UPPER_SNAKE_CASE for constants: `MAX_RETRY_COUNT`
- Use descriptive names that indicate purpose

### Database
- Use snake_case for table names: `user_profiles`
- Use snake_case for column names: `created_at`
- Prefix indexes with `idx_`: `idx_user_email`
- Use meaningful foreign key names: `user_id`, `profile_id`

## Code Style

### TypeScript/JavaScript
```typescript
// Interfaces
interface UserProfile {
  id: string;
  email: string;
  createdAt: Date;
}

// Type definitions
type AuthStatus = 'authenticated' | 'anonymous' | 'expired';

// Classes
class UserService {
  private readonly db: Database;
  
  constructor(db: Database) {
    this.db = db;
  }
  
  async getUser(id: string): Promise<UserProfile> {
    // Implementation
  }
}

// Functions
async function validateUserInput(input: UserInput): Promise<ValidationResult> {
  // Implementation
}

// Constants
const DEFAULT_TIMEOUT = 5000;
const SUPPORTED_FILE_TYPES = ['pdf', 'jpg', 'png'] as const;
```

### React Components
```typescript
// Component structure
interface UserCardProps {
  user: UserProfile;
  onEdit?: (user: UserProfile) => void;
}

export function UserCard({ user, onEdit }: UserCardProps) {
  // Component implementation
}

// Hooks
function useUserData(userId: string) {
  // Hook implementation
}
```

## Error Handling

### Error Types
```typescript
// Custom error classes
class ValidationError extends Error {
  constructor(message: string, public field: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Error handling patterns
try {
  await validateUserInput(input);
} catch (error) {
  if (error instanceof ValidationError) {
    // Handle validation error
  } else {
    // Handle unexpected error
  }
}
```

### Error Messages
- Use clear, descriptive error messages
- Include relevant context in errors
- Log appropriate error details
- Handle errors at appropriate levels

## Documentation

### Code Comments
```typescript
/**
 * Validates user input and returns validation result
 * @param input - User input to validate
 * @returns Promise resolving to validation result
 * @throws {ValidationError} If input is invalid
 */
async function validateUserInput(input: UserInput): Promise<ValidationResult> {
  // Implementation
}
```

### Component Documentation
```typescript
/**
 * UserCard component displays user profile information
 * @component
 * @param {UserProfile} user - User profile data
 * @param {Function} onEdit - Optional callback for edit action
 */
export function UserCard({ user, onEdit }: UserCardProps) {
  // Implementation
}
```

## Testing

### Test Structure
```typescript
describe('UserService', () => {
  let service: UserService;
  
  beforeEach(() => {
    service = new UserService(mockDb);
  });
  
  it('should create new user', async () => {
    // Test implementation
  });
  
  it('should handle validation errors', async () => {
    // Test implementation
  });
});
```

### Test Naming
- Use descriptive test names
- Follow pattern: `should [expected behavior] when [condition]`
- Group related tests in describe blocks
- Use proper setup and teardown

## Git Practices

### Commit Messages
- Use present tense: "Add feature" not "Added feature"
- Start with verb: "Fix", "Add", "Update", "Remove"
- Keep first line under 50 characters
- Use body for detailed explanation

### Branch Naming
- Feature branches: `feature/user-authentication`
- Bug fixes: `fix/login-error`
- Hotfixes: `hotfix/security-patch`
- Releases: `release/v1.2.0`

## Performance Considerations

### Code Optimization
- Use proper data structures
- Implement caching where appropriate
- Optimize database queries
- Monitor memory usage

### React Optimization
- Use proper memoization
- Implement code splitting
- Optimize re-renders
- Use proper key props

## Security Guidelines

### Data Handling
- Sanitize user input
- Use proper encryption
- Implement proper authentication
- Follow security best practices

### API Security
- Validate all requests
- Implement proper rate limiting
- Use secure headers
- Follow OWASP guidelines 