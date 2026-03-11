<div align="center">
  <a href="http://nestjs.com/" target="_blank">
    <img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" />
  </a>
</div>

<br />

# Skillr Backend (NestJS Monorepo)

Skllr backend is a NestJS monorepo with multiple services and shared libraries.

## Prerequisites

- **Node.js**: 22.x
- **pnpm**: 10.x
- **PostgreSQL**: 16 (for local DB) or use Docker Compose below
- **Docker** (optional): for running Postgres + service containers

## Tools

![pnpm](https://img.shields.io/badge/pnpm-10.x-F69220?logo=pnpm&logoColor=white)
![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-22.x-339933?logo=node.js&logoColor=white)
![TypeORM](https://img.shields.io/badge/TypeORM-0.3-262627?logo=typeorm&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-5.x-DC382D?logo=redis&logoColor=white)
![Socket.io](https://img.shields.io/badge/Socket.io-4.x-010101?logo=socket.io&logoColor=white)
![AWS](https://img.shields.io/badge/AWS-SDK-232F3E?logo=amazon-aws&logoColor=white)
![JWT](https://img.shields.io/badge/JWT-auth-000000?logo=jsonwebtokens&logoColor=white)
![Passport](https://img.shields.io/badge/Passport-auth-34E27A?logo=passport&logoColor=white)
![Jest](https://img.shields.io/badge/Jest-test-C21325?logo=jest&logoColor=white)
![ESLint](https://img.shields.io/badge/ESLint-lint-4B32C3?logo=eslint&logoColor=white)

## Project Layout

```
skillr/
  apps/   # auth-service, course-service, reward-service
  libs/   # common, config, auth, shared
```

## Services & Ports

| Service | Command | Port |
|---|---|---:|
| auth | `pnpm run start:auth` | 3001 |
| course | `pnpm run start:course` | 3002 |
| reward | `pnpm run start:reward` | 3003 |

## Roles

This project uses 3 roles:
- `ADMIN`
- `STUDENT`
- `OWNER`

## Build Project

```bash
pnpm install
pnpm run build:all
```

## Quick Start (Dev)

```bash
pnpm install

# run migrations
pnpm run migration:run:<Name>

# start service
pnpm run start:<Name>
```

## Environment Setup

```dotenv
NODE_ENV=development
DATABASE_URL=postgresql://<USER>:<PASSWORD>@localhost:<PORT>/db_name?schema=public
```

Optional (Google OAuth):

```dotenv
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=localhost:<PORT>/auth/google/callback
```

## Docker / Compose

```bash
# Build and Start
docker compose up -d --build

# Logs
docker compose logs -f

# Stop and Remove Volumes
docker compose down -v
```

## API / Swagger

All services set `GlobalPrefix = /api` and expose Swagger at `/docs`.

  - Base URL: `http://localhost:<PORT>/api`
  - Swagger: `http://localhost:<PORT>/docs`

## Migrations

### Run Migrations

```bash
pnpm run migration:run:<Name>
```

### Generate Migrations

```bash
pnpm typeorm:<Name> migration:generate apps/<Name>-service/migrations/<MigrationName>
```

## Common Commands

```bash
pnpm run build:all
pnpm run lint
pnpm run test
pnpm run test:e2e
```

## Testing

Unit tests (runs all `*.spec.ts`):

```bash
pnpm run test
pnpm run test:<Name>
```

Run a specific spec file:

```bash
pnpm jest apps/<ServiceName>/src/.../something.spec.ts
```

E2E tests:

```bash
pnpm run test:e2e
```