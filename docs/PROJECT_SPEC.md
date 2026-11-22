# HelpDesk — Project Specification

**Project type:** Academic mini project  
**Backend:** Java + Spring Boot  
**Frontend:** React JS  
**Database:** PostgreSQL (Docker)  
**Architecture:** Simple MVC — Model, Repository, Controller  
**Authentication:** Spring Security + JWT (minimal implementation)  
**Specification status:** Updated and agreed baseline before implementation

---

## 1. Project Overview

HelpDesk is a web application for managing IT support requests inside an organization.

Employees submit technical issues as tickets. Each ticket belongs to a category, may be assigned to a technician, and moves through a simple status workflow. Employees and technicians can communicate through ticket comments. Users authenticate with email and password, and the application applies permissions according to their role.

The project is intentionally academic and lightweight. Its purpose is to demonstrate Spring Boot, Spring Data JPA, Hibernate, REST APIs, relational mapping, validation, pagination, sorting, custom repository methods, and basic authentication/authorization.

### Main goals

- Manage users, employee profiles, technician profiles, categories, tickets, and comments.
- Provide CRUD operations appropriate to each resource.
- Support employee registration and login.
- Support administrator-managed technician accounts.
- Apply basic role-based access control.
- Support ticket assignment and status updates.
- Validate incoming data.
- Support pagination, sorting, filtering, and searching for tickets.
- Persist data in PostgreSQL running in Docker.
- Provide a React frontend that consumes the REST API.

---

## 2. Confirmed Project Decisions

These decisions are fixed and must be respected during implementation:

1. **Six JPA entities:** `User`, `Employee`, `Technician`, `Category`, `Ticket`, and `Comment`.
2. **User accounts:** Every Employee and Technician has one `User` account. An Administrator is a `User` with the `ADMIN` role and does not need a separate profile entity.
3. **Roles:** `ADMIN`, `EMPLOYEE`, and `TECHNICIAN`.
4. **Registration:** Public registration creates an Employee account only. The role is assigned by the backend and must never be accepted from the public registration request.
5. **Technician accounts:** An Admin creates technician accounts and assigns the `TECHNICIAN` role. A public user cannot promote themselves to Technician or Admin.
6. **Admin bootstrap:** The initial Admin account is created through a simple seed/initialization process, not through public registration.
7. **Authentication:** Use Spring Security and JWT with a minimal stateless setup. Do not use Keycloak, OAuth2, refresh tokens, or advanced identity-provider features.
8. **Password storage:** Store only BCrypt password hashes, never plain-text passwords.
9. **IDs:** Use `UUID` identifiers for all six entities.
10. **JPA relationships:** Keep relationships unidirectional unless an inverse relationship is genuinely required. Do not add convenience collections.
11. **Architecture:** Keep the application simple: `model`, `repository`, `controller`, plus a small `security` package and an `exception` package. Do not add Service, DTO, or Mapper layers.
12. **Enums:** Put every enum in the `model` package. Do not create a separate `enums` package. Keep each enum in its own Java file.
13. Keep code straightforward, readable, and appropriate for an academic mini project. Do not introduce production-level complexity without a clear requirement.

---

## 3. Scope

### Included

- Employee self-registration and login.
- JWT authentication and basic role-based authorization.
- Admin management of technician accounts.
- Employee and technician profiles linked to User accounts.
- Category CRUD.
- Ticket CRUD and ticket assignment/status operations.
- Comment creation and listing for tickets.
- Ticket pagination, sorting, filtering, and title search.
- Bean Validation.
- Basic, consistent HTTP error responses.
- React integration with role-specific navigation/pages.
- PostgreSQL in Docker Compose.

### Excluded

- Keycloak or another external identity provider.
- OAuth2 / OpenID Connect login with external providers.
- Refresh tokens, token revocation lists, and complex session management.
- Multi-factor authentication, password reset by email, email verification.
- Fine-grained permission systems beyond the three roles.
- Email or push notifications.
- Real-time chat or WebSockets.
- File attachments.
- SLA management.
- Audit/history entity.
- Microservices.
- Service/DTO/Mapper architecture.
- Production-grade security operations, monitoring, or deployment hardening.

---

## 4. Technology Stack

### Backend dependencies

Use Spring Initializr with:

