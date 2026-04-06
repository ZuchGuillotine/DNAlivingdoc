# Genetics Web

Standalone extraction of the DNA/genetics web feature that previously lived as a loose git worktree inside the main `Howareyoufeeling` repository.

This directory is intended to be promoted into its own repository. The application currently contains:

- React + TypeScript client
- Express + TypeScript server
- Drizzle/Postgres schema and migrations
- Genetics upload, parsing, coverage, and report-generation flows
- Existing product code that still carries some `Stack Tracker` branding and environment defaults

## Current Status

This extraction keeps the working branch state from `.worktrees/genetics-web`, including in-progress genetics work. It is structurally independent, but not fully rebranded yet.

Known follow-up work before public release:

- replace remaining `Stack Tracker` product copy and domains
- review infrastructure defaults under `infra/` and server auth/cookie names
- remove or archive legacy docs and generated/local-only files
- create a fresh remote and CI/CD setup for this repository

## Local Setup

1. Install dependencies
```bash
npm install
```

2. Set up environment variables
Create a `.env` file with:
```bash
DATABASE_URL=your_postgres_url
SENDGRID_API_KEY=your_sendgrid_key
OPENAI_API_KEY=your_openai_key
SESSION_SECRET=your_session_secret
```

3. Initialize the database
```bash
npm run db:push
```

4. Start development server
```bash
npm run dev:local
```

The application will be available at `http://localhost:5173`.

## Environment Configuration

### Quick Start
- **Development**: Run `npm run dev:local` and access the app at http://localhost:5173
- **Production**: Deployed via AWS App Runner with automated builds

### Important Documentation
- 📚 **[Environment Configuration Guide](./docs/ENVIRONMENT_CONFIGURATION.md)** - Detailed guide for dev/prod environments
- 🚀 **[Quick Reference](./docs/QUICK_REFERENCE_ENV.md)** - Quick commands and troubleshooting
- 🧭 **[Extraction Notes](./docs/repo-extraction.md)** - Repo-split assumptions and cleanup checklist

### Key Points
- Development and production use different authentication systems
- Always test in local development before deploying
- The production configuration is isolated from development changes
- See the documentation above for detailed configuration information

## Development Guidelines

### Code Standards
- Follow TypeScript best practices
- Use TanStack Query for data fetching
- Implement proper error boundaries
- Follow HIPAA compliance requirements
- Use provided UI components from shadcn/ui
- Write comprehensive tests

### HIPAA Compliance
- All health data must be encrypted at rest
- Implement audit logging for data access
- Ensure secure transmission (HTTPS)
- Maintain user consent records
- Regular security assessments

### Blog Management
- Use SEO-friendly slugs for URLs
- Optimize images before upload
- Implement proper content sanitization
- Follow accessibility guidelines
- Maintain consistent formatting

## Project Structure
```
├── client/               # Frontend React application
│   ├── src/
│   │   ├── components/  # Reusable components
│   │   ├── pages/       # Page components
│   │   ├── hooks/       # Custom React hooks
│   │   └── lib/         # Utilities and types
├── server/              # Backend Express application
│   ├── controllers/     # Route controllers
│   ├── services/        # Business logic
│   └── routes.ts        # API routes
└── db/                  # Database schema and migrations


## Google OAuth Authentication Troubleshooting

If you're having issues with Google OAuth authentication, check the following:

1. **Verify credentials:** Ensure `GOOGLE_CLIENT_ID_TEST` and `GOOGLE_CLIENT_SECRET_TEST` are correctly set in your environment.

2. **Check callback URL:** Verify that the callback URL in Google Cloud Console exactly matches what your application is using:
   - Production: `https://stacktracker.io/auth/google/callback`
   - Development: `https://<repl-slug>.<repl-owner>.repl.co/auth/google/callback`

3. **OAuth consent screen:** Make sure your consent screen is properly configured with the required scopes (`email` and `profile`).

4. **Test users:** If your app is in testing mode, ensure your test users are added in the OAuth consent screen.

5. **Run diagnostic script:** Use the provided script to check your configuration:
   ```
   node scripts/test_google_auth.js
   ```

6. **Check logs:** Look for specific error messages in the server logs when initiating authentication and during the callback.

7. **Authorized domains:** Ensure your domains are authorized in the Google Cloud Console.
