# TeamFlow — Architecture Decisions

Each decision records what we chose, why, the risk, and how we manage it. When a decision changes, add a new entry and mark the old one as replaced. Do not delete it.

## Decision 1: All companies share one database

**Status:** Accepted

**Decision:** All organizations share one PostgreSQL database and one set of tables. Every organization-owned table has an `organization_id` column.

**Why:** One database is simpler to develop, migrate, back up, and run. It is the standard starting point for multi-tenant SaaS at this size. A database or schema per company would add a lot of operational work without a real need.

**Risk:** A query that forgets the organization filter could expose one company's data to another. A heavy company could also slow down others.

**How we stay safe:**

* The organization ID comes from the URL (`/api/v1/orgs/:orgId/...`) and is verified through the user's membership row in the database.
* Every repository function for organization-owned data requires the organization ID as a parameter, and every query filters by it.
* Composite foreign keys, such as `(organization_id, project_id)` on tasks, make the database reject rows that mix two organizations.
* Integration tests check that every endpoint denies cross-tenant access.
* PostgreSQL Row-Level Security is a possible extra layer later.
* Resource usage is monitored as the application grows.

## Decision 2: Login uses a session cookie

**Status:** Accepted

**Decision:** The web app uses server-side sessions stored in PostgreSQL. The browser receives only a random session ID in an HttpOnly cookie. The database stores a SHA-256 hash of that ID, not the raw value.

**Why:** The server can end a session by deleting its row, so logout and "log out everywhere" work immediately. PostgreSQL is already required for the MVP, and Redis is planned for later, so sessions do not add a second service. Hashing the ID means a leaked database copy does not contain usable cookies. HttpOnly cookies cannot be read by JavaScript. We chose this over JWT because JWTs are hard to revoke before they expire.

**Risk:** Every logged-in request reads the session table, and expired rows build up unless deleted. Cookie authentication needs CSRF protection. XSS can still act as the user in their browser, even though it cannot read the cookie.

**How we stay safe:**

* Cookie settings: `HttpOnly`, `Secure` in production, `SameSite=Lax`, `Path=/`.
* HTTPS in production.
* CSRF: `SameSite=Lax` plus a check that the `Origin` header matches our frontend on every state-changing request.
* XSS: escape output in the frontend and set a Content Security Policy with Helmet.
* Create a new session ID at login, and end all sessions after a password reset.
* Idle timeout and absolute expiry on sessions; a scheduled job deletes expired rows.
* An index on the hashed session ID makes the lookup fast.
* The user's organization role is loaded from membership on each request, never stored in the cookie.
* No passwords, tokens, or personal data in browser storage or logs.
* Secrets stay in environment variables and out of source control.

## Decision 3: Passwords are hashed with Argon2id

**Status:** Accepted

**Decision:** Passwords are hashed with Argon2id. Bcrypt is the fallback if the native package causes problems in Docker.

**Why:** Argon2id is OWASP's first recommendation. It is slow on purpose and uses memory, which makes guessing passwords with powerful hardware expensive.

**Risk:** Hashing is CPU and memory heavy, so many login attempts could slow the server.

**How we stay safe:** Rate limiting on login, registration, and password reset. Hash settings follow current OWASP guidance and are checked when we implement authentication.

## Decision 4: A modular monolith with layers

**Status:** Accepted

**Decision:** One Express API in TypeScript, organized by feature modules (`auth`, `orgs`, `projects`, `tasks`, `comments`, `activity`). Each module uses the flow route → middleware and validation → controller → service → repository → PostgreSQL. A separate worker process from the same codebase will run background jobs in Version 1.

**Why:** One deployable app is easier to build, test, and run. Clear layers keep business rules in services and SQL in repositories. Microservices would add network calls, deployment work, and data consistency problems we do not need.

**Risk:** Without discipline, modules can call each other's internals and become tangled.

**How we stay safe:** Modules talk to each other only through their services. Transactions are started in services. Controllers contain no business logic.

## Decision 5: Status codes for access control

**Status:** Accepted

**Decision:** 401 when not logged in; 404 when the user is not a member of the organization or the resource is not in that organization; 403 when the user is a member but their role does not allow the action; 400 for invalid input.

**Why:** Returning 404 for other organizations' data hides whether that data exists. Returning 403 to members is honest and helpful, because they already know the resource exists.

**Risk:** Using these codes inconsistently would leak information or confuse the frontend.

**How we stay safe:** One shared error format and error classes, and API tests for each status code.