- Spring Web
- Lombok
- Spring Data JPA
- PostgreSQL Driver
- Spring Boot DevTools
- Validation (`spring-boot-starter-validation`)
- Spring Security (`spring-boot-starter-security`)

Add a small JWT library compatible with the selected Spring Boot/Java version (for example, JJWT with its API, implementation, and Jackson modules). Keep its version consistent across its modules. Do not add Keycloak or OAuth2 dependencies.

Hibernate is provided through Spring Data JPA's Hibernate implementation; do not add a separate Hibernate dependency unless there is a specific compatibility reason.

Use the Spring Boot version selected for the project and keep Spring Boot-managed dependency versions managed by the Spring Boot parent/BOM. Do not manually pin versions for managed Spring Boot dependencies.

### Other tools

- Java version compatible with the selected Spring Boot version
- Maven
- PostgreSQL in Docker Compose
- Postman or Bruno for API testing
- React JS for frontend
- Axios or native `fetch` for HTTP calls
- Git and GitHub for collaboration

---

## 5. Domain Model — Six Entities

All entities use `UUID` as their primary key. Use a UUID generation strategy supported by the selected Hibernate version, such as `@GeneratedValue(strategy = GenerationType.UUID)`. Do not use `Long` identifiers.

### 5.1 User

Represents an account that can authenticate to the application.

| Field | Java type | Rules |
|---|---|---|
| `id` | `UUID` | Primary key, generated |
| `fullName` | `String` | Required, 3–100 characters |
| `email` | `String` | Required, valid email, unique |
| `password` | `String` | Required; store BCrypt hash only |
| `role` | `UserRole` | Required; assigned by backend/admin |
| `enabled` | `Boolean` | Required; defaults to `true` |
| `createdAt` | `LocalDateTime` | Set automatically |

Do not return the password hash in API responses. Never accept a role from the public registration request.

### 5.2 Employee

Represents the employee profile associated with a User account.

| Field | Java type | Rules |
|---|---|---|
| `id` | `UUID` | Primary key, generated |
| `department` | `String` | Required, 2–100 characters |
| `phone` | `String` | Optional, maximum 30 characters |
| `user` | `User` | Required, `@OneToOne`, unique foreign key |

The employee's name and email come from the associated User. Do not duplicate `fullName`, `email`, or `password` in Employee.

Public registration creates both a User with role `EMPLOYEE` and its Employee profile.

### 5.3 Technician

Represents the technician profile associated with a User account.

| Field | Java type | Rules |
|---|---|---|
| `id` | `UUID` | Primary key, generated |
| `specialization` | `String` | Required, 2–100 characters |
| `availability` | `Boolean` | Required |
| `user` | `User` | Required, `@OneToOne`, unique foreign key |

The technician's name and email come from the associated User. Do not duplicate `fullName`, `email`, or `password` in Technician.

An Admin creates a technician account by creating a User with role `TECHNICIAN` and its Technician profile. The account's initial password is supplied by the Admin during creation. The technician can log in with those credentials.

### 5.4 Category

Represents the type of technical issue.

| Field | Java type | Rules |
|---|---|---|
| `id` | `UUID` | Primary key, generated |
| `name` | `String` | Required, 3–60 characters, unique |
| `description` | `String` | Optional, maximum 255 characters |

Suggested initial categories:

- Hardware
- Software
- Network
- Printer
- Account & Access

These may be created through the API or inserted as sample data. Do not create a separate entity for category types.

### 5.5 Ticket

Represents an IT support request. This is the central entity.

| Field | Java type | Rules |
|---|---|---|
| `id` | `UUID` | Primary key, generated |
| `title` | `String` | Required, 5–100 characters |
| `description` | `String` | Required, 10–2000 characters |
| `status` | `TicketStatus` | Required; defaults to `OPEN` |
| `priority` | `TicketPriority` | Required |
| `createdAt` | `LocalDateTime` | Set automatically on creation |
| `updatedAt` | `LocalDateTime` | Set automatically on creation/update |
| `employee` | `Employee` | Required, `@ManyToOne` |
| `technician` | `Technician` | Optional, `@ManyToOne` |
| `category` | `Category` | Required, `@ManyToOne` |

Example create request (IDs are illustrative UUIDs):

