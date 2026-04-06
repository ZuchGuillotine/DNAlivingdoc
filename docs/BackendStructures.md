# Backend Structures Document

## Service Initialization

### Enhanced Service Architecture

#### Context Building System
- Service: llmContextService.ts and llmContextService_query.ts
  - Purpose: Builds intelligent context for different interaction types
  - Features:
    - Vector-based semantic search integration
    - Lab results context incorporation
    - Token usage optimization
    - Authentication-aware context building
    - Comprehensive debug logging
    - Proper error recovery mechanisms
    - Real-time context validation
    - Streaming response support
    - Enhanced fallback mechanisms

#### Lab Results Integration  
- Service: labSummaryService.ts
  - Purpose: Processes and summarizes lab results
  - Features:
    - Robust PDF parsing with version-specific configuration
    - Proper error handling and recovery
    - Comprehensive metadata storage
    - File buffer optimization
    - Enhanced logging system
    - Successful file type verification
    - Token-efficient summarization
    - Intelligent analysis of lab data
    - Vector embedding generation
    - Context integration capabilities
    - Scheduled processing tasks
    - Error handling and validation
    - Token-efficient summarization
    - Metadata enrichment

### Service Startup Architecture
- Class: ServiceInitializer (in server/services/serviceInitializer.ts)
  - Purpose: Provides orderly initialization of all dependent services
  - Methods:
    - `initializeServices()`: Main entry point for service initialization
    - `initializePGVector()`: Sets up vector database services
    - `initializeSummarization()`: Initializes summarization services
    - `startScheduledTasks()`: Configures automated summary generation
    - `shutdownServices()`: Provides graceful shutdown of all services
  - Integration:
    - Integrated with server startup in index.ts
    - Environment-aware scheduling (only in production)
    - Robust error handling to prevent startup failures
    - Graceful shutdown with proper cleanup

### Initialization Flow
1. Server Startup:
   - Express server initialization and middleware setup
   - Database connection establishment
   - Service initialization via `initializeAndStart()` function:
     - Calls serviceInitializer.initializeServices()
     - Continues server startup even if services fail
     - Finds available port with retry mechanism
     - Starts listening on available port
   - Proper signal handling for graceful shutdown

2. Service Initialization:
   - PGVector services verification
   - OpenAI API connectivity check
   - Summarization service setup
   - Automated task scheduling (production only)

3. Shutdown Process:
   - Dedicated `handleShutdown()` function for clean termination
   - Signal handler registration (SIGTERM, SIGINT)
   - Service cleanup via serviceInitializer.shutdownServices()
   - Server connection closure
   - Forced termination after 10-second timeout
   - Comprehensive error handling during shutdown

## Database Structure

### Primary Database (NeonDB)
- Location: Neon PostgreSQL
- Purpose: All application data storage
- Tables:
  - users: User authentication and profiles
  - supplements: User's persistent supplement selections
  - healthStats: User health data
  - blogPosts: Content management
  - supplementLogs: Daily supplement intake records
  - qualitativeLogs: Chat interactions and AI responses
  - supplementReference: Autocomplete and search functionality
  - query_chats: General query chat interactions
  - labResults: User's uploaded lab test results and reports


### Data Flow
1. Chat Systems:
   - Qualitative Feedback Chat:
     - Purpose: Gather user observations about supplement experiences
     - Storage: qualitative_logs table with type='chat'
     - Context: Combines health stats, supplement logs and previous observations
     - Components: LLMChat, llmContextService, logService
     - Display: Shown in the Daily Notes section of supplement history
   - General Query Chat (Implemented):
     - Purpose: Provide factual information about supplements
     - Storage: Uses same database tables but different context structure
     - Context: Specialized context with health stats and different system prompt
     - Components: AskPage, llmContextService_query, openaiQueryService
     - Authentication-aware: Provides personalized context for auth users

2. Supplement Management:
   - User selections stored in supplements table
   - Daily tracking stored in supplement_logs table
   - Card operations (add/edit/delete) update supplements table
   - "Save Changes" button triggers supplement_logs entry

2. Database Integration Flow:
   - Supplement card data managed in supplements table
   - Save operation triggers data storage in supplement_logs
   - History view combines data from supplement_logs and qualitative_logs

