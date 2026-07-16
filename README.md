# Luisardito Shop - Backend

Node.js REST API for a gamified points and rewards system with Kick streaming integration, Discord integration, and real-time redemption features.

[![License](https://img.shields.io/badge/License-Proprietary-red.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-green)](https://nodejs.org/)
[![MySQL](https://img.shields.io/badge/MySQL-8.0-blue)](https://www.mysql.com/)

## Tech Stack

- Runtime: Node.js 20.x (as used in the Dockerfile and CI workflow)
- Framework: Express 5.1
- Database: MySQL 8.0 with Sequelize 6.37 ORM (mysql2 driver)
- Cache: Redis 7-alpine (ioredis client)
- Authentication: JWT (jsonwebtoken) plus OAuth 2.0 with Kick and Discord
- Image storage: Cloudinary 2.8
- Chat bot: discord.js 14 and a Kick bot client (ws, axios)
- Scheduled tasks: node-cron 4.2
- PDF generation: pdfkit 0.17
- Password hashing: bcryptjs 3.0
- Containerization: Docker and Docker Compose

## Prerequisites

- Node.js 20.x
- npm (ships with Node.js)
- Docker and Docker Compose (for the MySQL and Redis containers)
- A Kick OAuth application (client ID, secret, redirect URI) and a Discord application (bot token, client ID/secret, guild ID) if you intend to use those integrations

## Local Development Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the environment template and fill in your values. `.env.example` is the single source of truth for environment variables read by `config.js`:

   ```bash
   cp .env.example .env
   ```

   For local development you may also create a `.env.development` file, which `config.js` loads with priority when present.

3. Start the MySQL and Redis containers in the background:

   ```bash
   docker-compose up db redis -d
   ```

4. Run migrations and seeders:

   ```bash
   npm run migrate
   npm run seed
   ```

   The `npm run dev:setup` script combines the container start, migrate, and seed steps. `npm run dev:reset` additionally tears down volumes and recreates the database from scratch.

5. Start the API in development mode with hot reload:

   ```bash
   npm run dev
   ```

   The server listens on `http://localhost:3000` by default (the `PORT` env var). A liveness endpoint is available at `GET /health`.

## Available Scripts

The npm scripts defined in `package.json`:

- **`start`** - Run the server with `node app.js`.
- **`dev`** - Run the server with `nodemon` for hot reload during development.
- **`dev:local`** - Run with `NODE_ENV=development` and nodemon.
- **`dev:setup`** - Start the `db` container, then run migrations and seeders.
- **`dev:reset`** - Tear down containers and volumes, recreate the `db` container, then migrate and seed.
- **`migrate`** - Run pending Sequelize migrations.
- **`migrate:status`** - Show migration status.
- **`migrate:undo`** - Roll back the most recent migration.
- **`migrate:undo:all`** - Roll back all migrations.
- **`seed`** - Run all seeders.
- **`seed:undo`** - Undo all seeders.
- **`setup-db`** - Run `migrate` then `seed`.
- **`reset-db`** - Undo all migrations, then run `setup-db`.
- **`docker:dev`** - Build and start the full development stack with Docker Compose.
- **`docker:dev:down`** - Stop and remove the development Docker Compose stack.
- **`docker:dev:logs`** - Tail logs for the `api` service.
- **`docker:db`** - Start only the `db` container in the background.
- **`sync:migrations`** - Run the PowerShell helper `scripts/sync-migrations.ps1`.
- **`reauth-bot`** - Run the Kick bot re-authentication helper `scripts/reauth-bot.js`.
- **`lint`** - Run ESLint across the project.
- **`lint:fix`** - Run ESLint with `--fix`.
- **`format`** - Format the project with Prettier (`--write`).
- **`format:check`** - Check formatting with Prettier (`--check`) without writing.
- **`test`** - Placeholder script; no test suite is currently defined.

## Code Quality Tooling

Linting and formatting are run locally via ESLint and Prettier. There is no CI step that runs ESLint; the CI workflow only runs `npm test` and a Docker build (see below). Use the local scripts to enforce style:

```bash
npm run lint
npm run format:check
npm run format
```

## GitHub Actions Workflows

Two workflow files exist in `.github/workflows/`:

- **CI (`ci.yml`)** - Triggers on pushes to `dev` and pull requests to `dev` or `main`. It runs `npm ci`, `npm test` (currently a placeholder with no test suite), and a `docker build` of the image. It does **not** run ESLint.
- **Production CD (`prod-cd.yml`)** - Triggers on pushes to `main`. It validates production SSH and GitHub secrets, writes a production `.env` on the VPS, and deploys the stack with `docker compose` using `docker-compose.yml` and `docker-compose.prod.yml`.

## Docker Compose

The base `docker-compose.yml` defines three services:

- **db** - MySQL 8.0 with a persistent volume and a health check.
- **redis** - Redis 7-alpine with a persistent volume and a health check.
- **api** - The Node.js application built from the Dockerfile, depending on `db` and `redis` being healthy.

Development overrides live in `docker-compose.override.yml` (hot reload, published ports, development env) and production overrides in `docker-compose.prod.yml` (production env file, restart policy, host port mapping). Compose applies the override file automatically in development; production deploys pass both files explicitly.

## Project Structure

```
src/
  config/        Cloudinary and Redis configuration
  controllers/   Request handlers for each route group
  middleware/    Auth, authorization, CORS, and validation middleware
  models/        Sequelize models and the database connection
  routes/        Express route definitions
  services/      Business logic, scheduled tasks, and bot services
  utils/         Shared helpers (logger, Kick API client, etc.)
migrations/      Sequelize migration files
seeders/         Sequelize seed files
scripts/         Operational helper scripts
app.ts           Express application entrypoint
config.ts        Environment-driven configuration
```

## License

Proprietary. Copyright (c) 2026 NaferJ. All rights reserved. This software and its source code are the exclusive property of NaferJ. Unauthorized use, copying, distribution, modification, or publication, in whole or in part, is strictly prohibited without express written permission from the owner. See [LICENSE](LICENSE) for the full text.

## Author

**NaferJ**

GitHub: https://github.com/NaferJ
Production: https://shop.luisardito.com

Frontend repository: [NaferJ/luisardito-shop-frontend](https://github.com/NaferJ/luisardito-shop-frontend)
