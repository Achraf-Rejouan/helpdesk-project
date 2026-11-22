# HelpDesk

Academic mini project: an IT support ticket system with a Spring Boot backend and a
PostgreSQL database running in Docker. The React frontend will be added separately.

## Repository layout

```text
helpdesk-project/
├── backend/            Spring Boot REST API
├── frontend/           Placeholder for the React application
├── docs/
│   ├── PROJECT_SPEC.md The agreed project specification
│   └── API.md          API contract for the frontend developer
├── docker-compose.yml  PostgreSQL 16
└── README.md
```

## Prerequisites

- Java 17+
- Maven 3.9+ (or use the bundled `backend/mvnw`)
- Docker with Docker Compose
- `curl` and `jq` for the API test script

## 1. Start PostgreSQL

From the project root:

```bash
docker compose up -d
docker compose ps
```

The container is `helpdesk-postgres`; data is kept in the named volume
`helpdesk_data`. Do **not** run `docker compose down -v` unless you intend to
delete the database.

## 2. Configure secrets

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` and set a strong `JWT_SECRET` (for example
`openssl rand -base64 48`), plus the admin email/password you want seeded on
first startup. `.env` is gitignored.

The application reads `JWT_SECRET` through `app.jwt.secret=${JWT_SECRET}`.

## 3. Run the backend

```bash
cd backend
./run.sh
```

`run.sh` loads `backend/.env` and starts Spring Boot on
`http://localhost:8080/api`.

On startup the application seeds:

- one `ADMIN` account if no admin exists (from `ADMIN_EMAIL` / `ADMIN_PASSWORD`),
- the five suggested categories if the category table is empty.

Both seeds are idempotent.

## 4. Run the API tests

With PostgreSQL and the backend running:

```bash
cd backend
./scripts/api-test.sh
```

The script prints PASS/FAIL for each check, exits non-zero on failure, and ends
by restarting PostgreSQL to verify that data survives a container restart.

## Default development admin

If `ADMIN_EMAIL` / `ADMIN_PASSWORD` are not set, the development defaults are:

- email: `admin@helpdesk.com`
- password: `Admin12345`

These defaults are for local development only.

## API documentation

See [docs/API.md](docs/API.md).