3. Chat System:
   - Interactions stored in qualitative_logs

#### Chat Summary System
- Table: chatSummaries
  - Fields: userId, summary, periodStart, periodEnd, metadata
  - Purpose: Stores condensed historical chat interactions
- Integration: 
  - Automated summarization via cron job
  - Included in LLM context building
  - Reduces token usage while maintaining context quality
  - Includes sentiment analysis and metadata

#### Advanced Summary System
- Service: advancedSummaryService.ts
  - Purpose: Creates intelligent summaries of user supplement logs and experiences
  - Features:
    - Daily summaries combining supplement logs and qualitative observations
    - Weekly summaries that identify patterns and trends
    - Automatic extraction of significant changes
    - Token-optimized context building for LLM interactions
    - Vector-based semantic similarity search
    - Retrieval of relevant historical content
    - Intelligent context prioritization 
  - Integration:
    - Works with logSummaries and embedding tables
    - Provides context to both chat and query systems
    - Reduces token usage in LLM calls
    - Improves relevance of AI responses
    - Integrates with embeddingService for semantic search
    - Powers both qualitative feedback and general query systems

#### Summary Scheduling System
- Service: summaryManager.ts (in server/cron)
  - Purpose: Manages automated scheduling of summary generation tasks
  - Features:
    - Configurable daily summaries (default: 1 AM)
    - Configurable weekly summaries (default: Sunday 2 AM)
    - Smart scheduling for first runs
    - On-demand real-time summarization capability
  - Integration:
    - Works with advancedSummaryService
    - Coordinates proper scheduling of resource-intensive tasks
    - Implements proper error handling and recovery
    - Provides comprehensive logging for monitoring

#### Vector Embedding System
- Service: embeddingService.ts
  - Purpose: Creates vector embeddings for semantic search
  - Features:
    - Generates 1536-dimension vectors using OpenAI embeddings
    - Supports similarity search via cosine distance
    - Processes both logs and summaries
    - Batch processing for efficient API usage
  - Integration:
    - Works with logEmbeddings and summaryEmbeddings tables
    - Enables semantic search in context building
    - Powers relevant context retrieval for query interface
    - Improves response quality with targeted context

### Stripe Integration and Payment Processing
- Payment processing structure:
  - Centralized price/product mapping in stripe-price-ids.ts
  - Stripe service singleton for consistent checkout handling
  - Post-payment account completion flow
  - Session-preserved authentication during checkout
- Core components:
  - StripeService class handling:
    - Checkout session creation/retrieval
    - Customer management
    - Subscription updates
    - Product/tier mapping
  - Middleware:
    - stripeAuthMiddleware for maintaining auth during redirects
    - Handles session restoration after payment
  - Routes:
    - /api/stripe/create-checkout-session
    - /api/stripe/checkout-session/:sessionId
    - /api/stripe/update-subscription
- Database schema additions:
  - stripe_customer_id (TEXT)
  - subscription_id (TEXT)
  - subscription_tier (TEXT)

### Subscription Tiers and Usage Tracking System
- Comprehensive tier structure:
  - Free: Basic supplement tracking
  - Core ($7.99/mo or $69/yr): AI essentials package
  - Pro ($14.99/mo or $99/yr): Full biohacker suite
- Usage tracking implementation:
  - AI interactions count with monthly reset
  - Lab uploads count with yearly reset
  - Automatic tier change management
  - Usage verification middleware
  - Upgrade path handling
- Tier limit middleware:
  - Real-time usage verification
  - Graceful limit handling
  - Clear upgrade prompts
  - Enhanced error responses
  - Comprehensive logging
- Database schema:
  - subscription_tier (TEXT)
  - ai_interactions_count (INTEGER)
  - ai_interactions_reset (TIMESTAMPTZ)
  - lab_uploads_count (INTEGER)
  - lab_uploads_reset (TIMESTAMPTZ)
- Three-tier structure:
  - Free: Basic supplement tracking functionality
  - Core: AI essentials package ($7.99/mo or $69/yr)
  - Pro: Full biohacker suite ($14.99/mo or $99/yr)
