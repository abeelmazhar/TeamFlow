# TeamFlow — Product Specification

## 1. Problem Statement

TeamFlow is a multi-tenant project and task management platform designed for companies and teams that need a centralized place to organize their work. Teams often manage projects, tasks, deadlines, assignments, and discussions across different tools, making it difficult to track progress and coordinate responsibilities. TeamFlow allows each company to create an organization, invite team members, manage projects, assign tasks, and collaborate securely. Each company can access only its own data, while role-based permissions ensure that users can perform only the actions they are authorized to perform. The goal is to improve team productivity, accountability, and visibility into project progress.

## 2. User Roles

Roles belong to a membership, not to a user. The same person can have a different role in each organization.

* **Owner:** Exactly one per organization. Has full control, including organization settings, deleting the organization, managing all members and roles, and transferring ownership.
* **Admin:** Manages Managers and Members, invitations, projects, and organization settings. An Admin cannot delete the organization, transfer ownership, grant the Owner or Admin role, or change or remove the Owner or another Admin.
* **Manager:** Creates and manages projects, creates and assigns tasks, updates task details, and monitors project progress.
* **Member:** Views projects and tasks in the organization, works on tasks assigned to them, and participates in discussions through comments.

## 3. Permission Table

In the MVP, every member of an organization can view every project and task in that organization. A Member can change a task only when they are its assignee.

| Action                         | Owner | Admin                       | Manager | Member              |
| ------------------------------ | ----- | --------------------------- | ------- | ------------------- |
| View organization              | Yes   | Yes                         | Yes     | Yes                 |
| Update organization settings   | Yes   | Yes                         | No      | No                  |
| Delete organization            | Yes   | No                          | No      | No                  |
| Transfer ownership             | Yes   | No                          | No      | No                  |
| Invite members                 | Yes   | Managers and Members only   | No      | No                  |
| Remove members                 | Yes   | Managers and Members only   | No      | No                  |
| Change member roles            | Yes   | Managers and Members only   | No      | No                  |
| Leave organization             | No*   | Yes                         | Yes     | Yes                 |
| Create projects                | Yes   | Yes                         | Yes     | No                  |
| View projects                  | Yes   | Yes                         | Yes     | Yes                 |
| Update project details         | Yes   | Yes                         | Yes     | No                  |
| Archive / unarchive projects   | Yes   | Yes                         | Yes     | No                  |
| Create tasks                   | Yes   | Yes                         | Yes     | No                  |
| Assign / reassign tasks        | Yes   | Yes                         | Yes     | No                  |
| View tasks                     | Yes   | Yes                         | Yes     | Yes                 |
| Update task status             | Yes   | Yes                         | Yes     | Assigned tasks only |
| Edit task details              | Yes   | Yes                         | Yes     | Assigned tasks only |
| Delete tasks                   | Yes   | Yes                         | Yes     | Assigned tasks only |
| Add comments                   | Yes   | Yes                         | Yes     | Yes                 |
| Edit own comments              | Yes   | Yes                         | Yes     | Yes                 |
| Delete own comments            | Yes   | Yes                         | Yes     | Yes                 |
| Delete other users' comments   | Yes   | Yes                         | Yes     | No                  |

\* The Owner must transfer ownership before leaving.

"Assigned tasks only" means the Member is that task's single assignee. Members cannot create tasks, so assignment is what makes a task theirs. Because tasks are soft-deleted and every deletion is recorded in the activity history, a task a Member deletes can be traced and restored.

Nobody can edit another user's comment, including the Owner.

## 4. Business Rules

### Accounts
1. A user must verify their email address before creating or joining an organization.
2. Password reset links and email verification links are single-use and expire. Resetting a password ends all of that user's existing sessions.

### Organizations and membership
3. Every organization has exactly one Owner. The Owner cannot leave, be removed, or be demoted. To leave, the Owner must first transfer ownership to an existing member, who becomes the new Owner; the old Owner becomes an Admin.
4. An Admin may invite, remove, and change the roles of Managers and Members only. An Admin cannot grant the Owner or Admin role, and cannot change or remove the Owner or another Admin.
5. A user can belong to many organizations, with at most one membership per organization.
6. Invitations expire, can be used only once, and can be accepted only by a logged-in user whose verified email matches the invited email.
7. When a member is removed or leaves, their open tasks become unassigned in the same database transaction, and the change is recorded in the activity history.
8. Users can access organization resources only if they are members of that organization.

### Projects and tasks
9. Every task belongs to exactly one project. That project belongs to exactly one organization, and the task's organization is the project's organization.
10. A task has at most one assignee, and the assignee must be a member of the task's organization.
11. Archived projects are read-only: their tasks and comments can be viewed, but tasks cannot be created, edited, reassigned, or deleted, and comments cannot be added, until the project is unarchived.
12. A task may have a due date in the past, but it is flagged as overdue if it is not completed.
13. Deleting a project archives it rather than permanently deleting its tasks and history.
14. Deleted tasks are soft-deleted: they are hidden from normal queries but kept for history and recovery.
15. Members can update the status of, edit, and delete tasks assigned to them, and edit or delete their own comments. Only Owner, Admin, and Manager can create tasks, reassign tasks, or change tasks assigned to someone else.

### History
16. Every change to projects, tasks, members, and roles writes an activity event in the same database transaction as the change. If the change fails, no event is written; if the event fails, the change is rolled back.

