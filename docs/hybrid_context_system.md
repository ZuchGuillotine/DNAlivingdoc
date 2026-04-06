# Hybrid Context System Documentation

## Overview

The Hybrid Context System is a sophisticated approach to manage context for LLM interactions, combining advanced summarization techniques with vector-based retrieval. This system addresses significant token usage challenges when dealing with large amounts of user data while maintaining high-quality, relevant context for AI interactions.

### Key Components

1. **Advanced Summarization Service**
   - Real-time summarization of daily logs
   - Consolidation of qualitative and quantitative data
   - Focus on significant changes and patterns
   - Hierarchical summarization (daily, weekly)

2. **Vector Embedding Storage**
   - PGVector integration with PostgreSQL
   - Creation and management of embeddings for logs and summaries
   - Efficient vector storage and indexing

3. **Similarity-Based Retrieval**
   - Query-specific context retrieval
   - Cosine similarity search for relevant content
   - Dynamic context inclusion based on relevance

4. **Context Building Services**
   - Integration with existing context services
   - Token-efficient context construction
   - Separation of query vs. feedback contexts

## Architecture

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│                 │      │                 │      │                 │
│  User Logs      │─────▶│  Summarization  │─────▶│  Log Summaries  │
│  (Raw Data)     │      │  Service        │      │  (Condensed)    │
│                 │      │                 │      │                 │
└─────────────────┘      └─────────────────┘      └─────────────────┘
                                  │                        │
                                  │                        │
                                  ▼                        ▼
                         ┌─────────────────┐      ┌─────────────────┐
                         │                 │      │                 │
                         │  Embedding      │      │  Vector Storage │
                         │  Service        │─────▶│  (PGVector)     │
                         │                 │      │                 │
                         └─────────────────┘      └─────────────────┘
                                                          │
                         ┌─────────────────┐             │
                         │                 │             │
                         │  User Query     │             │
                         │                 │             │
                         └────────┬────────┘             │
                                  │                      │
                                  ▼                      ▼
                         ┌─────────────────┐      ┌─────────────────┐
                         │                 │      │                 │
                         │  Context        │◀─────│  Vector Search  │
                         │  Service        │      │  Service        │
                         │                 │      │                 │
                         └────────┬────────┘      └─────────────────┘
                                  │
                                  ▼
                         ┌─────────────────┐
                         │                 │
                         │  OpenAI         │
                         │  LLM Service    │
                         │                 │
                         └─────────────────┘
```

## Database Schema

The system extends the existing database with the following tables:

1. **log_embeddings**
   - Stores vector embeddings for individual logs
   - Associates embeddings with log IDs and types
   - Enables vector similarity search

2. **summary_embeddings**
   - Stores vector embeddings for generated summaries
   - Links embeddings to summary IDs
   - Facilitates efficient retrieval of relevant summaries

3. **log_summaries**
   - Stores consolidated summaries of user logs
   - Includes metadata about summarized period and content
   - Tracks significant changes and patterns

## Implementation Details

### Context Building Process
1. Authentication Verification:
   - Validates user authentication state
   - Retrieves user-specific health data
   - Handles anonymous users appropriately
   - Maintains consistent auth checks

2. Vector Search Integration:
   - Uses embeddingService for semantic search
   - Retrieves relevant qualitative logs
   - Processes summaries and historical data
   - Filters based on relevance scores

3. Content Processing:
   - Formats multiple content types:
     - Daily summaries
     - Historical summaries
     - Qualitative observations
     - Quantitative logs
   - Maintains proper date formatting
   - Ensures context hierarchy

4. Debug Infrastructure:
   - Generates detailed debug logs
   - Tracks context components
   - Analyzes token usage
   - Monitors content relevance

### Summarization Process

The summarization workflow includes:

1. **Daily Summarization**
   - Triggered automatically at a scheduled time (default: 1 AM)
   - Processes all logs from the previous day
   - Focuses on extracting significant changes and patterns
   - Stores results in `log_summaries` table

2. **Weekly Summarization**
   - Runs weekly (default: Sunday at 2 AM)
   - Consolidates daily summaries into a weekly overview
   - Identifies patterns across the week
   - Provides higher-level insights

3. **Real-time Summarization**
   - Triggered on-demand before context building
   - Ensures latest logs are summarized before retrieval
   - Creates up-to-date context for LLM interactions

### Vector Search Implementation

The vector search process:

1. Generates embeddings for user queries using OpenAI's embedding API
2. Performs similarity search using PGVector's cosine similarity operator
3. Retrieves most relevant summaries and logs based on similarity scores
4. Filters results to ensure high-quality, recent content
5. Orders results by relevance for context building

### Context Building Logic

The context building service:

1. Takes user query and optional user ID as input
2. Fetches user health statistics for personalization
3. Uses vector search to find relevant summaries and logs
4. Formats the retrieved content into structured context
5. Constructs a context-aware prompt for the LLM
6. Handles authentication gracefully for both logged-in and anonymous users

## Performance Considerations

### Token Efficiency

- The hybrid approach significantly reduces token usage compared to the previous method:
  - Typical reduction: 70-90% fewer tokens per query
  - Example: From 200,000+ tokens to 10,000-20,000 tokens per interaction
  - Maintains or improves context quality through relevance-based filtering

### Latency Optimization

- Context building latency is optimized through:
  - Indexed vector search using PGVector's IVFFlat index
  - Batched embedding generation
  - Caching of frequently used embeddings
  - Parallel processing where applicable

## Extending the System

The hybrid context system is designed to be easily extended for additional data types. To add a new data source:

1. **Update Database Schema**
   - Add appropriate tables for the new data type
   - Ensure proper indexing for efficient queries

2. **Extend Summarization Logic**
   - Modify `advancedSummaryService.ts` to include the new data type
   - Add specialized summarization logic if needed

3. **Update Context Building**
   - Modify context services to include the new data in context
   - Add type-specific formatting for the new data

See the "Integration Guidelines" document for detailed steps on integrating new data types.

## Maintenance

### Monitoring

The system includes comprehensive logging for monitoring:

- Token usage metrics for optimization
- Embedding generation statistics
- Summarization process details
- Vector search performance metrics

### Scheduled Tasks

The following scheduled tasks maintain the system:

- Daily summarization (1 AM UTC)
- Weekly summarization (Sunday 2 AM UTC)
- Embedding generation for new logs (continuous)

### Error Handling

The system includes robust error handling:

- Graceful fallback to older methods if services fail
- Automatic retry logic for OpenAI API interactions
- Comprehensive logging for troubleshooting
- Alerts for critical failures

## Example Usage

```typescript
// Example: Building context for a user query
const userId = 123;
const userQuery = "How is my vitamin D supplementation affecting my energy levels?";

// Get context using the vector-based approach
const context = await constructQueryContext(userId, userQuery);

// Use the context with OpenAI
const response = await openai.chat.completions.create({
  model: "o3-mini-2025-01-31",
  messages: context.messages,
  max_completion_tokens: 500
});
```

This documentation provides an overview of the hybrid context system. For specific implementation details, refer to the code and inline comments in the respective modules.