- Usage Tracking:
  - AI interactions count with reset timing
  - Lab upload count with reset timing
  - Tier start date tracking
  - Automatic tier change management

### Tables Schema Overview

#### Vector Search Tables
- logEmbeddings:
  - Purpose: Stores vector embeddings for semantic search of logs
  - Fields: id, logId, logType, embedding (vector(1536)), createdAt
  - Indexing: Uses ivfflat index with cosine similarity for fast search
  - Relations: References log entries across different log tables

- summaryEmbeddings:
  - Purpose: Stores vector embeddings for chat summaries
  - Fields: id, summaryId, embedding (vector(1536)), createdAt
  - Indexing: Uses ivfflat index with cosine similarity for fast search
  - Relations: References entries in the logSummaries table

#### Core Tables
- users:
  - Authentication data (username, email, password)
  - Profile information
  - Subscription data:
    - subscription_tier (free, core, pro)
    - ai_interactions_count
    - ai_interactions_reset
    - lab_uploads_count
    - lab_uploads_reset
    - tier_start_date
  - Email verification fields
  - Admin status

- supplements:
  - Active supplement tracking
  - Dosage and frequency information
  - User associations
  - Status tracking

- healthStats:
  - User health metrics
  - Biographical data
  - Allergies and conditions

#### Tracking Tables
- supplementLogs:
  - Daily intake records
  - Effects tracking (mood, energy, sleep)
  - Timestamps and notes
  - Side effects tracking

- qualitativeLogs:
  - Chat interactions
  - Sentiment analysis
  - Metadata for analytics
  - Categorization and tagging

- query_chats:
    - General query chat interactions
    - Timestamps
    - User ID (if authenticated)

- labResults:
    - File path and URL
    - Upload date
    - File metadata (size, type)
    - User ID
    - Notes and tags


#### Reference Tables
- supplementReference:
  - Supplement name standardization
  - Category classification
  - Autocomplete support

#### Content Management
- blogPosts:
  - Educational content
  - SEO metadata
  - Publishing workflow

- researchDocuments:
  - Scientific research articles
  - Detailed content with images
  - Author attribution
  - Tags for categorization
  - Slug-based URL routing

### Data Validation & Security
- Schema validation using Drizzle-zod
- Input sanitization
- Rate limiting
- Email verification
- Two-factor authentication support

## Authentication System

### Session Management
- MemoryStore-based session storage:
  - 24-hour session duration with automatic cleanup
  - Efficient memory usage with pruning of expired entries
  - Production-ready session security with secure cookies
- Cookie Configuration:
  - Secure flag enabled in production
  - HTTP-only flags for XSS protection
  - SameSite: 'lax' for CSRF protection
  - 24-hour expiration with automatic renewal

### Authentication Flow
1. Session Initialization:
   - Express session middleware with MemoryStore
   - Secure cookie configuration with proper flags
   - Proper middleware ordering for reliable auth state

2. Passport Integration:
   - Local strategy for username/password
   - Google OAuth integration
   - Efficient session serialization/deserialization
   - Proper user data persistence

3. Request Processing:
   - Session validation and user deserialization
   - Consistent authentication state propagation
   - Context-aware response handling
   - Proper error recovery

### Security Measures
1. CORS Configuration:

#### Supplement History Routes
GET /api/supplement-logs/:date
- Retrieves all supplement logs for a specific date
- Implements UTC day boundary handling for consistent results
- Returns combined data:
  - Supplement logs for the requested date
  - Qualitative logs for the date (excluding query-type logs)
  - Daily summaries for the date
- All data is properly joined with relevant tables
- Requires authentication
- Enhanced error handling with detailed logging

#### Summary Routes
GET /api/summaries
- Retrieves all summaries for the current user
- Requires authentication
- Returns array of summary objects with metadata

POST /api/summaries/daily
- Generates a daily summary for a specific date
- Requires authentication and date parameter
- Creates a comprehensive summary of supplement intake and qualitative feedback

POST /api/summaries/weekly
- Generates a weekly summary for a date range
- Requires authentication and date range parameters
- Identifies patterns and trends across multiple days

