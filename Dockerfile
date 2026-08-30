# EDEN - Visual AI Graph IDE
# Multi-stage build for Angular SSR + Express Backend

# ============================================
# Stage 1: Builder
# ============================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install git (needed for npm packages)
RUN apk add --no-cache git python3 make g++

# Copy package files
COPY package*.json ./
COPY angular.json ./

# Install all dependencies
RUN npm install --legacy-peer-deps

# Copy all source files
COPY . .

# Build Angular application with SSR
RUN npm run build

# ============================================
# Stage 2: Production
# ============================================
FROM node:20-alpine AS production

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm install --only=production --legacy-peer-deps

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Copy server files
COPY --from=builder /app/src/server ./src/server
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/nginx.conf ./

# Create data directory
RUN mkdir -p /app/data && \
    mkdir -p /app/ssl && \
    mkdir -p /app/logs

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 4000

# Environment variables
ENV NODE_ENV=production
ENV PORT=4000
ENV GEMINI_API_KEY=""
ENV LOCAL_MODEL=qwen2.5-coder
ENV LOCAL_API_URL=http://localhost:11434/api/generate
ENV AI_TIMEOUT_MS=120000
ENV JWT_SECRET=""

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/api/health || exit 1

# Start server
CMD ["node", "dist/server/server.mjs"]