```json
{
  "title": "Internet connection problem",
  "description": "The internet connection is unstable in office 2.",
  "priority": "HIGH",
  "category": { "id": "2f1c2e7a-8a44-4e1a-9f13-2e5d2f5d7a10" }
}
```

The backend obtains the Employee from the authenticated User. The client must not choose another Employee or provide `employee`, `id`, `createdAt`, or `updatedAt` when creating a ticket. New tickets start with status `OPEN` and no assigned technician.

### 5.6 Comment

Represents a message or update related to a ticket.

| Field | Java type | Rules |
|---|---|---|
| `id` | `UUID` | Primary key, generated |
| `content` | `String` | Required, 2–1000 characters |
| `createdAt` | `LocalDateTime` | Set automatically |
| `ticket` | `Ticket` | Required, `@ManyToOne` |
| `author` | `User` | Required, `@ManyToOne` |

The author is obtained from the authenticated User. Do not accept `authorName` or `authorType` from the client; derive the author's display name and role from the associated User. Employees and Technicians may comment on tickets. Admin comment permission is not required unless explicitly added later.

---

## 6. Enums

Put all enum files directly inside the `model` package. Do not create an `enums` subpackage, and do not declare enums inside entity classes.

### UserRole.java

```java
public enum UserRole {
    ADMIN,
    EMPLOYEE,
    TECHNICIAN
}
```

### TicketStatus.java

```java
public enum TicketStatus {
    OPEN,
    IN_PROGRESS,
    WAITING_FOR_RESPONSE,
    RESOLVED,
    CLOSED
}
```

### TicketPriority.java

```java
public enum TicketPriority {
    LOW,
    MEDIUM,
    HIGH,
    CRITICAL
}
```

Persist enums as strings using `@Enumerated(EnumType.STRING)`. Do not persist ordinal values.

Suggested ticket lifecycle:

`OPEN` → `IN_PROGRESS` → `WAITING_FOR_RESPONSE` → `IN_PROGRESS` → `RESOLVED` → `CLOSED`

For this mini project, status updates may set any valid enum value; strict workflow transition rules are not required.

---

## 7. Entity Relationships

Keep relationships unidirectional.

| Owner entity | Field | JPA mapping | Required? |
|---|---|---|---|
| `Employee` | `user` | `@OneToOne` | Yes, unique |
| `Technician` | `user` | `@OneToOne` | Yes, unique |
| `Ticket` | `employee` | `@ManyToOne` | Yes |
| `Ticket` | `technician` | `@ManyToOne` | No |
| `Ticket` | `category` | `@ManyToOne` | Yes |
| `Comment` | `ticket` | `@ManyToOne` | Yes |
| `Comment` | `author` | `@ManyToOne` | Yes |

Foreign keys:

- `employees.user_id` → `users.id` (unique)
- `technicians.user_id` → `users.id` (unique)
- `tickets.employee_id` → `employees.id`
- `tickets.technician_id` → `technicians.id` (nullable)
- `tickets.category_id` → `categories.id`
- `comments.ticket_id` → `tickets.id`
- `comments.author_id` → `users.id`

Do not add inverse `@OneToMany` collections to User, Employee, Technician, Category, or Ticket. Retrieve related records through repository methods such as `findByEmployeeId`, `findByTechnicianId`, `findByTicketId`, and `findByUserId`.

### Deletion behavior

- Do not cascade-delete Users or profiles through Tickets.
- Do not allow deletion of an Employee profile while that employee has tickets.
- Do not allow deletion of a Category used by tickets.
- Do not allow deletion of a Technician assigned to tickets; reassign or unassign tickets first.
- Do not delete a User while its Employee/Technician profile or authored comments are still referenced.
- Deleting a Ticket may delete its Comments only if this is deliberately implemented and tested. Avoid broad `CascadeType.ALL` by default.
- For a simple academic implementation, Admin may disable a user account (`enabled=false`) instead of deleting it when records refer to that user.

---

## 8. Authentication and Authorization

Implement only the minimum needed to demonstrate authentication and role-based authorization.

### 8.1 Authentication flow

