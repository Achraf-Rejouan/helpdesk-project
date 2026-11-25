# HelpDesk frontend

React 19 + Vite single-page application for the HelpDesk ticket system. It talks
to the real Spring Boot API and implements the employee, technician, and
administrator workflows described in `../docs/PROJECT_SPEC.md` and
`../docs/API.md`.

## Stack

| Package | Version |
| --- | --- |
| React / React DOM | 19.3.1 |
| Vite | 8.3.8 |
| react-router-dom | 7.18.7 |
| Axios | 1.21.1 |
| @playwright/test | 1.65.1 |

No Redux and no UI framework. Auth state is a React context, and all HTTP calls
live in `src/api/`.

## Quick start

Prerequisites: Node.js 20+ and the backend running on
`http://localhost:8080/api` (see the root `README.md`).

```bash
cd frontend
npm install
cp .env.example .env.local     # optional; the default is already localhost:8080/api
npm run dev                    # http://localhost:5173
```

`VITE_API_URL` must include the `/api` suffix. The dev server is pinned to port
**5173** because that is the origin allowed by the backend CORS configuration.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start Vite on port 5173 |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Preview the production build on port 5173 |
| `npm run lint` | Run oxlint |
| `npm run test:e2e` | Run the Playwright suite against the running backend |
| `npm run test:e2e:ui` | Open the Playwright UI runner |

## Routes

| Route | Access | Page |
| --- | --- | --- |
| `/login` | Public (redirects signed-in users home) | Login |
| `/register` | Public (redirects signed-in users home) | Employee registration |
| `/` | Any | Role-based redirect |
| `/employee/dashboard` | Employee | Scoped ticket counts and recent tickets |
| `/employee/tickets` | Employee | Own tickets with paging/sort/search/filter |
| `/employee/tickets/new` | Employee | Create a ticket |
| `/technician/dashboard` | Technician | Assigned ticket counts and recent tickets |
| `/technician/tickets` | Technician | Assigned tickets with paging/sort/search/filter |
| `/admin/dashboard` | Administrator | System-wide ticket counts and recent tickets |
| `/admin/tickets` | Administrator | All tickets with paging/sort/search/filter |
| `/admin/employees` | Administrator | Edit, disable/enable, delete employees |
| `/admin/technicians` | Administrator | Create/edit/delete, availability, specialization search |
| `/admin/categories` | Administrator | Create/edit/delete categories |
| `/tickets/:id` | Owner, assigned technician, or administrator | Shared ticket details and comments |
| `/forbidden` | Signed-in users | 403 page for role-guard violations |
| `*` | Anyone | 404 page |

Unknown or unreadable tickets render a friendly “not available” state rather
than exposing whether the ticket exists.

## Structure

```text
frontend/
├── e2e/                    Playwright specs and API helpers
├── public/
├── src/
│   ├── api/
│   │   ├── client.js       Axios instance, token storage, 401 handling, error helpers
│   │   └── endpoints.js    One wrapper per API endpoint
│   ├── components/
│   │   ├── AppLayout.jsx   Navbar, layout, reusable ticket table
│   │   ├── ProtectedRoute.jsx  Auth/role guards and home redirect
│   │   └── UI.jsx          Spinner, states, banners, badges, pagination, modal, confirm
│   ├── context/
│   │   └── AuthContext.jsx Login, register, logout, session restore via /auth/me
│   ├── pages/              Route-level pages
│   ├── utils.js            Role homes, enum labels, dates, form validators
│   ├── App.jsx             Route table
│   ├── main.jsx            Providers and router bootstrap
│   └── styles.css          Application styling
├── .env.example
├── playwright.config.js
└── vite.config.js
```

### Auth and errors

- The JWT is stored in `localStorage` (`helpdesk_token`); the cached user is
  stored alongside it (`helpdesk_user`).
- Every request sends `Authorization: Bearer <token>`.
- On startup, a stored token is validated with `GET /auth/me`, so role profiles
  (`employee.id`, `technician.id`) are available for ownership checks.
- Any `401` clears storage, emits `helpdesk:unauthorized`, and redirects to
  `/login`. Login and registration failures are shown inline instead.
- Backend `message` values are shown in error banners, and `fieldErrors` are
  mapped to the matching form inputs. `400`, `401`, `403`, `404`, and `409` all
  have dedicated UI paths.

### Role rules enforced by the UI

- Employees see and act on their own tickets only; they can edit title,
  description, priority, and category, and manage their own comments.
- Technicians see only tickets assigned to them; they can update the status of
  assigned tickets and comment on them.
- Administrators see every ticket, can assign/unassign, change status, and delete
  tickets, but cannot create tickets or post comments.
- Ticket lists respect the backend's single-filter endpoints: applying a status,
  priority, category, employee, or technician filter clears the other filters.

## End-to-end tests

The suite uses real HTTP calls and a real browser; it is not mocked. Start the
backend and PostgreSQL first, then:

```bash
cd frontend
npx playwright install chromium   # first run only
npm run test:e2e
```

The specs create unique timestamped employees, technicians, categories, and
tickets through the API, so the suite can be re-run without cleaning the
database. They cover registration/login, session restore, role redirects and
guards, dashboard counts, pagination/sorting/search/filters, employee and
technician workflows, administrator CRUD and conflicts, disabled-user `401`
logout, and confirmation dialogs.

`playwright.config.js` reuses an existing Vite server on port 5173 when one is
already running. Set `ADMIN_EMAIL` / `ADMIN_PASSWORD` to override the default
development administrator credentials; the helper also reads `backend/.env` if
present.

## Notes and limitations

- The backend has no aggregate statistics endpoint. Dashboard cards therefore
  issue one `GET .../tickets...?size=1` request per counter and read
  `totalElements`.
- The API supports exactly one ticket filter per request, so the UI deliberately
  offers single-select filters rather than a combined filter form.
- Enum values are sent as-is but displayed with friendly labels (for example
  `WAITING_FOR_RESPONSE` → “Waiting for response”).
- Employee and technician profile IDs are kept distinct from user IDs when
  calling `/tickets/employee/{id}` and `/tickets/technician/{id}`.
