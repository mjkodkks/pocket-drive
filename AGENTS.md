# LINE Google Drive Bot — Agent Instructions

## Project Overview
Bun + ElysiaJS webhook server that lets LINE users upload images/files to their own Google Drive via OAuth2. Uses Drizzle ORM + PostgreSQL for persisting users and tokens.

## Tech Stack
- **Runtime**: Bun
- **Framework**: Elysia
- **ORM**: Drizzle ORM (`drizzle-orm/postgres-js`)
- **DB**: PostgreSQL 15
- **APIs**: LINE Messaging API (`@line/bot-sdk`), Google Drive API (`googleapis`)

## Commands
```bash
bun install          # Install dependencies
bun run dev          # Start dev server with hot reload (port 3000)
bun run db:push      # Push schema to database (run after schema changes)
docker compose up -d # Start local PostgreSQL
```

## Project Structure
```
src/
  index.ts          # Elysia app, POST /webhook and GET /auth/callback
  google-drive.ts   # OAuth2 client, token refresh, folder management
  db/
    index.ts        # Drizzle client (postgres-js driver)
    schema.ts       # users + google_tokens tables
drizzle.config.ts   # Drizzle Kit config (dialect: postgresql)
docker-compose.yml  # Local PostgreSQL service
.env.example        # Required environment variables
```

## Environment Variables
Copy `.env.example` → `.env` and fill in values:
- `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_CHANNEL_SECRET`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- `DATABASE_URL` (default: `postgres://user:password@localhost:5432/line_bot_db`)

## Architecture
- `/webhook` – Receives LINE events, checks DB for Google token, uploads file stream directly to Drive
- `/auth/callback` – OAuth2 redirect; exchanges code for tokens, upserts `users` + `google_tokens` in a transaction
- `getAuthenticatedClient()` – Loads token from DB, auto-refreshes if within 5 minutes of expiry
- `getOrCreateFolder()` – Caches `googleFolderId` on user row to avoid repeated Drive API calls

## Conventions
- Use `drizzle-orm/pg-core` column helpers for any schema changes
- Token upserts use `.onConflictDoUpdate({ target: googleTokens.userId, ... })` — keep this pattern
- DB writes in `/auth/callback` must stay inside `db.transaction()`
- Do not buffer file content in memory; pass stream directly from `lineBlobClient.getMessageContent()` to `drive.files.create()`
- After modifying `src/db/schema.ts`, always run `bun run db:push`

## Known Limitations / Pitfalls
- No handling for stale `googleFolderId` if user deletes the Drive folder manually
- No file size or type validation on uploads
- `LINE_CHANNEL_SECRET` is in `.env.example` but not used for webhook signature verification — add if exposing publicly