1. A visitor opens the application and can register as an Employee or go to Login.
2. Public registration accepts `fullName`, `email`, `password`, `department`, and optional `phone`.
3. The backend validates the data, hashes the password with BCrypt, creates a User with role `EMPLOYEE`, and creates the linked Employee profile.
4. Login accepts email and password.
5. If credentials are valid and the account is enabled, the backend returns a signed JWT.
6. React sends the token in the `Authorization: Bearer <token>` header for protected API requests.
7. The backend validates the token and uses its subject/claims to identify the User and role.

### 8.2 JWT and Spring Security requirements

- Use Spring Security's standard request security and a simple JWT authentication filter.
- Use stateless sessions (`SessionCreationPolicy.STATELESS`).
- Use BCrypt through `PasswordEncoder`.
- Use a straightforward signed JWT with **HS256**. Keep the secret in an environment variable or local configuration excluded from Git; do not hardcode it in source code.
- Use a simple token expiration, for example 60 minutes.
- No refresh tokens, OAuth2, Keycloak, token blacklist, or complex session handling.
- Public endpoints: registration and login.
- All other application endpoints require a valid JWT, except any explicitly documented public read-only endpoint if one is later agreed.
- Enforce roles in the backend. Hiding buttons in React is not authorization.
- Return `401 Unauthorized` for missing/invalid authentication and `403 Forbidden` for an authenticated user without permission.
- Never log passwords or JWT secrets.
- Do not return password hashes from any controller.

The JWT implementation should remain small and understandable. Do not build a custom cryptographic algorithm; use a maintained JWT library and its HS256 support.

### 8.3 Role permissions

| Action | Employee | Technician | Admin |
|---|---:|---:|---:|
| Register public account | Yes | No | No |
| Login | Yes | Yes | Yes |
| Create ticket | Yes | No | No |
| View own tickets | Yes | No | No |
| Add comment to a ticket | Yes | Yes | No |
| View tickets assigned to them | No | Yes | No |
| Update status of assigned ticket | No | Yes | No |
| View/manage all tickets | No | Limited to assigned tickets | Yes |
| Assign/unassign technician | No | No | Yes |
| Manage categories | No | No | Yes |
| Create/manage technician accounts | No | No | Yes |
| Manage employee accounts | No | No | Yes |

For the academic implementation, keep authorization checks straightforward. Use endpoint-level role rules and simple ownership checks in the relevant controller methods. Do not introduce a complex permission framework.

---

## 9. REST API Contract

Base URL:

```text
http://localhost:8080/api
```

Use JSON request and response bodies. All IDs in paths and payloads are UUID strings.

### 9.1 Authentication

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| `POST` | `/auth/register` | Public | Register an Employee |
| `POST` | `/auth/login` | Public | Authenticate and receive JWT |
| `GET` | `/auth/me` | Authenticated | Return current user's safe account/profile information |

Registration example:

```json
{
  "fullName": "Mohamed Trabelsi",
  "email": "mohamed@company.com",
  "password": "ExamplePassword123",
  "department": "Human Resources",
  "phone": "+216 20 123 456"
}
```

The registration request must not contain `role`, `enabled`, or a User ID. The backend always assigns `EMPLOYEE`.

Login example:

```json
{
  "email": "mohamed@company.com",
  "password": "ExamplePassword123"
}
```

Example login response:

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

Do not include the password or password hash in any response.

### 9.2 Employees

Employee profile management is Admin-only. An Employee can retrieve their own profile through `/auth/me` or an agreed self-profile endpoint.

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/employees` | Admin: list employees |
| `GET` | `/employees/{id}` | Admin: get employee profile |
| `PUT` | `/employees/{id}` | Admin: update profile |
| `DELETE` | `/employees/{id}` | Admin: delete only if no dependent records |

Public employee creation is handled only by `/auth/register`; do not expose a second public Employee creation endpoint.

### 9.3 Technicians

All technician management endpoints are Admin-only, except a Technician may retrieve their own profile.

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/technicians` | Admin: create Technician account and profile |
| `GET` | `/technicians` | Admin: list technicians |
| `GET` | `/technicians/{id}` | Admin: get technician |
| `PUT` | `/technicians/{id}` | Admin: update technician profile/account fields |
| `DELETE` | `/technicians/{id}` | Admin: delete only if no dependent records |
| `GET` | `/technicians/available` | Authenticated roles as needed: list available technicians for assignment UI |
| `GET` | `/technicians/specialization?keyword=network` | Admin: search by specialization |

