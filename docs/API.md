# HelpDesk API

Base URL:

```text
http://localhost:8080/api
```

All request and response bodies are JSON. All IDs are UUID strings.

## Authentication

Send the JWT from `POST /auth/login` in every protected request:

```http
Authorization: Bearer <token>
```

Tokens are valid for 60 minutes (`expiresIn` is in seconds). There are no refresh
tokens. The backend is stateless.

Roles: `ADMIN`, `EMPLOYEE`, `TECHNICIAN`.

Public endpoints: `POST /auth/register` and `POST /auth/login`. Everything else
requires a token.

## Error format

Every handled error uses the same shape:

```json
{
  "timestamp": "2026-11-22T20:30:00.123",
  "status": 400,
  "error": "Bad Request",
  "message": "Validation failed",
  "path": "/api/auth/register",
  "fieldErrors": {
    "email": "must be a well-formed email address",
    "password": "size must be between 8 and 72"
  }
}
```

`fieldErrors` is present only for Bean Validation failures.

| Status | Meaning |
|---|---|
| `400` | Invalid input, invalid enum value, malformed UUID, malformed JSON |
| `401` | Missing, invalid, expired, or disabled-account token |
| `403` | Authenticated but the role/ownership rule forbids the action |
| `404` | Entity does not exist, or is not visible to the current user |
| `409` | Duplicate email/category name, or deletion blocked by existing records |

Security failures also return JSON (never an HTML login page).

## Enums

```text
UserRole:       ADMIN, EMPLOYEE, TECHNICIAN
TicketStatus:   OPEN, IN_PROGRESS, WAITING_FOR_RESPONSE, RESOLVED, CLOSED
TicketPriority: LOW, MEDIUM, HIGH, CRITICAL
```

Enum values are case-sensitive and stored as strings.

---

# Authentication endpoints

## POST /auth/register

Public. Creates an Employee account and its Employee profile in one transaction.
The role is always `EMPLOYEE`; `role` and `enabled` in the body are ignored.

Request:

```json
{
  "fullName": "Mohamed Trabelsi",
  "email": "mohamed@company.com",
  "password": "ExamplePassword123",
  "department": "Human Resources",
  "phone": "+216 20 123 456"
}
```

Validation: `fullName` 3–100, valid `email`, `password` at least 8 characters,
`department` 2–100, `phone` optional up to 30 characters.

Response `201 Created`:

```json
{
  "id": "2f1c2e7a-8a44-4e1a-9f13-2e5d2f5d7a10",
  "fullName": "Mohamed Trabelsi",
  "email": "mohamed@company.com",
  "role": "EMPLOYEE",
  "enabled": true,
  "createdAt": "2026-11-22T20:30:00.123",
  "employee": {
    "id": "9a2c2e7a-1a44-4e1a-8f13-2e5d2f5d7a10",
    "department": "Human Resources",
    "phone": "+216 20 123 456"
  }
}
```

Errors: `400` validation, `409` email already registered.

## POST /auth/login

Public.

Request:

```json
{
  "email": "mohamed@company.com",
  "password": "ExamplePassword123"
}
```

Response `200 OK`:

```json
{
  "token": "<jwt>",
  "tokenType": "Bearer",
  "expiresIn": 3600,
  "user": {
    "id": "2f1c2e7a-8a44-4e1a-9f13-2e5d2f5d7a10",
    "fullName": "Mohamed Trabelsi",
    "email": "mohamed@company.com",
    "role": "EMPLOYEE"
  }
}
```

Errors: `401` wrong credentials or disabled account.

## GET /auth/me

Authenticated (any role). Returns safe account information plus the role-specific
profile when one exists.

Employee response `200 OK`:

```json
{
  "id": "2f1c2e7a-8a44-4e1a-9f13-2e5d2f5d7a10",
  "fullName": "Mohamed Trabelsi",
  "email": "mohamed@company.com",
  "role": "EMPLOYEE",
  "enabled": true,
  "createdAt": "2026-11-22T20:30:00.123",
  "employee": {
    "id": "9a2c2e7a-1a44-4e1a-8f13-2e5d2f5d7a10",
    "department": "Human Resources",
    "phone": "+216 20 123 456"
  }
}
```

A technician receives a `technician` object instead:

```json
{
  "id": "...",
  "fullName": "Ahmed Ben Ali",
  "email": "ahmed@helpdesk.com",
  "role": "TECHNICIAN",
  "enabled": true,
  "createdAt": "...",
  "technician": {
    "id": "...",
    "specialization": "Network Support",
    "availability": true
  }
}
```

An admin receives only the account fields.

---

# Employees

Employee profile management is **admin-only**. Employees read their own profile
through `GET /auth/me`.

## GET /employees

Admin. Response `200 OK`: array of Employee objects.

```json
[
  {
    "id": "...",
    "department": "IT",
    "phone": "+216 20 000 000",
    "user": {
      "id": "...",
      "fullName": "Employee A",
      "email": "employee@company.com",
      "role": "EMPLOYEE",
      "enabled": true,
      "createdAt": "..."
    }
  }
]
```

## GET /employees/{id}

Admin. `200` Employee, `404` if missing.

## PUT /employees/{id}

Admin. All fields are optional; only provided fields are changed. `enabled` is how
an admin disables or re-enables the account.

```json
{
  "fullName": "Employee A Updated",
  "email": "employee.updated@company.com",
  "department": "Operations",
  "phone": "+216 20 111 111",
  "enabled": true
}
```

`200` updated Employee. Errors: `400` validation, `404` missing, `409` email
already used by another account.

## DELETE /employees/{id}

Admin. `204 No Content` on success.

`409 Conflict` when the employee still has tickets or the linked user has authored
comments. Disable the account with `PUT` instead.

---

# Technicians

Management is **admin-only**, except that a technician may read their own profile.
`GET /technicians/available` is available to any authenticated user.

## POST /technicians

Admin. Creates the User with role `TECHNICIAN` and the linked profile. The body
cannot set a different role.

Request:

```json
{
  "fullName": "Ahmed Ben Ali",
  "email": "ahmed@helpdesk.com",
  "password": "TemporaryPassword123",
  "specialization": "Network Support",
  "availability": true
}
```

Response `201 Created`:

```json
{
  "id": "...",
  "specialization": "Network Support",
  "availability": true,
  "user": {
    "id": "...",
    "fullName": "Ahmed Ben Ali",
    "email": "ahmed@helpdesk.com",
    "role": "TECHNICIAN",
    "enabled": true,
    "createdAt": "..."
  }
}
```

Errors: `400` validation, `409` email already registered.

## GET /technicians

Admin. `200` array of Technician objects.

## GET /technicians/{id}

Admin, or the technician whose profile it is. `200` Technician, `403` for another
technician or an employee, `404` if missing.

## PUT /technicians/{id}

Admin. All fields optional.

```json
{
  "fullName": "Ahmed Ben Ali",
  "email": "ahmed.updated@helpdesk.com",
  "specialization": "Infrastructure",
  "availability": false,
  "enabled": true
}
```

`200` updated Technician. Errors: `400`, `404`, `409` email already used.

## DELETE /technicians/{id}

Admin. `204 No Content`.

`409 Conflict` when tickets are still assigned to the technician or the linked
user has authored comments. Unassign/reassign tickets first, or disable the
account with `PUT`.

## GET /technicians/available

Any authenticated role. Returns technicians with `availability: true`.

## GET /technicians/specialization?keyword=network

Admin. Case-insensitive substring search on specialization. Returns an array.

---

# Categories

Listing and reading require a token. Creating, updating, and deleting are
admin-only.

## POST /categories

Admin.

