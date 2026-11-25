# HelpDesk

Academic mini project: an IT support ticket system with a Spring Boot REST API,
PostgreSQL running in Docker, and a React single-page frontend.

## Repository layout

```text
helpdesk-project/
├── backend/            Spring Boot REST API (Java 17, Spring Boot 3.5.16)
│   ├── scripts/
│   │   └── api-test.sh End-to-end HTTP test suite
│   ├── src/main/java/com/helpdesk/
│   │   ├── model/      Six entities + three enums
│   │   ├── repository/ Spring Data repositories
│   │   ├── controller/ REST controllers
│   │   ├── security/   JWT + Spring Security
│   │   └── exception/  Consistent JSON errors
│   ├── .env.example
│   ├── run.sh
│   └── pom.xml
├── frontend/           React 19 + Vite SPA (see frontend/README.md)
├── docs/
│   ├── PROJECT_SPEC.md The agreed project specification
│   └── API.md          API contract for the frontend developer
├── docker-compose.yml  PostgreSQL 16
└── README.md
```

## Prerequisites

- Java 17 or newer (`java -version`)
- Maven 3.9+ (`mvn -version`) — the Maven wrapper `backend/mvnw` is also included
- Node.js 20+ and npm (`node --version`, `npm --version`) for the frontend
- Docker with Docker Compose (`docker --version`, `docker compose version`)
- `curl` and `jq` for the API test script

On Linux, make sure your user can access Docker:

```bash
sudo systemctl start docker
sudo usermod -aG docker "$USER"   # log out/in once after this
```

## 1. Start PostgreSQL

From the project root:

```bash
docker compose up -d
docker compose ps
```

The container is `helpdesk-postgres`, database `helpdesk_db`, user `helpdesk`,
and data is stored in the named volume `helpdesk_data`. Wait for the health
status to become `healthy`.

Stop it without deleting data:

```bash
docker compose down
```

> Do **not** run `docker compose down -v` unless you intentionally want to delete
> the database volume.

## 2. Configure local secrets

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` and set a strong `JWT_SECRET`:

```bash
openssl rand -base64 48
```

You can also set the initial admin credentials:

```dotenv
JWT_SECRET=<your generated secret>
ADMIN_EMAIL=admin@helpdesk.com
ADMIN_PASSWORD=<a development password>
```

`backend/.env` is gitignored. The application reads
`app.jwt.secret=${JWT_SECRET}`; the secret is never hardcoded in source.

## 3. Run the backend

```bash
cd backend
./run.sh
```

`run.sh` loads `backend/.env` and starts Spring Boot on
`http://localhost:8080/api`.

On startup the application seeds, idempotently:

- one `ADMIN` user if no admin exists (from `ADMIN_EMAIL` / `ADMIN_PASSWORD`),
- the five suggested categories if the category table is empty.

### Default development admin

If `ADMIN_EMAIL` / `ADMIN_PASSWORD` are not set, the development defaults are:

- email: `admin@helpdesk.com`
- password: `Admin12345`

These credentials are for local development only.

## 4. Run the API tests

With PostgreSQL and the backend running:

```bash
cd backend
./scripts/api-test.sh
```

The script creates fresh users/tickets on every run, prints `PASS`/`FAIL` for
each check, and exits non-zero if anything fails. It also restarts the
PostgreSQL container near the end to verify that data survives a restart, so
expect a short database interruption during the run.

The suite covers authentication, role authorization, ownership scoping, CRUD,
validation, error status codes, pagination/sorting/filtering/search, comments,
deletion conflicts, BCrypt storage, CORS, and persistence.

## 5. Quick manual check

```bash
curl -s http://localhost:8080/api/auth/me
# -> 401 JSON error when no token is supplied

curl -s -H 'Content-Type: application/json' \
  -d '{"email":"admin@helpdesk.com","password":"Admin12345"}' \
  http://localhost:8080/api/auth/login
# -> token + user (admin only for the default dev credentials)
```

## 6. Run the frontend

With the backend running:

```bash
cd frontend
npm install
cp .env.example .env.local     # optional; defaults to http://localhost:8080/api
npm run dev                    # http://localhost:5173
```

The frontend pins port **5173**, which is the origin allowed by backend CORS.
Use `npm run build` for a production build and `npm run test:e2e` for the
Playwright suite (requires the backend, PostgreSQL, and
`npx playwright install chromium`). See [frontend/README.md](frontend/README.md)
for routes, architecture, role rules, and test details.

## API documentation

Full endpoint-by-endpoint documentation for the frontend developer:
[docs/API.md](docs/API.md).

CORS is enabled for `http://localhost:5173` and `http://localhost:3000` with the
`Authorization` and `Content-Type` headers.

## Useful database commands

```bash
# List tables
docker exec helpdesk-postgres psql -U helpdesk -d helpdesk_db -c '\dt'

# Open a psql shell
docker exec -it helpdesk-postgres psql -U helpdesk -d helpdesk_db
```

## Troubleshooting

- **Port 8080 already in use:** stop the other process or change `server.port`
  in `backend/src/main/resources/application.properties`.
- **`JWT_SECRET is not set`:** copy `.env.example` to `.env` and set the secret.
- **Docker permission denied:** add your user to the `docker` group and log in
  again, or start Docker with `sudo systemctl start docker`.
- **Database connection refused:** check `docker compose ps` and wait for the
  container to become `healthy`.
