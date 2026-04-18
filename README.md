# Pocket Drive — LINE Google Drive Bot

Bun + ElysiaJS webhook server that lets LINE users upload images/files to their own Google Drive via OAuth2.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [Development](#development)
- [Docker (Local)](#docker-local)
- [Production](#production)
- [API Endpoints](#api-endpoints)

---

## Prerequisites

- [Bun](https://bun.sh) >= 1.3
- [Docker](https://www.docker.com) & Docker Compose
- LINE Messaging API channel ([LINE Developers](https://developers.line.biz))
- Google Cloud project with OAuth2 credentials and Drive API enabled

---

## Installation

```bash
# Clone the repository
git clone <repo-url>
cd pocket-drive

# Install dependencies
bun install
```

---

## Environment Variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `NODE_ENV` | `development` or `production` |
| `PORT` | Server port (default: `3000`) |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Messaging API access token |
| `LINE_CHANNEL_SECRET` | LINE channel secret (used for webhook signature verification) |
| `GOOGLE_CLIENT_ID` | Google OAuth2 client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth2 client secret |
| `GOOGLE_REDIRECT_URI` | OAuth2 redirect URI (e.g. `http://localhost:3000/auth/callback`) |
| `DATABASE_URL` | PostgreSQL connection string |

### Google OAuth2 Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials
2. Create an **OAuth 2.0 Client ID** (type: Web application)
3. Add your redirect URI to **Authorized redirect URIs**
4. Enable the **Google Drive API** in APIs & Services → Library

### LINE Webhook Setup

Set the webhook URL in your LINE channel settings to:
```
https://<your-domain>/webhook
```

---

## Database Setup

### Local (Docker)

Start the local PostgreSQL container first (see [Docker (Local)](#docker-local)), then push the schema:

```bash
bun run db:push
```

This creates the `users` and `google_tokens` tables via Drizzle Kit.

### Re-apply after schema changes

Whenever you modify `src/db/schema.ts`, run:

```bash
bun run db:push
```

---

## Development

1. Start the local database:

```bash
docker compose up -d
```

2. Copy and fill in your `.env`:

```bash
cp .env.example .env
```

3. Push the schema:

```bash
bun run db:push
```

4. Start the dev server with hot reload:

```bash
bun run dev
```

The server runs at **http://localhost:3000**.

### Other dev commands

```bash
bun run lint        # Lint TypeScript files
bun run lint:fix    # Auto-fix lint errors
bun run format      # Format with Prettier
bun run clean       # Remove node_modules, lockfile, and dist
```

---

## Docker (Local)

Starts a PostgreSQL 15 container with data persisted in `./pgdata`:

```bash
docker compose up -d
```

| Service | Port | Credentials |
|---|---|---|
| PostgreSQL | `5432` | `user` / `password` / `line_bot_db` |

Stop the container:

```bash
docker compose down
```

---

## Production

### 1. Create the production environment file

```bash
cp .env.example .env.production
```

Edit `.env.production` with your production values. Required extras for the production Compose stack:

```env
NODE_ENV=production
POSTGRES_USER=<db_user>
POSTGRES_PASSWORD=<db_password>
POSTGRES_DB=<db_name>
DATABASE_URL=postgres://<db_user>:<db_password>@db:5432/<db_name>
GOOGLE_REDIRECT_URI=https://<your-domain>/auth/callback
```

> `DATABASE_URL` must use `db` as the hostname to resolve within the Docker network.

### 2. Build and start

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

### 3. Push the schema (first deploy only)

```bash
DATABASE_URL=<your-prod-url> bun run db:push
```

Or exec into the running container:

```bash
docker exec -it line_bot_app_prod bun run db:push
```

### Production ports

| Service | Host port | Container port |
|---|---|---|
| App | `3111` | `3000` |
| PostgreSQL | `5111` | `5432` |

### View logs

```bash
docker compose -f docker-compose.prod.yml logs -f app
```

### Stop

```bash
docker compose -f docker-compose.prod.yml down
```

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/` | Health check |
| `GET` | `/health` | Uptime + timestamp |
| `POST` | `/webhook` | LINE webhook receiver |
| `GET` | `/auth/callback` | Google OAuth2 redirect handler |

Create with ❤️ DKKs