Technician creation example:

```json
{
  "fullName": "Ahmed Ben Ali",
  "email": "ahmed@helpdesk.com",
  "password": "TemporaryPassword123",
  "specialization": "Network Support",
  "availability": true
}
```

The backend creates a User with role `TECHNICIAN` and a linked Technician profile. The request must not be able to set `ADMIN` or another role.

### 9.4 Categories

Category management is Admin-only. Authenticated users may list categories to create or view tickets.

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| `POST` | `/categories` | Admin | Create category |
| `GET` | `/categories` | Authenticated | List categories |
| `GET` | `/categories/{id}` | Authenticated | Get category |
| `PUT` | `/categories/{id}` | Admin | Update category |
| `DELETE` | `/categories/{id}` | Admin | Delete category |

### 9.5 Tickets

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| `POST` | `/tickets` | Employee | Create ticket for authenticated Employee |
| `GET` | `/tickets` | Role-scoped | Admin: all; Employee: own; Technician: assigned |
| `GET` | `/tickets/{id}` | Role-scoped | Get ticket if permitted |
| `PUT` | `/tickets/{id}` | Admin / owning Employee as allowed | Update permitted ticket fields |
| `DELETE` | `/tickets/{id}` | Admin | Delete ticket |
| `PATCH` | `/tickets/{id}/status` | Admin / assigned Technician | Update status |
| `PATCH` | `/tickets/{id}/assign/{technicianId}` | Admin | Assign technician |
| `PATCH` | `/tickets/{id}/unassign` | Admin | Remove technician assignment |
| `GET` | `/tickets/status/{status}` | Role-scoped | Filter visible tickets by status |
| `GET` | `/tickets/priority/{priority}` | Role-scoped | Filter visible tickets by priority |
| `GET` | `/tickets/category/{categoryId}` | Role-scoped | Filter visible tickets by category |
| `GET` | `/tickets/technician/{technicianId}` | Admin | Filter by technician |
| `GET` | `/tickets/employee/{employeeId}` | Admin | Filter by employee |
| `GET` | `/tickets/search?keyword=internet` | Role-scoped | Search within tickets visible to current user |

When creating a ticket, the backend obtains the Employee profile from the authenticated User. Ignore/reject any client-supplied `employee` field. The employee cannot assign a technician or set a different owner.

A Technician can view and update the status only of tickets assigned to that Technician. An Employee can view their own tickets only. Admin can view and manage all tickets.

### 9.6 Comments

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| `POST` | `/tickets/{ticketId}/comments` | Owning Employee / assigned Technician | Add comment |
| `GET` | `/tickets/{ticketId}/comments` | Anyone permitted to view that ticket | List comments |
| `GET` | `/comments/{id}` | Role-scoped | Get comment |
| `PUT` | `/comments/{id}` | Comment author only, or Admin if explicitly allowed | Update comment |
| `DELETE` | `/comments/{id}` | Comment author only, or Admin if explicitly allowed | Delete comment |

Comment creation example:

```json
{
  "content": "The issue is still happening."
}
```

The backend obtains both the Ticket (from `ticketId`) and author (from the authenticated User). Do not accept `author`, `authorName`, or `authorType` from the client.

### HTTP status conventions

- `200 OK`: successful GET, PUT, PATCH
- `201 Created`: successful POST
- `204 No Content`: successful DELETE
- `400 Bad Request`: invalid input or invalid enum value
- `401 Unauthorized`: missing or invalid authentication
- `403 Forbidden`: authenticated user lacks permission
- `404 Not Found`: requested entity does not exist or is not visible to the current user, where appropriate
- `409 Conflict`: duplicate email/category name or deletion blocked by existing relationships

---

## 10. Pagination, Sorting, Filtering, and Search

Prioritize these features on Ticket endpoints. All results must still respect the current user's permissions; filtering must never expose another user's tickets.

### Pagination

```http
GET /api/tickets?page=0&size=5
```

Page numbers are zero-based.

### Sorting

```http
GET /api/tickets?page=0&size=5&sort=createdAt,desc
GET /api/tickets?sort=title,asc
```

Support Spring Data's `Pageable` and return a `Page<Ticket>` or a simple consistent JSON response containing page metadata and ticket results.

### Filtering

