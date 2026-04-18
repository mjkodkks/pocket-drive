# ── Build stage ──────────────────────────────────────────────────────────────
FROM oven/bun:1.3-alpine AS builder
WORKDIR /app

COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile

COPY src/ ./src/
COPY drizzle.config.ts tsconfig.json ./

# ── Production stage ──────────────────────────────────────────────────────────
FROM oven/bun:1.3-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy only what's needed at runtime
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/package.json ./
COPY --from=builder /app/drizzle.config.ts ./

USER bun
EXPOSE 3000

CMD ["bun", "run", "src/index.ts"]