POST /api/summaries/realtime
- Triggers immediate summarization for the current user
- Requires authentication
- Used for on-demand context building and analysis

   - Credentials properly handled
   - Essential headers allowed: Content-Type, Authorization, Cookie
   - Secure methods: GET, POST, PUT, DELETE, OPTIONS
   - Origin validation for cross-domain requests

2. Rate Limiting:
   - 100 requests per 15-minute window
   - Progressive delay after 50 requests
   - Standards-compliant headers (draft-7)

3. Middleware Chain:
   - Optimized ordering for security and performance
   - Session middleware before authentication
   - Authentication before route handlers
   - Rate limiting as final protection layer

### Debug Infrastructure
1. Authentication Verification:
   - Dedicated debug endpoints
   - Session state inspection
   - User authentication validation
   - Comprehensive error logging

2. Security Monitoring:
   - Authentication state tracking
   - Session lifecycle monitoring
   - Error recovery mechanisms
   - Performance optimization hooks

### 2025 Authentication Refactor Highlights
- **Centralized configuration** (`server/config/auth.config.ts`) consolidates all cookie, tier-limit, and OAuth settings with full environment awareness.
- **Single initialization entry point**: `server/auth/setup.ts` is an async, idempotent loader that prevents duplicate Passport configuration and gracefully handles CommonJS ↔ ESM imports.
- **Dedicated route module** (`server/auth/routes.ts`) replaces scattered auth endpoints and mounts all routes under `/auth` (OAuth) and `/api` (local auth).
- **Comprehensive middleware layer** (`server/middleware/auth.middleware.ts`):
  - `requireAuth`, `requireAdmin`, `requireTier`, and `checkFeatureLimit` helpers.
  - `setAuthInfo` attaches a consistent `req.auth` object that downstream handlers and services can trust.
- **Session storage strategy**:
  - `MemoryStore` in development for speed.
  - `session-file-store` in production with 24-hour TTL and automatic cleanup.
  - Dynamic cookie attributes: `secure` & `sameSite` tighten automatically when `CUSTOM_DOMAIN` is an HTTPS origin.
- **Google OAuth improvements**:
  - Environment-specific credential resolution (`DEV`, `TEST`, `PROD`).
  - Helper to generate callback URLs and avoid double-protocol bugs.
  - Structured logging surfaces token-exchange errors for rapid debugging.
- **Logout handling**:
  - `req.logout()` now explicitly destroys the session and clears cookies.
  - Future enhancement: Google token revocation on logout.

## Data Flow Architecture

### Biomarker Extraction System
- Service: biomarkerExtractionService.ts
  - Purpose: Extract and validate biomarkers from lab results
  - Components:
    - Regex-based extraction (primary)
    - LLM-based extraction (fallback)
    - Hybrid storage system
  - Current Architecture:
    - Parallel processing of extraction methods
    - Intelligent metadata updates
    - Strict validation using BiomarkerSchema
    - Comprehensive error handling
  - Performance (May 11, 2025):
    - 91% extraction accuracy (20/22 biomarkers)
    - Successful hybrid extraction strategy
    - Proper metadata persistence
    - Efficient error recovery
  - Integration Points:
    - Works with labSummaryService for initial processing
    - Connects with metadata storage system
    - Integrates with validation framework
    - Supports vector search capabilities

### Lab Results File Handling
1. File Upload Flow:
   - Client sends multipart form data
   - Server processes via express-fileupload middleware
   - Files stored in uploads directory with timestamp-prefixed names
   - Metadata stored in labResults table
   - Success/failure feedback sent to client

2. File Access Control:
   - Authentication required for all operations
   - User-specific access restrictions
   - Proper file cleanup on deletion
   - Secure file storage path handling

3. Error Handling:
   - File size validation (50MB limit)
   - File type checking
   - Storage capacity verification
   - Comprehensive error reporting

### Authentication Data Flow
1. Client Request:
   - Session cookie included
   - Credentials properly transmitted
   - CORS headers respected

2. Server Processing:
   - Session validation
   - User deserialization
   - Authentication state checking
   - Request authorization

3. Response Handling:
   - Authentication-aware responses
   - Proper error states
   - Security headers included

