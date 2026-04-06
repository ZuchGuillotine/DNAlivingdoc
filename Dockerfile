# Stage 1: Build the application
FROM node:20-alpine AS builder
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev deps for build)
RUN npm ci

# Copy source code
COPY . .

# Build the application - this builds startup.ts as the entry point
RUN npm run build

# Stage 2: Runtime
FROM node:20-alpine AS runtime
WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Copy package files and install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Copy necessary runtime files (if they exist)
COPY --from=builder /app/certs ./certs 2>/dev/null || true

# Set certificate permissions if they exist
RUN chmod 644 /app/certs/*.pem 2>/dev/null || echo "Certificate files not found, continuing..."

# Expose port 8080 to match App Runner expectations
EXPOSE 8080

# Use startup.js as the entry point (built from startup.ts)
CMD ["sh", "-c", "echo 'Starting StackTracker application...' && echo 'NODE_ENV:' $NODE_ENV && echo 'PORT:' $PORT && node dist/server/startup.js"]