# syntax=docker/dockerfile:1

# ---- Base ----
FROM oven/bun:1-alpine AS base
WORKDIR /app

# ---- Dependencies ----
FROM base AS deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# ---- Build ----
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time environment variables (required for Next.js build)
ARG DATABASE_URL
ARG BETTER_AUTH_SECRET
ARG HC_IDENTITY_HOST
ARG HC_IDENTITY_CLIENT_ID
ARG HC_IDENTITY_CLIENT_SECRET
ARG HC_IDENTITY_REDIRECT_URI

ENV DATABASE_URL=${DATABASE_URL}
ENV BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET}
ENV HC_IDENTITY_HOST=${HC_IDENTITY_HOST}
ENV HC_IDENTITY_CLIENT_ID=${HC_IDENTITY_CLIENT_ID}
ENV HC_IDENTITY_CLIENT_SECRET=${HC_IDENTITY_CLIENT_SECRET}
ENV HC_IDENTITY_REDIRECT_URI=${HC_IDENTITY_REDIRECT_URI}

# Disable Next.js telemetry
ENV NEXT_TELEMETRY_DISABLED=1

RUN bun run build

# ---- Production ----
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone build and static assets
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["bun", "server.js"]