### Data Flow
1. Chat Systems:
   - Qualitative Feedback Chat:
     - Purpose: Gather user observations about supplement experiences
     - Storage: qualitative_logs table with type='chat'
     - Context: Combines health stats, supplement logs and previous observations
     - Components: LLMChat, llmContextService, logService
   - General Query Chat (Implemented):
     - Purpose: Provide factual information about supplements
     - Storage: Uses same database tables but different context structure
     - Context: Specialized context with health stats and different system prompt
     - Components: AskPage, llmContextService_query, openaiQueryService
     - Authentication-aware: Provides personalized context for auth users

2. Supplement Management:
   - User selections stored in supplements table
   - Daily tracking stored in supplement_logs table
   - Card operations (add/edit/delete) update supplements table
   - "Save Changes" button triggers supplement_logs entry

2. Database Integration Flow:
   - Supplement card data managed in supplements table
   - Save operation triggers data storage in supplement_logs
   - History view combines data from supplement_logs and qualitative_logs

3. Chat System:
   - Interactions stored in qualitative_logs

#### Chat Summary System
- Table: chatSummaries
  - Fields: userId, summary, periodStart, periodEnd, metadata
  - Purpose: Stores condensed historical chat interactions
- Integration: 
  - Automated summarization via cron job
  - Included in LLM context building
  - Reduces token usage while maintaining context quality
  - Includes sentiment analysis and metadata


API Routes (from routes.ts)
#### Lab Results Routes
GET /api/labs/chart-data
- Retrieves time series data for lab biomarkers
- Supports pagination and filtering
- Returns formatted biomarker entries with metadata
- Requires authentication

GET /api/labs/chart-data/trends
- Retrieves trend analysis for specified biomarkers
- Accepts comma-separated biomarker names
- Returns aggregated time series data
- Requires authentication

GET /api/labs
- Retrieves all lab results for authenticated user
- Returns array of lab result objects with metadata
- Requires authentication

POST /api/labs
- Uploads new lab result file
- Handles file upload with 50MB size limit
- Stores file in uploads directory
- Creates database entry with metadata
- Requires authentication

DELETE /api/labs/:id
- Deletes specific lab result by ID
- Removes both database entry and physical file
- Requires authentication
- Verifies user ownership before deletion

#### AI Query Routes
POST /api/query
- Handles general supplement information queries
- Works for both authenticated and non-authenticated users
- Uses separate context building service (llmContextService_query)
- Authenticated users get personalized responses based on their health profile

#### Streak Tracking Routes
GET /api/supplement-streak
- Calculates user's current supplement logging streak
- Requires authentication
- Returns current streak count
#### Research Document Routes
GET /api/research
- Retrieves list of all research documents
- Publicly accessible
- Returns array of research document objects

GET /api/research/:slug
- Retrieves a specific research document by slug
- Publicly accessible
- Returns single research document object or 404

#### Admin Research Document Routes
POST /api/admin/research
- Creates a new research document
- Requires admin authentication
- Auto-generates slug from title

PUT /api/admin/research/:id
- Updates an existing research document
- Requires admin authentication

DELETE /api/admin/research/:id
- Deletes a research document
- Requires admin authentication

