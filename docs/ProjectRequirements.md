1. Project Requirements Document
Overview
This application is designed to help users track their supplementation—both quantitatively and qualitatively—while receiving personalized health insights and supplement recommendations via an integrated AI assistant (powered by OpenAI’s GPT-4). The system stores user health and supplement data, supports secure authentication (including 2FA), and complies with HIPAA requirements for handling health-related information.

Functional Requirements
User Management & Authentication
Registration & Email Verification:
Users register with their email, password, and basic contact information.
Email verification via SendGrid is required to activate the account.
Two-Factor Authentication (2FA):
2FA via email and/or SMS is supported.
Login/Logout:
Standard login and logout functionalities.
Session Management:
Managed using express-session with a memorystore.
User Onboarding & Profile Completion
Onboarding Flow:
Users provide basic contact details.
Users agree to Terms of Service.
Users complete a profile including basic health information.
A progress bar incentivizes full profile completion.
Supplement Regimen Input:
Users can input existing supplement regimens (dosages, frequencies).
Users may select supplements from a central database or add custom supplements (which remain user-specific unless added via the admin dashboard).
Supplement Management
CRUD Operations for Supplements:
Create, read, update, and delete supplements via dedicated API endpoints.
Supplement Metadata:
Store detailed information (name, dosage, frequency, start date, active status, etc.).
Admin Management:
An admin dashboard for managing the central supplement database.
Health Data Tracking
Health Metrics:
Users can input data (e.g., weight, sleep, heart rate, allergies) and import data from external sources (Apple Health, Oura, sleep trackers, etc.).
Daily Logging & Reminders:
Daily reminders (via email, SMS, or in-app notifications) prompt users to log their health data and supplement intake.
AI Assistant Integration
Chat Interface:
Users interact with an AI assistant via a chat interface.
LLM Integration:
Each interaction sends stored user progress and a system prompt to the OpenAI API (or similar provider) to provide personalized health insights and supplement recommendations.
Usage Limits:
Non-paying users have a daily limit (e.g., 10 sends per day).
Notifications & Reminders
Notification Channels:
Email (SendGrid), SMS, and in-app notifications.
Customization:
Users can set their preferred notification method and frequency.
Free Trial & Upsell:
A one-month free trial is provided with several notifications and calls-to-action encouraging paid signup.
Non-Functional Requirements
Security & Compliance
HIPAA Compliance:
The application is designed to comply with HIPAA standards due to the sensitive health-related data.
Security Measures:
Use of Helmet, express-rate-limit, express-slow-down, and input sanitization.
Passport.js is used for authentication.
Data Protection:
Secure session management via express-session with a memory store.
Rate limiting and request throttling are applied to APIs.
Performance & Scalability
Scalability:
The architecture (React frontend, Express backend, PostgreSQL database) supports horizontal scaling.
Performance:
Use of caching where applicable (e.g., TanStack Query) and efficient DB operations with Drizzle ORM.
Real-Time Capabilities:
WebSocket (ws) support for real-time notifications and features.
Usability & Maintainability
Responsive UI:
React with Tailwind CSS and shadcn/ui components for a modern, responsive interface.
Developer Experience:
TypeScript is used across the stack to improve maintainability and reduce runtime errors.
Clear API documentation and modular code organization for ease of maintenance.