```json
{
  "name": "Hardware",
  "description": "Physical equipment issues"
}
```

`201 Created`:

```json
{
  "id": "...",
  "name": "Hardware",
  "description": "Physical equipment issues"
}
```

Validation: `name` 3–60, `description` optional up to 255. `409` duplicate name
(case-insensitive).

## GET /categories

Authenticated. `200` array of Category objects.

## GET /categories/{id}

Authenticated. `200` Category, `404` if missing.

## PUT /categories/{id}

Admin. Same body as create. `200` updated Category. `409` name used by another
category.

## DELETE /categories/{id}

Admin. `204 No Content`. `409` when tickets still use the category.

---

# Tickets

## Ticket object

```json
{
  "id": "...",
  "title": "Internet connection problem",
  "description": "The internet connection is unstable in office 2.",
  "status": "OPEN",
  "priority": "HIGH",
  "createdAt": "2026-11-22T20:30:00.123",
  "updatedAt": "2026-11-22T20:30:00.123",
  "employee": {
    "id": "...",
    "department": "IT",
    "phone": "...",
    "user": {
      "id": "...",
      "fullName": "Employee A",
      "email": "employee@company.com",
      "role": "EMPLOYEE",
      "enabled": true,
      "createdAt": "..."
    }
  },
  "technician": null,
  "category": {
    "id": "...",
    "name": "Network",
    "description": null
  }
}
```

When assigned, `technician` is a Technician object with its nested `user`.
Passwords are never included.

## POST /tickets

Employee only. The owning Employee is derived from the token; a client-supplied
`employee`, `status`, `technician`, `id`, or timestamps are ignored. New tickets
start `OPEN` and unassigned.

Request:

```json
{
  "title": "Internet connection problem",
  "description": "The internet connection is unstable in office 2.",
  "priority": "HIGH",
  "category": { "id": "2f1c2e7a-8a44-4e1a-9f13-2e5d2f5d7a10" }
}
```

Validation: `title` 5–100, `description` 10–2000, `priority` required, `category.id`
required. `201 Created` with the Ticket object. Errors: `400`, `403` for
admin/technician, `404` missing category.

## GET /tickets

Role-scoped list with pagination and sorting:

```http
GET /api/tickets?page=0&size=10&sort=createdAt,desc
```

- Admin: all tickets.
- Employee: only their own tickets.
- Technician: only tickets assigned to them.

Page numbers are zero-based. Default: page `0`, size `10`, sort `createdAt,desc`.

Response `200 OK`:

```json
{
  "content": [ /* Ticket objects */ ],
  "page": 0,
  "size": 10,
  "numberOfElements": 2,
  "totalElements": 2,
  "totalPages": 1,
  "first": true,
  "last": true,
  "sort": "createdAt: DESC"
}
```

An invalid `sort` field returns `400`.

## GET /tickets/{id}

Role-scoped. Admin sees any ticket; an employee only their own; a technician only
one assigned to them. Other users receive `404` so existence is not leaked.

## PUT /tickets/{id}

Admin or the owning employee. Only `title`, `description`, `priority`, and
`category` are editable. `status`, `technician`, and `employee` cannot be changed
here (dedicated endpoints exist for status/assignment).

```json
{
  "title": "Updated title",
  "description": "Updated description of the issue.",
  "priority": "CRITICAL",
  "category": { "id": "..." }
}
```

All fields are optional; only provided fields change. `200` updated Ticket.
Errors: `400`, `403` for technicians, `404` for another employee's ticket.

## DELETE /tickets/{id}

Admin only. Deletes the ticket **and its comments**. `204 No Content`.
`404` if missing, `403` for other roles.

## PATCH /tickets/{id}/status

Admin or the assigned technician.

```json
{
  "status": "IN_PROGRESS"
}
```

`200` updated Ticket. Any valid enum value is accepted. A technician who is not
assigned to the ticket gets `403`; an employee gets `403`; an invalid value gets
`400`.