## 5. User Stories

1. As a **User**, I want to register and log in securely so that I can access my workspace.
2. As a **User**, I want to verify my email address so that my account can be trusted.
3. As a **User**, I want to reset my password if I forget it so that I don't lose access to my account.
4. As a **User**, I want to create a company so that I can organize my team's work in one place.
5. As an **Owner**, I want to invite colleagues so that they can collaborate within my organization.
6. As a **User**, I want to accept an invitation so that I can join an organization with the role I was given.
7. As an **Admin**, I want to manage organization members so that access remains up to date.
8. As an **Owner**, I want to transfer ownership so that someone else can run the organization if I leave.
9. As a **Manager**, I want to create projects so that I can organize work around specific goals.
10. As a **Manager**, I want to assign tasks to team members so that everyone knows their responsibilities.
11. As a **Member**, I want to filter and search tasks assigned to me so that I know what to work on next.
12. As a **Member**, I want to update the status of my assigned tasks so that my team can see progress.
13. As a **Member**, I want to edit and delete tasks assigned to me so that I can correct my own work without changing anyone else's tasks.
14. As a **Member**, I want to comment on tasks so that I can discuss progress and blockers with my team.
15. As a **Manager**, I want to see the history of a task so that I can understand who changed what and when.
16. As an **Owner**, I want to archive completed projects so that old work remains available for reference without being changed.

## 6. Security and "Hacker" Cases

Status code rule used everywhere:
* Not logged in → **401**
* Logged in, but not a member of the organization, or the resource is not in that organization → **404** (we do not reveal that it exists)
* Member of the organization, but the role does not allow the action → **403**
* Invalid input → **400**

### Attack 1: Accessing Another Company's Task

**Attack:** A logged-in user changes the task ID in the URL to a task belonging to another company.

**Stopped by:** The server first verifies the user's membership in the organization from the URL. It then loads the task with a query that filters by both the task ID and that verified organization ID. The task is not found in that organization, so the API returns 404.

### Attack 2: Changing the Organization ID

**Attack:** A user changes the organization ID in the URL, request body, or query string to read or change another company's projects.

**Stopped by:** The organization ID comes only from the URL, and that value is not proof of access. The server loads the caller's membership for that organization from the database. If there is no membership, the API returns 404. Request bodies and query strings do not accept an organization ID; Zod schemas reject unknown fields. Every tenant query is filtered by the verified organization ID.

### Attack 3: Escalating Permissions (mass assignment)

**Attack:** A Member sends `"role": "Owner"` in a request body, or calls an admin-only endpoint directly, to gain more permissions.

**Stopped by:** Zod schemas accept only the fields each endpoint allows, so an extra `role` field is rejected. The caller's role is always read from their membership row in the database, never from the request or the cookie. Changing a role is a separate endpoint that checks the permission table and the Owner and Admin limits. A member without permission receives 403; a non-member receives 404.

## 7. Product Decisions

### 1. When a project is archived, can people still edit its tasks?

No. Archived projects are read-only. Users can view tasks and comments, but changes are blocked until the project is unarchived. This preserves historical records and prevents accidental updates to completed work.

### 2. When a task is deleted, should it be fully removed or just hidden?

Soft delete. The task gets a `deleted_at` timestamp and is hidden from normal queries, while its history is kept for recovery and auditing. Permanent deletion, if needed later, will follow a defined retention policy.

Risk: a query that forgets the soft-delete filter can return deleted tasks. Normal reads go through repository functions that always apply both the organization filter and the soft-delete filter, and tests check that deleted tasks are not returned.

### 3. Can a Member give their task to another person?

No. Only Owner, Admin, and Manager can reassign tasks. This keeps responsibility for assignments with people who plan the work.

### 4. Should an unverified user be allowed to create a company?

No. Email verification is required before creating or joining an organization. This reduces spam and makes invitations and account ownership reliable.

## 8. Scope

### MVP (first deployable version)

* Registration, login, logout, email verification
* Forgot password and reset password
* Server-side sessions stored in PostgreSQL
* Rate limiting on login, registration, and password reset
* Organization creation, membership, leaving an organization, and ownership transfer
* Invitations: sending and accepting
* Role-based authorization, including member removal and role changes, with Owner and Admin limits
* Projects: create, list, update, archive, unarchive
* Tasks: one assignee, status, priority, due date, overdue flag
* Soft-deleted tasks hidden from normal queries
* Comments
* Activity history for tasks and projects
* Task lists with pagination, sorting, filtering (status, priority, assignee, due date), and basic text search on task title
* PostgreSQL migrations and constraints
* Input validation and centralized error handling
* Structured logging with request IDs
* Unit, integration, and API tests, including cross-tenant tests
* Docker-based local development

### Version 1 (after the MVP)

* File attachments
* In-app notifications and real-time updates (Socket.IO)
* Email notifications through a background job queue
* Redis for rate limits, caching, and jobs
* OpenAPI documentation, health checks, monitoring
* Production deployment, CI/CD, backups, and a rollback drill

### Out of scope

OAuth/SSO, two-factor authentication, billing, per-project permissions, subtasks, labels, custom workflows, multiple assignees, drag-and-drop ordering, time tracking, rich text, advanced analytics, Kubernetes, microservices.