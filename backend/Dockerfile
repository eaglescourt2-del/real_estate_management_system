# Stage 1: Build NestJS application
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Copy source code
COPY tsconfig*.json ./
COPY nest-cli.json ./
COPY src ./src/

# Generate Prisma Client and Build NestJS
RUN npx prisma generate
RUN npm run build

# Stage 2: Production Runtime
FROM node:20-alpine AS runner

WORKDIR /app

# Security: Non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

ENV NODE_ENV=production

# Install production dependencies
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --only=production && npx prisma generate

# Copy compiled artifacts from builder
COPY --from=builder /app/dist ./dist

# Create storage upload directory
RUN mkdir -p /app/uploads && chown -R nestjs:nodejs /app/uploads

USER nestjs

EXPOSE 4000

CMD ["sh", "-c", "npx prisma db push && node dist/src/main.js"]