Authentication Routes
POST /api/register
Registers a new user.
Handles initial email verification token generation.
POST /api/login
Authenticates a user.
POST /api/logout
Logs out the user.
GET /api/verify-email
Handles email verification via token.
POST /api/auth/2fa/send
Initiates the two-factor authentication process.
Supplement Routes
GET /api/supplements
Retrieves a list of the user's supplements.
POST /api/supplements
Adds a new supplement.
PUT /api/supplements/:id
Updates an existing supplement.
DELETE /api/supplements/:id
Deletes a supplement.
GET /api/supplements/search
Searches for supplements in the supplement_refference table from the rds database.
Health Stats Routes
GET /api/health-stats
Retrieves the user's health data.
POST /api/health-stats
Updates the user's health data.
AI Integration Routes
POST /api/chat
Sends a chat message to the AI assistant.
Passes the system prompt and user-specific progress data to the OpenAI API.
Database Schema (from schema.ts)
Core Tables
users Table:
Fields: id, username, email, password, isVerified, verificationToken, isPro (Pro/Admin status), timestamps.
supplements Table:
Fields: id, name, dosage, frequency, userId (foreign key), activeStatus, startDate, timestamps.
Relationships: Each supplement is associated with a user.
supplementLogs Table:
Fields: id, supplementId, userId, takenAt (timestamp), mood, energy, sleep, sideEffects, timestamps.
healthStats Table:
Fields: id, userId, weight, sleepPattern, heartRate, allergies (JSON array), timestamps.
Core Business Logic
Supplement Management:
Dosage tracking and frequency scheduling.
Handling active/inactive status.
Support for alternative names via a separate supplementReference table (if applicable).
Health Monitoring:
Tracking weight, sleep patterns, and other basic health metrics.
Aggregation and visualization of health data.
Data Validation & Security:
Schema validation using Drizzle-zod.
Input sanitization and rate limiting across API endpoints.
Email verification and two-factor authentication flows.
AI Integration:
The system prepares a system prompt and includes user-specific data before sending requests to the OpenAI API.
Manages the daily limit for non-paying users.
Error Handling & Logging:
Robust error handling across all routes.
Security logging and monitoring to support HIPAA compliance.

### AI Service Architecture Updates (March 2025)

#### Streaming Response Implementation
- Chat Service:
  - Converted `chatWithAI` to async generator function
  - Implemented SSE (Server-Sent Events) for real-time delivery
  - Enhanced error handling and recovery mechanisms
  - Added comprehensive chunk-level logging
  - Fixed issues with premature stream termination
  - Ensured proper completion of streaming responses
  - Resolved race conditions in stream processing

- Query Service:
  - Modified `queryWithAI` to support streaming responses
  - Implemented parallel streaming architecture to chat service
  - Added user context preservation during streaming
  - Enhanced client-side stream parsing

#### Technical Specifications
- OpenAI Integration:
  - Model: "o3-mini-2025-01-31"
  - Parameters:
    - max_completion_tokens: Controls response length
    - stream: true for real-time delivery
  - Removed legacy parameters:
    - temperature (unsupported)
    - max_tokens (replaced)
  - Enhanced Metrics and Logging:
    - Token usage estimation and tracking
    - Request and response token counting
    - Detailed chunk-level streaming logs
    - Comprehensive error diagnostics
    - Performance timing metrics

#### Response Flow
1. Client Request:
   - Initiates connection with appropriate headers
   - Sets up EventSource listener for streaming
   - Maintains connection for duration of response

2. Server Processing:
   - Configures SSE headers
   - Creates streaming response channel
   - Processes chunks via async generator
   - Maintains proper error boundaries

3. Stream Handling:
   - Word-by-word content delivery
   - Real-time UI updates
   - Proper connection closure
   - Error recovery mechanisms

#### Logging Infrastructure
- Stream Processing:
  - Chunk-level content logging
  - Timing information for each chunk
  - Error tracking and recovery
  - Performance metrics

- Client Integration:
  - SSE connection status
  - Parse success/failure
  - UI update verification
  - Error boundary activation

#### Error Handling
- Comprehensive error recovery:
  - Stream interruption handling
  - Connection dropout recovery
  - Parse error management
  - Client-side error boundaries

#### Performance Optimizations
- Efficient stream processing
- Minimal memory footprint
- Proper connection management
- Enhanced debugging capabilities

## OCR Implementation Summary

### Current Implementation (April 2025)
- **Integration**: Tesseract OCR with specialized configuration
- **Features**:
  - Custom page segmentation mode for medical data
  - Character whitelist optimization
  - Enhanced error handling and recovery
  - Debug logging infrastructure
  - Token-efficient summarization
  - PDF and image format support
  - Metadata enrichment

### Known Limitations
- Inconsistent recognition of:
  - Medical abbreviations
  - Numerical data formatting
  - Structured tabular content
- Potential need for enterprise solutions:
  - Google Cloud Vision API
  - Azure Computer Vision
  - Alternative OCR providers

### Integration Points
- **Lab Results Service**: Processes uploaded files
- **Context Building**: Incorporates results into LLM context
- **Summary System**: Generates analysis of lab data
- **Vector Search**: Enables semantic search of results