```http
GET /api/tickets/status/OPEN?page=0&size=5
GET /api/tickets/priority/HIGH?page=0&size=5
GET /api/tickets/category/{categoryId}?page=0&size=5
```

Admin-only filters:

```http
GET /api/tickets/technician/{technicianId}?page=0&size=5
GET /api/tickets/employee/{employeeId}?page=0&size=5
```

### Search

```http
GET /api/tickets/search?keyword=internet&page=0&size=5
```

Use `Pageable` for paginated filter/search methods. Ensure role/ownership restrictions are applied before or as part of filtering.

An optional combined filter endpoint may be implemented if time permits:

```http
GET /api/tickets/filter?status=OPEN&priority=HIGH&page=0&size=5
```

Do not implement advanced dynamic query frameworks for this mini project.

---

## 11. Repository Requirements

Repositories extend `JpaRepository<Entity, UUID>`.

Suggested custom methods:

### UserRepository

```java
Optional<User> findByEmail(String email);
boolean existsByEmail(String email);
```

### EmployeeRepository

```java
Optional<Employee> findByUserId(UUID userId);
```

### TechnicianRepository

```java
Optional<Technician> findByUserId(UUID userId);
List<Technician> findByAvailabilityTrue();
List<Technician> findBySpecializationContainingIgnoreCase(String keyword);
```

### CategoryRepository

```java
Optional<Category> findByNameIgnoreCase(String name);
boolean existsByNameIgnoreCase(String name);
```

### TicketRepository

```java
Page<Ticket> findByStatus(TicketStatus status, Pageable pageable);
Page<Ticket> findByPriority(TicketPriority priority, Pageable pageable);
Page<Ticket> findByCategoryId(UUID categoryId, Pageable pageable);
Page<Ticket> findByTechnicianId(UUID technicianId, Pageable pageable);
Page<Ticket> findByEmployeeId(UUID employeeId, Pageable pageable);
Page<Ticket> findByTitleContainingIgnoreCase(String keyword, Pageable pageable);
Page<Ticket> findByEmployeeUserId(UUID userId, Pageable pageable);
Page<Ticket> findByTechnicianUserId(UUID userId, Pageable pageable);
```

### CommentRepository

```java
List<Comment> findByTicketIdOrderByCreatedAtDesc(UUID ticketId);
```

Use derived query methods first. Add a small `@Query` example only if useful to demonstrate custom JPQL. Do not add unnecessary repository complexity.

---

## 12. Validation and Error Handling

Add `spring-boot-starter-validation`.

Use Jakarta annotations such as:

- `@NotBlank`
- `@NotNull`
- `@Email`
- `@Size`
- `@Pattern` only where a clear format requirement exists

Use `@Valid` on request bodies in POST and PUT endpoints.

Important implementation notes:

- Check email uniqueness through `UserRepository` before creating an account.
- Define a database unique constraint for `User.email` and `Category.name`.
- For updates, do not reject a record because its email/name already belongs to that same record.
- Check that referenced Employee, Technician, Category, Ticket, and User IDs exist before saving relationships.
- Do not allow assigning an unavailable technician.
- Validate registration and technician-creation password length (for example, at least 8 characters).
- Hash passwords with BCrypt before saving.
- Never serialize password hashes in API responses. Use simple response construction or safe JSON annotations; do not introduce a DTO layer solely for this.
- Return clear 400/401/403/404/409 responses.
- A simple `@RestControllerAdvice` in the `exception` package is allowed. It does not introduce a Service layer.

---

## 13. Backend Package Structure

Keep the package structure simple. All enums live directly in `model`.

```text
src/main/java/com/helpdesk/
├── HelpdeskApplication.java
├── model/
│   ├── User.java
│   ├── Employee.java
│   ├── Technician.java
│   ├── Category.java
│   ├── Ticket.java
│   ├── Comment.java
│   ├── UserRole.java
│   ├── TicketStatus.java
│   └── TicketPriority.java
├── repository/
│   ├── UserRepository.java
│   ├── EmployeeRepository.java
│   ├── TechnicianRepository.java
│   ├── CategoryRepository.java
│   ├── TicketRepository.java
│   └── CommentRepository.java
├── controller/
│   ├── AuthController.java
│   ├── EmployeeController.java
│   ├── TechnicianController.java
│   ├── CategoryController.java
│   ├── TicketController.java
│   └── CommentController.java
├── security/
│   ├── SecurityConfig.java
│   ├── JwtAuthenticationFilter.java
│   └── JwtTokenProvider.java
└── exception/
    └── GlobalExceptionHandler.java
```

