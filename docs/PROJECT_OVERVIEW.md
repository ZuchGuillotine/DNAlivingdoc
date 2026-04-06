# HIPAA-Compliant Supplement Tracking Application

## Project Overview
A cutting-edge health tracking and content management application that combines intelligent health recommendations with robust user experience features. The application provides secure, comprehensive health supplement tracking and AI-powered content creation tools with a focus on user privacy, data integrity, and seamless interaction.

## Technical Stack
- **Frontend**: React with TypeScript, Tailwind CSS, shadcn/ui components
- **Backend**: Express.js with TypeScript
- **Server Architecture**:
  - Robust service initialization system with graceful shutdown
  - Port conflict resolution with automatic retry mechanism
  - Comprehensive signal handling for reliability
  - Timeout-enforced shutdown for resource management
  - Improved error recovery during startup and shutdown
- **Database Architecture**:
  - **Consolidated Database (NeonDB)**:
    - All database tables are now stored in NeonDB Postgres
    - Previous RDS dependency has been removed
    - Complete database architecture including user data, supplements, logs, and chat interactions
    - Vector search capability with pgvector extension
    - Semantic similarity search for logs and summaries
  - **Vector Search Services**:
    - embeddingService: Generates and manages OpenAI embeddings for vector search
      - Creates 1536-dimension vectors for semantic similarity 
      - Powers intelligent context retrieval for AI responses
      - Supports both logs and summaries with efficient indexing
      - Implements batch processing for API efficiency
    - advancedSummaryService: Creates intelligent summaries of user supplement data
      - Generates daily summaries of supplement intake and observations
      - Creates weekly summaries that identify patterns and trends
      - Extracts significant changes for easier reference
      - Optimizes token usage in LLM context building
    - summaryManager: Provides automated scheduling of summary tasks
      - Configurable daily summaries (default: 1 AM)
      - Weekly summaries on Sundays at 2 AM
      - Real-time summary generation for immediate context needs
      - Comprehensive error handling and recovery
    - Postgres pgvector extension for efficient semantic similarity search
    - 1536-dimension vectors optimized for relevance matching

### AI Service Architecture Updates (March 2025)

#### OpenAI Service Enhancements
- Advanced Token Management:
  - Implemented token usage estimation and tracking
  - Added analytics for context and response tokens
  - Enhanced optimization of token usage
  - Reduced unnecessary context overhead

#### Streaming Response Implementation
- Chat Service:
  - Converted `chatWithAI` to async generator function
  - Implemented SSE (Server-Sent Events) for real-time delivery
  - Enhanced error handling and recovery mechanisms
  - Added comprehensive chunk-level logging

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


## Dual AI Chat Systems
The application includes two specialized chat interfaces for different user needs:

### 1. Qualitative Feedback Chat System
For gathering detailed user feedback about supplement experiences:

#### Data Flow
1. User initiates feedback through the chat interface
2. System constructs context from:
   - User health statistics (weight, height, allergies, etc.)
   - Recent supplement logs (quantitative data)
   - Previous qualitative observations
3. AI assistant engages user with relevant follow-up questions
4. Responses are stored in qualitative_logs table with type='chat'
5. Users can save meaningful conversations for future reference

#### Technical Components
- Frontend: LLMChat component in llm-chat.tsx
- Backend: llmContextService.ts for context construction
- Database: qualitative_logs table with chat-specific metadata

### 2. General Supplement Query System
For answering factual questions about supplements:

#### Data Flow
1. User submits question via the Ask page
2. System constructs specialized context from:
   - User health statistics (if authenticated)
   - User's supplement history (if authenticated)
   - Different system prompt focused on factual information
3. AI assistant provides evidence-based information
4. Authenticated users receive personalized responses considering their health context
5. Non-authenticated users receive general information

#### Technical Components
- Frontend: AskPage component in ask.tsx
- Backend: llmContextService_query.ts for context construction
- Database: Same database tables but with query-specific context building
  - **Consolidated Database (NeonDB)**:
    - User authentication and profiles
    - Health statistics
    - Blog content management
    - Supplement selections and tracking
    - Chat interaction history
    - Supplement reference data
    - Daily supplement logs
- **Authentication**: 
  - Passport.js with session-based auth
  - Google OAuth integration (currently in troubleshooting)
- **AI Integration**: 
  - OpenAI GPT-4o-mini for intelligent health insights
  - Functional with planned enhancements for streaming responses
  - System prompt refinements in progress
  - Additional context integration being developed
- **Email Service**: SendGrid for verification emails (functional with basic features)
- **Development Tools**: Drizzle ORM, TanStack Query, Wouter routing

## Data Flow Architecture
### Supplement Management Flow:
- User selections stored in supplements table
- Daily tracking stored in supplement_logs table
- Card operations (add/edit/delete) update supplements table
- "Save Changes" button triggers supplement_logs entry

### Database Integration Flow:
- Supplement card data managed in supplements table
- Save operation triggers data storage in supplement_logs
- History view combines data from unified database:
  - Logs from supplement_logs table
  - Notes from interactions stored in qualitative_logs table

### Database Schema Overview
#### NeonDB Tables:
1. **users**:
   - Core user authentication data
   - Profile information
   - Admin privileges tracking
   - Email verification status

2. **supplements**:
   - User's persistent supplement selections
   - Basic supplement information
   - Active/inactive status tracking

3. **healthStats**:
   - User health metrics
   - Historical health data
   - Tracking of various health indicators

4. **blogPosts**:
   - Content management system
   - Health-related articles and resources