## Testing Architecture

The application uses Jest for testing core functionality with a focus on critical services.

### Test Structure
- **Location**: `server/tests/`
- **Configuration**: `jest.config.cjs` (CommonJS format for ES module compatibility)
- **Setup**: `server/tests/setup.ts` for shared testing utilities

### Core Test Suites

#### Context Building Tests
- **File**: `llmContextService.test.ts`
- **Purpose**: Verify context construction for both feedback and query systems
- **Key Tests**:
  - User context construction for feedback chat
  - Query context construction for supplement information
  - Context differences between different query types
  - Unauthenticated user handling
  - Token optimization verification

#### Embedding Service Tests
- **File**: `embeddingService.test.ts`
- **Purpose**: Test vector embedding generation and similarity search
- **Key Tests**:
  - Embedding generation for different text types
  - Vector similarity search functionality
  - Batch processing capabilities
  - Error handling and recovery

#### Summary Service Tests
- **File**: `advancedSummaryService.test.ts`
- **Purpose**: Verify summarization functionality
- **Key Tests**:
  - Daily summary generation
  - Weekly summary generation
  - Handling of different log types
  - Content extraction from summaries
  - Vector search integration

#### Scheduled Tasks Tests
- **File**: `summaryManager.test.ts`
- **Purpose**: Test the scheduling of summary generation
- **Key Tests**:
  - Daily task scheduling
  - Weekly task scheduling
  - Real-time summary triggering
  - Task cleanup and shutdown

#### OpenAI Integration Tests
- **File**: `openai.test.ts`
- **Purpose**: Verify OpenAI API integration
- **Key Tests**:
  - Chat completion generation
  - Streaming response handling
  - Error recovery mechanisms
  - Token estimation accuracy

#### Service Initialization Tests
- **File**: `serviceInitializer.test.ts`
- **Purpose**: Test service startup and shutdown
- **Key Tests**:
  - Proper initialization sequence
  - Graceful shutdown
  - Error handling during startup
  - Service verification

### Test Commands
```
npm test               # Run all tests
npm run test:watch     # Run in watch mode (auto-rerun)
npm run test:summary   # Test summary services
npm run test:embedding # Test embedding services
npm run test:context   # Test context building
npm run test:openai    # Test OpenAI integration
```

### Testing Strategies
1. **Database-Aware Testing**: Tests check for database availability and skip when unavailable
2. **Cleanup**: Test data is cleaned up after tests to avoid accumulation
3. **Mock Services**: External dependencies are mocked for reliable testing
4. **Token Estimation**: A consistent token estimation strategy is used across tests
5. **Timeouts**: Longer timeouts for API-dependent tests


### AI Service Architecture Updates (March 2025)

#### Streaming Response Implementation
- Chat Service:
  - Converted `chatWithAI` to async generator function
  - Implemented SSE (Server-Sent Events) for real-time delivery
  - Enhanced error handling and recovery mechanisms
  - Added comprehensive chunk-level logging
  - Fixed issues with premature stream termination
  - Ensured proper completion of streaming responses
  - Resolved race conditions in stream processing

- Query Service:
  - Modified `queryWithAI` to support streaming responses
  - Implemented parallel streaming architecture to chat service
  - Added user context preservation during streaming
  - Enhanced client-side stream parsing

#### Technical Specifications
- OpenAI Integration:
  - Model: "o3-mini-2025-01-31"
  - Parameters:
    - max_completion_tokens: Controls response length
    - stream: true for real-time delivery
  - Removed legacy parameters:
    - temperature (unsupported)
    - max_tokens (replaced)
  - Enhanced Metrics and Logging:
    - Token usage estimation and tracking
    - Request and response token counting
    - Detailed chunk-level streaming logs
    - Comprehensive error diagnostics
    - Performance timing metrics

#### Response Flow
1. Client Request:
   - Initiates connection with appropriate headers
   - Sets up EventSource listener for streaming
   - Maintains connection for duration of response

2. Server Processing:
   - Configures SSE headers
   - Creates streaming response channel
   - Processes chunks via async generator
   - Maintains proper error boundaries