A small initial Admin seeding/configuration class may be added if needed. Keep authentication logic simple and avoid creating a general Service layer. Do not add `service`, `dto`, or `mapper` packages. Do not create an `enums` package.

If CORS configuration is needed for React, use a simple configuration or `@CrossOrigin` annotations appropriate to the selected Spring Security setup.

---

## 14. PostgreSQL and Docker

Run PostgreSQL in Docker Compose. Persist database data with a named volume.

Example `docker-compose.yml`:

```yaml
services:
  postgres:
    image: postgres:16
    container_name: helpdesk-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: helpdesk_db
      POSTGRES_USER: helpdesk
      POSTGRES_PASSWORD: helpdesk123
    ports:
      - "5432:5432"
    volumes:
      - helpdesk_data:/var/lib/postgresql/data

volumes:
  helpdesk_data:
```

Example `application.properties`:

```properties
spring.application.name=helpdesk

spring.datasource.url=jdbc:postgresql://localhost:5432/helpdesk_db
spring.datasource.username=helpdesk
spring.datasource.password=helpdesk123

spring.jpa.hibernate.ddl-auto=update
spring.jpa.show-sql=true
spring.jpa.properties.hibernate.format_sql=true

server.port=8080

# Read the actual secret from an environment variable in local execution.
app.jwt.secret=${JWT_SECRET}
app.jwt.expiration-ms=3600000
```

Set `JWT_SECRET` in the local environment to a sufficiently long random secret suitable for HS256. Do not commit the real secret to Git. The database credentials shown above are local development credentials for the academic project only.

Run PostgreSQL:

```bash
docker compose up -d
```

Stop it without deleting data:

```bash
docker compose down
```

Do not use `docker compose down -v` unless you intentionally want to delete the database volume.

---

## 15. Frontend Scope

The React application should provide a simple role-aware experience.

### Public pages

- Register (Employee registration only).
- Login.

### Employee pages

- Dashboard with the employee's own ticket summary.
- My Tickets with pagination, sorting, search, and filters.
- Create Ticket.
- Ticket Details with comments and status tracking.

### Technician pages

- Dashboard with assigned ticket summary.
- Assigned Tickets.
- Ticket Details with comments and status update.

### Admin pages

- Dashboard with overall ticket counts by status and priority.
- All Tickets with assignment and management controls.
- Employees management.
- Technicians management (create account, edit profile, enable/disable or manage availability).
- Categories management.

The frontend may hide navigation items and controls according to the logged-in role, but the backend must independently enforce every permission.

Suggested frontend organization:

```text
frontend/
├── src/
│   ├── api/
│   ├── components/
│   ├── context/
│   ├── pages/
│   ├── App.jsx
│   └── main.jsx
└── package.json
```

Store and attach the JWT in a simple, consistent way for the academic project. Do not build a complex frontend authentication framework. The API remains the source of truth for identity and permissions.

---

## 16. Git Repository and Collaboration

Suggested repository layout:

```text
helpdesk-project/
├── backend/
├── frontend/
├── docs/
│   └── PROJECT_SPEC.md
├── docker-compose.yml
└── README.md
```

Recommended ownership:

### Backend developer

- Spring Boot setup and dependencies.
- PostgreSQL and Docker integration.
- Six entities and enums.
- Repositories and custom methods.
- Registration, login, JWT, and role-based endpoint protection.
- REST controllers and CRUD.
- Validation and error handling.
- API testing and API contract maintenance.

### Frontend developer

- React setup and layout.
- Register and Login pages.
- Role-aware navigation and dashboards.
- Ticket, profile, and management pages.
- Forms and tables.
- Pagination, sorting, search, and filters.
- API integration using the agreed endpoints.

### Shared

- Agree on API changes before implementing them.
- Test the full application together.
- Keep this specification updated when an agreed requirement changes.

Use feature branches and merge working features into the shared branch. Avoid having both developers independently generate or rename the same API/model files.

---

## 17. Implementation Milestones

