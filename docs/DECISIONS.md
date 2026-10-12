# TeamFlow — Architecture Decisions

## Decision 1: All companies share one database

**Decision:** All organizations will share one PostgreSQL database, using shared tables with an `organization_id` column on organization-owned resources.

**Why:** A shared database simplifies development, deployment, database migrations, backups, and maintenance. It is a practical starting point for a multi-tenant SaaS application and avoids the complexity of managing a separate database for every company.

**Risk:** A missing organization filter in a query could expose one company's data to another company. A database migration or resource-heavy tenant could also affect multiple organizations.

**How we stay safe:**

* Derive the authorized organization context from the authenticated user and validated membership.
* Include organization scope in repository queries for tenant-owned resources.
* Enforce foreign-key constraints and appropriate composite constraints.
* Consider PostgreSQL Row-Level Security (RLS) as an additional defense.
* Add integration tests that verify cross-tenant access is denied.
* Monitor resource usage and review isolation requirements as the application grows.

## Decision 2: Login uses a cookie with a session

**Decision:** The initial web application will use server-side sessions stored in PostgreSQL. The browser receives only a random session identifier in an HttpOnly cookie. The database stores a hash of that identifier, not the raw value.

**Why:** The server can revoke a session by deleting its row, so logout is immediate. PostgreSQL is already required for the MVP, and Redis is deferred to a later milestone, so sessions do not add a second service. Hashing the identifier means a database copy does not hand out usable cookies. HttpOnly cookies prevent ordinary client-side JavaScript from reading the session identifier.

**Risk:** Every authenticated request reads the session table, and expired rows must be deleted or they accumulate. Cookie-based authentication also requires CSRF protection, and XSS can still perform actions through a victim's browser even if it cannot read an HttpOnly cookie.

**How we stay safe:**

* Set cookies with `HttpOnly`, `Secure` in production, and `SameSite=Lax`.
* Use HTTPS in production.
* Protect state-changing requests against CSRF.
* Regenerate the session after login or privilege changes.
* Apply idle and absolute session expiration, and delete expired rows on a schedule.
* Store only a hash of the session identifier, with an index for the lookup.
* Load the user's organization role from membership, not from the cookie.
* Never store passwords or sensitive session data in browser-readable storage.
* Keep session secrets out of source control.