5. **supplementLogs**:
   - Tracks daily supplement intake
   - Fields: id, supplementId, userId, takenAt, notes, effects (JSON)
   - Includes mood, energy, sleep tracking
   - Timestamps for creation and updates

6. **qualitativeLogs**:
   - Stores chat interactions and AI responses
   - Fields: id, userId, content, type, tags (JSON)
   - Contains chat interaction history
   - Metadata for enhanced tracking

7. **supplementReference**:
   - Powers autocomplete functionality
   - Fields: id, name, category
   - Unique constraints on supplement names
   - Timestamps for data management

## Implemented Features

### Authentication & User Management
- Enhanced session-based authentication system:
  - MemoryStore implementation for session storage
  - Secure cookie configuration with proper sameSite settings
  - Production-ready SSL/TLS handling
  - Cross-Origin Resource Sharing (CORS) configuration
- Robust user authentication flow:
  - Optimized middleware chain for reliable authentication state
  - Consistent authentication verification across services
  - Debug endpoints for authentication verification
  - Enhanced error handling and logging
- Profile management with user details and preferences
- Pro account toggle functionality
- Email verification system:
  - Verification token generation
  - Token expiration handling (24-hour validity)
  - Secure verification flow
  - User-friendly verification UI

### Core Supplement Management
- Supplement Streak Tracking:
  - 90-day streak tracking system
  - Visual progress indicator
  - Daily streak calculations
  - Motivational feedback
- Add, view, and delete supplements
- Advanced fuzzy search functionality:
  - Levenshtein distance algorithm for typo tolerance
  - Special handling for common vitamin name variations
  - Dynamic search distance based on word length
  - Normalized supplement name matching
- Detailed supplement information tracking:
  - Name, dosage, and frequency
  - Notes and additional details
  - Active/inactive status tracking

### Health Statistics
- Comprehensive health metrics tracking:
  - Weight tracking
  - Height measurements
  - Sleep analysis (hours and minutes)
  - Gender information
  - Date of birth records
  - Allergies logging
  - Profile photo management
- Visual health overview dashboard with dual-column layout
- Interactive health statistics page with editable form
- Persistent data storage with real-time updates
- Enhanced UI with dark forest green theme
- Responsive design for all screen sizes

### AI Assistant Integration
- Real-time chat interface with AI
- Contextual health and supplement advice
- Research-backed supplement information
- Interactive chat UI with loading states
- Simplified chat storage system
- Manual chat saving functionality
- Enhanced error handling for API interactions
- Improved response formatting

### User Interface
- Responsive dashboard layout
- Navigation header with user dropdown
- Professional dark forest green theme
- Mobile-friendly design
- Intuitive form layouts

### Legal Compliance & Privacy
- Comprehensive Terms of Service page
- Detailed Privacy Policy
- HIPAA-compliant data handling
- GDPR-compliant cookie consent mechanism:
  - User choice persistence
  - Accept/Decline options
  - Clear explanation of cookie usage
  - Link to Privacy Policy

## Current Development Status

### Active Development
1. Google OAuth Integration
   - Currently troubleshooting authentication issues
   - Callback URL configuration under review
   - Environment variables and secrets configuration needs verification

2. Email System
   - SendGrid integration functional with basic features
   - Basic email verification working
   - Enhanced functionality planned but low priority

3. Database Integration
   - Primary Database (NeonDB): ✅ Fully operational
     - Successfully handling user authentication
     - Managing health statistics
     - Storing user supplement selections
   - Secondary Database (RDS): Needs trouble shooting
     - storing supplement logs (connection failing)
     - Chat interaction logs with enhanced metadata
     - Autocomplete functionality for supplement search

### Known Issues
1. Google OAuth authentication experiencing authorization failures
2. Need to implement more comprehensive audit logging

## Next Steps

### Feature Enhancements
1. **Notifications System**
   - Implement supplement intake reminders
   - Add advanced email notifications
   - Push notifications for mobile devices

2. **Advanced Analytics**
   - Implement data visualization with Recharts
   - Add trend analysis for health metrics
   - Create supplement effectiveness reports

3. **Mobile Optimization**
   - Enhance responsive design
   - Add PWA capabilities
   - Implement mobile-specific features

4. **Pro Features & Payment System**
   - Initial Stripe payment integration implemented:
     - Direct payment links for subscription plans
     - Monthly ($21.99) and yearly ($184.72) options
     - Trial period tracking and display
   - Components implemented:
     - AccountInfo.tsx: Subscription status and payment UI
     - Profile page integration
   - Future enhancements planned:
     - Additional premium features
     - Enhanced data export capabilities
     - More payment CTAs throughout the application

### Technical Improvements
1. **Testing**
   - ✅ Implemented Jest testing framework with:
     - Unit tests for core services (summary, embedding, context)
     - Integration tests for OpenAI services
     - Test utilities for mock data and token estimation
     - Service initialization tests
   - Future improvements:
     - Frontend component tests
     - E2E testing
     - Expanded API integration tests 

2. **Performance**
   - Implement data caching
   - Optimize database queries
   - Add lazy loading for components

3. **Security**
   - Add 2FA support
   - Implement rate limiting
   - Enhanced HIPAA compliance measures

4. **Infrastructure**
   - Set up CI/CD pipeline
   - Add error monitoring
   - Implement comprehensive logging system

## Deployment Considerations
- Set up proper environment variables
- Configure production database
- Set up monitoring and logging
- Implement backup strategy
- Set up CDN for blog assets
- Implement proper SSL/TLS
- Configure proper CORS policies

This document reflects the current state of the application as of February 13, 2025, and serves as the primary reference for ongoing development and future enhancements.