1. **Project setup:** create Spring Boot project, React project, Docker Compose, and Git repository.
2. **Domain model:** implement six entities, UUID IDs, enums in `model`, constraints, and unidirectional relationships.
3. **Repositories:** create six repositories and custom query methods.
4. **Authentication:** implement Employee registration, login, BCrypt password hashing, JWT generation/validation, initial Admin account, and role-based security.
5. **Basic CRUD:** implement and test Category, Employee profile, Technician, Ticket, and Comment endpoints with appropriate access rules.
6. **Ticket operations:** implement assignment, unassignment, status update, filtering, search, pagination, and sorting with ownership restrictions.
7. **Validation and errors:** add Bean Validation and consistent error handling.
8. **Frontend integration:** connect public pages and role-specific React pages to the tested backend.
9. **Final testing:** test normal cases, invalid input, missing IDs, duplicate values, unauthorized requests, forbidden role access, ownership restrictions, relationship constraints, and pagination.

Do not start frontend integration against endpoints that have not been agreed upon and tested.

---

## 18. Acceptance Criteria

The mini project is considered complete when:

- [ ] PostgreSQL starts through Docker Compose and retains data in its volume.
- [ ] The Spring Boot application connects to PostgreSQL successfully.
- [ ] Exactly six JPA entities exist: User, Employee, Technician, Category, Ticket, Comment.
- [ ] Every entity uses UUID as its ID type.
- [ ] All enums are separate Java files directly inside `model`; no `enums` package exists.
- [ ] Every Employee and Technician profile is linked to exactly one User account.
- [ ] Admin is represented by a User with role `ADMIN`, not a separate profile entity.
- [ ] Public registration always creates an Employee and cannot assign another role.
- [ ] An Admin can create Technician accounts.
- [ ] Login returns a JWT for valid credentials.
- [ ] Passwords are stored as BCrypt hashes.
- [ ] Protected endpoints reject missing/invalid tokens.
- [ ] Role restrictions are enforced by the backend.
- [ ] Employees can create and view only their own tickets.
- [ ] Technicians can view and update tickets assigned to them.
- [ ] Admin can view/manage all tickets and assign technicians.
- [ ] Ticket creation requires an existing Category and derives Employee from the authenticated User.
- [ ] A Ticket can initially have no Technician.
- [ ] A Ticket can be assigned to an available Technician.
- [ ] Employees and Technicians can add comments to tickets they are permitted to access.
- [ ] Comment author is derived from the authenticated User.
- [ ] Validation rejects blank, malformed, or too-short input.
- [ ] Duplicate emails/category names are rejected clearly.
- [ ] Missing entity IDs return 404.
- [ ] Unauthorized and forbidden requests return 401 and 403 respectively.
- [ ] Deletion does not silently break foreign-key relationships.
- [ ] Ticket pagination and sorting work.
- [ ] Ticket custom repository filters and title search work without bypassing ownership restrictions.
- [ ] React supports the main workflows for all three roles.
- [ ] The code remains understandable and explainable by both students.

---

## 19. Instructions for OpenCode

This document is the shared source of truth for the project.

Before generating or modifying code:

1. Read this entire `PROJECT_SPEC.md`.
2. Inspect the existing repository and preserve working code.
3. Follow the exact six-entity model and agreed field names.
4. Use UUID for all entity identifiers and repository ID types.
5. Put enum files directly in `model`; do not create an `enums` package.
6. Follow the endpoint paths, access rules, and JSON field names in this document.
7. Keep the architecture simple: Model, Repository, Controller, plus the small Security and Exception packages described above.
8. Do not create Service, DTO, or Mapper layers.
9. Do not add entities, roles, or features without explicit agreement.
10. Keep JWT implementation minimal: HS256, BCrypt, stateless security, and a simple expiration. No Keycloak, OAuth2, refresh tokens, or advanced security features.
11. Never trust a role, owner, comment author, or ticket employee supplied by the client when it should be derived from the authenticated User.
12. Implement one milestone at a time.
13. Explain which files are created or changed and how to test the result.
14. Do not claim a feature works unless it has been run or tested.
15. If a requirement is ambiguous or conflicts with this document, ask before making an architectural change.

**Important:** OpenCode should not generate the entire project in one step. Start with project inspection and setup, then implement and test each milestone separately.