## PATCH /tickets/{id}/assign/{technicianId}

Admin only. The technician must exist (`404` otherwise) and be available (`400`
otherwise).

`200` updated Ticket.

## PATCH /tickets/{id}/unassign

Admin only. Sets `technician` to `null`. `200` updated Ticket, `404` if missing.

## GET /tickets/status/{status}

Role-scoped, paginated. Example: `/api/tickets/status/OPEN?page=0&size=5`.
Invalid enum → `400`.

## GET /tickets/priority/{priority}

Role-scoped, paginated. Example: `/api/tickets/priority/HIGH?page=0&size=5`.
Invalid enum → `400`.

## GET /tickets/category/{categoryId}

Role-scoped, paginated. Missing category → `404`, malformed UUID → `400`.

## GET /tickets/technician/{technicianId}

Admin only, paginated. Missing technician → `404`.

## GET /tickets/employee/{employeeId}

Admin only, paginated. Missing employee → `404`.

## GET /tickets/search?keyword=internet

Role-scoped, paginated case-insensitive title search. The role scope is applied
before the search, so it never returns another user's tickets. An empty keyword
returns the normal role-scoped list.

All filter and search endpoints return the same page response shape as
`GET /tickets`.

---

# Comments

Comments are visible to anyone who may view the ticket (admin, owning employee,
assigned technician). The author is always the authenticated user; `author`,
`authorName`, and `authorType` in the body are ignored. **Admins cannot create
comments** (role table in the spec). Only the author can update or delete a
comment.

## POST /tickets/{ticketId}/comments

Owning employee or assigned technician.

```json
{
  "content": "The issue is still happening."
}
```

`201 Created`:

```json
{
  "id": "...",
  "content": "The issue is still happening.",
  "createdAt": "2026-11-22T20:35:00.123",
  "ticket": { /* full Ticket object */ },
  "author": {
    "id": "...",
    "fullName": "Employee A",
    "email": "employee@company.com",
    "role": "EMPLOYEE",
    "enabled": true,
    "createdAt": "..."
  }
}
```

Validation: `content` 2–1000. Errors: `400`, `403` for admin, `404` for an
outsider or missing ticket.

## GET /tickets/{ticketId}/comments

Anyone permitted to view the ticket. `200` array of Comment objects, newest first.
`404` if the ticket is missing or not visible.

## GET /comments/{id}

Role-scoped. `200` Comment; `404` if the comment or its ticket is not visible.

## PUT /comments/{id}

Comment author only.

```json
{
  "content": "Updated message."
}
```

`200` updated Comment. `403` for anyone else (including admins), `404` if missing.

## DELETE /comments/{id}

Comment author only. `204 No Content`. `403` for anyone else, `404` if missing.

---

# Access summary

| Action | Employee | Technician | Admin |
|---|---:|---:|---:|
| Register (public) | yes | no | no |
| Login | yes | yes | yes |
| Create ticket | yes | no | no |
| List/view own tickets | yes | no | no |
| List/view assigned tickets | no | yes | no |
| View/manage all tickets | no | no | yes |
| Update own ticket fields | yes | no | yes (any ticket) |
| Update status | no | assigned only | yes |
| Assign/unassign technician | no | no | yes |
| Delete ticket | no | no | yes |
| Add/list comments | own/assigned tickets | assigned tickets | list only |
| Update/delete comment | author only | author only | author only |
| Manage categories | no | no | yes |
| Manage employees | no | no | yes |
| Manage technicians | no | no | yes |
| Read own technician profile | no | yes | yes (any) |

## CORS

Allowed origins for local frontend development:

- `http://localhost:5173`
- `http://localhost:3000`

Allowed headers include `Authorization` and `Content-Type`; methods include
`GET`, `POST`, `PUT`, `PATCH`, `DELETE`, and `OPTIONS`.
