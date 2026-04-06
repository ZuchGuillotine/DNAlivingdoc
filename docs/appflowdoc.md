2. Tech Stack Document
Frontend Technologies
Framework: React 18 with TypeScript
UI Components: shadcn/ui (based on Radix UI primitives)
Styling: Tailwind CSS
State Management: TanStack Query (formerly React Query)
Routing: Wouter
Build Tool: Vite
Backend Technologies
Runtime: Node.js with TypeScript
Server Framework: Express.js
Authentication: Passport.js with local strategy
Security Middleware: Helmet, express-rate-limit, express-slow-down
Database: PostgreSQL
ORM: Drizzle ORM
Schema Validation: Drizzle-zod for type-safe schemas
Third-Party Services & Libraries
Email Service:
SendGrid for email delivery (verification emails, notifications)
AI/LLM Integration:
OpenAI API (GPT-4) for health insights and supplement recommendations
Security & Session Management:
express-session with memorystore
express-rate-limit for API protection
express-slow-down for DDoS protection
Additional Libraries:
date-fns for date manipulation
recharts for data visualization
framer-motion for animations
zod for runtime type validation
ws for WebSocket support
3. App Flow Document
User Journey Overview
User Onboarding & Registration:

Step 1: User lands on the onboarding page.
Step 2: User inputs basic contact details and agrees to the Terms of Service.
Step 3: User registers by providing an email and password.
Step 4: An email verification link is sent via SendGrid.
Step 5: Once verified, the user is prompted to complete their profile with additional health information and existing supplementation details.
Step 6: A progress bar is shown to incentivize full profile completion.
Profile Completion & Data Input:

Health Data Entry:
Input fields for health stats (e.g., weight, sleep patterns, heart rate, allergies).
Optional integration/import from Apple Health, Oura, sleep trackers, etc.
Supplement Data Entry:
Users select supplements from a central database or add custom supplements.
Supplement details include dosage, frequency, and meta information.
Dashboard & Main Application:

Main Dashboard:
Overview of health stats and supplement logs.
Visualization of trends using recharts.
Supplement Management:
View, add, update, or delete supplement entries.
Health Data Logging:
Daily logging prompts (notifications via in-app/email/SMS based on user preferences).
AI Health Assistant Interaction:

Chat Interface:
Users interact with the AI assistant (LLM) via a chat interface.
Interaction Flow:
Each chat session begins with a system prompt explaining the assistant’s role.
User-specific progress data is passed to the LLM to provide personalized recommendations.
Usage Limitation:
Daily chat limit (10 sends) for non-paying users.
Notifications & Reminders:

Notification Settings:
Users set preferences for receiving reminders (email, SMS, in-app).
Scheduled Reminders:
Automated notifications remind users to log health data and supplement intake.
Trial Period & Upsell:
Users on a one-month free trial receive periodic notifications encouraging paid signup.
Admin Dashboard:

Supplement Database Management:
Admins manage the central supplement database (approval and editing of new supplements).
User Management:
Tools for managing user accounts and reviewing health data logs as needed.