3. Stream Handling:
   - Word-by-word content delivery
   - Real-time UI updates
   - Proper connection closure
   - Error recovery mechanisms

#### Logging Infrastructure
- Stream Processing:
  - Chunk-level content logging
  - Timing information for each chunk
  - Error tracking and recovery
  - Performance metrics

- Client Integration:
  - SSE connection status
  - Parse success/failure
  - UI update verification
  - Error boundary activation

#### Error Handling
- Comprehensive error recovery:
  - Stream interruption handling
  - Connection dropout recovery
  - Parse error management
  - Client-side error boundaries

#### Performance Optimizations
- Efficient stream processing
- Minimal memory footprint
- Proper connection management
- Enhanced debugging capabilities

### Context Building Logic

The context building service implements a sophisticated approach:

1. Authentication and User Context:
   - Properly validates user authentication state
   - Fetches health statistics for authenticated users
   - Handles anonymous users with appropriate defaults
   - Maintains consistent authentication checks

2. Vector Search Integration:
   - Uses embeddingService for semantic similarity search
   - Retrieves relevant qualitative chat logs
   - Processes daily and weekly summaries
   - Filters content based on relevance scores
   - Optimizes token usage through smart filtering

3. Content Processing:
   - Combines multiple content types:
     - Recent daily summaries
     - Relevant historical summaries
     - Qualitative observations
     - Quantitative supplement logs
   - Formats content with proper date information
   - Maintains context hierarchy for better responses

4. Debug Infrastructure:
   - Generates detailed debug logs
   - Tracks context components and flags
   - Analyzes token usage
   - Monitors content relevance
   - Provides comprehensive error tracking

5. Context Assembly:
   - Constructs properly formatted messages array
   - Includes system prompt with user context
   - Maintains conversation history when relevant
   - Optimizes context for token efficiency
   - Ensures proper content ordering

## Lab Results Processing Pipeline

### Lab Text Preprocessing Service (`services/labTextPreprocessingService.ts`)
Handles the extraction and normalization of text from various lab file formats.

#### Key Components:
- **File Type Support**:
  - PDF files (using pdf-parse and Google Vision OCR)
  - DOCX files (using mammoth)
  - Image files (using Google Vision OCR)
  - Text files (direct processing)

- **Processing Pipeline**:
  1. File Type Detection
  2. Format-Specific Extraction
  3. OCR Processing (if needed)
  4. Text Normalization
  5. Quality Assessment
  6. Metadata Generation

- **Quality Metrics**:
  - OCR Confidence Scores
  - Text Completeness
  - Formatting Preservation
  - Processing Time
  - Error Rates

### Database Schema Updates

#### Lab Results Table (`labResults`)
Enhanced metadata structure for pre-processed text:

```typescript
interface LabResultMetadata {
  // ... existing fields ...
  preprocessedText: {
    rawText: string;          // Original extracted text
    normalizedText: string;   // Cleaned and standardized text
    processingMetadata: {
      fileType: string;       // Detected file type
      processingSteps: string[];  // Applied processing steps
      qualityMetrics: {
        ocrConfidence?: number;   // OCR confidence score
        textCompleteness: number; // Text completeness score
        processingTime: number;   // Processing duration
        errorCount: number;       // Number of processing errors
      };
      ocrCorrections?: {         // OCR-specific corrections
        original: string;
        corrected: string;
        confidence: number;
      }[];
      standardizationRules?: {    // Applied standardization rules
        pattern: string;
        replacement: string;
        count: number;
      }[];
    };
  };
}
```

### Integration Points

#### Lab Results Service
- Handles file upload and initial processing
- Integrates with pre-processing service
- Manages database operations
- Coordinates with biomarker extraction

#### Biomarker Extraction Service
- Uses pre-processed text for improved accuracy
- Leverages normalized text for consistent parsing
- Benefits from quality metrics for confidence scoring

#### File Upload Flow
1. File Upload → Lab Results Service
2. Pre-processing → Lab Text Preprocessing Service
3. Text Storage → Database
4. Biomarker Extraction → Biomarker Extraction Service
5. Results Storage → Database