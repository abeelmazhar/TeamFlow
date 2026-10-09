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

**Decision:** The initial web application will use server-side sessions stored in Redis, with a random session identifier sent to the browser in an HttpOnly cookie.

**Why:** Server-side sessions make logout and session revocation straightforward because the server controls session validity. HttpOnly cookies prevent ordinary client-side JavaScript from reading the session identifier, reducing exposure to token theft through certain XSS scenarios.

**Risk:** Sessions require shared storage and session expiration management. Cookie-based authentication also requires appropriate CSRF protection, and XSS can still perform actions through a victim's browser even if it cannot read an HttpOnly cookie.

**How we stay safe:**

* Set cookies with `HttpOnly`, `Secure` in production, and an appropriate `SameSite` policy.
* Use HTTPS in production.
* Protect state-changing requests against CSRF where required by the cookie and deployment configuration.
* Regenerate the session after login or privilege changes.
* Apply idle and absolute session expiration.
* Never store passwords or sensitive session data in browser-readable storage.
* Keep session secrets and Redis credentials out of source control.
* Configure Redis as shared session storage for multiple API instances.
