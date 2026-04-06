# Testing Documentation

## Overview

This directory contains tests for the key services of the application. The testing framework uses Jest with TypeScript support.

## Running Tests

You can run the tests using the following npm commands:

```bash
# Run all tests
npm test

# Run in watch mode (auto-re-run on file changes)
npm run test:watch

# Run specific test suites
npm run test:summary     # Summary service tests
npm run test:embedding   # Embedding service tests
npm run test:context     # Context building tests
npm run test:openai      # OpenAI integration tests
```

## Test Structure

The tests are organized by service:

- `setup.ts` - Common setup code and utilities for all tests
- `llmContextService.test.ts` - Tests for context construction
- `embeddingService.test.ts` - Tests for vector embeddings
- `advancedSummaryService.test.ts` - Tests for summary generation
- `summaryManager.test.ts` - Tests for scheduled tasks
- `openai.test.ts` - Tests for OpenAI API integration
- `serviceInitializer.test.ts` - Tests for service initialization

## Notes on Testing

- Most tests that require database access are designed to skip if the database is unavailable
- OpenAI tests may use mocked responses to avoid excessive API calls
- Tests are designed to clean up after themselves when possible
- The test environment is configured in setup.ts and Jest configuration

## Adding New Tests

When adding new tests:

1. Create a new file following the naming pattern `*.test.ts`
2. Import necessary utilities from setup.ts
3. Use descriptive test names that explain the behavior being tested
4. Add database availability checks if needed
5. Implement cleanup for any test data created

## Common Issues

- Token errors: May indicate OpenAI API key issues
- Database connection errors: Check database availability
- Timeout errors: May indicate slow API responses or network issues