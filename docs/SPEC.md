# TeamFlow — Product Specification

## 1. Problem Statement

TeamFlow is a multi-tenant project and task management platform designed for companies and teams that need a centralized place to organize their work. Teams often manage projects, tasks, deadlines, assignments, and discussions across different tools, making it difficult to track progress and coordinate responsibilities. TeamFlow allows each company to create an organization, invite team members, manage projects, assign tasks, and collaborate securely. Each company can access only its own data, while role-based permissions ensure that users can perform only the actions they are authorized to perform. The goal is to improve team productivity, accountability, and visibility into project progress.

## 2. User Roles

* **Owner:** Manages the company, controls organization settings, assigns administrative roles, manages members, and has full control over the organization's resources.
* **Admin:** Manages members, invitations, projects, and organization-level settings, but cannot delete or transfer ownership of the company.
* **Manager:** Creates and manages projects, assigns tasks to team members, updates task details, and monitors project progress.
* **Member:** Views accessible projects, manages assigned tasks, updates task status, and participates in discussions through comments.

## 3. Permission Table

| Action                       | Owner | Admin | Manager | Member         |
| ---------------------------- | ----- | ----- | ------- | -------------- |
| View organization            | Yes   | Yes   | Yes     | Yes            |
| Update organization settings | Yes   | Yes   | No      | No             |
| Delete organization          | Yes   | No    | No      | No             |
| Invite members               | Yes   | Yes   | No      | No             |
| Remove members               | Yes   | Yes   | No      | No             |
| Change member roles          | Yes   | Yes   | No      | No             |
| Create projects              | Yes   | Yes   | Yes     | No             |
| View projects                | Yes   | Yes   | Yes     | Yes            |
| Update project details       | Yes   | Yes   | Yes     | No             |
| Archive projects             | Yes   | Yes   | Yes     | No             |
| Create tasks                 | Yes   | Yes   | Yes     | No             |
| Assign tasks                 | Yes   | Yes   | Yes     | No             |
| View tasks                   | Yes   | Yes   | Yes     | Yes            |
| Update task status           | Yes   | Yes   | Yes     | Yes            |
| Edit task details            | Yes   | Yes   | Yes     | Own tasks only |
| Delete tasks                 | Yes   | Yes   | Yes     | Own tasks only |
| Add comments                 | Yes   | Yes   | Yes     | Yes            |
| Edit own comments            | Yes   | Yes   | Yes     | Yes            |
| Delete own comments          | Yes   | Yes   | Yes     | Yes            |
| Delete other users' comments | Yes   | Yes   | Yes     | No             |

### Permission Rule I Changed

I allow Members to edit and delete their own tasks, but not tasks belonging to other members. This gives team members ownership of their work while preventing unauthorized changes to other people's responsibilities.

## 4. Business Rules

1. Every user must have a verified email address before creating an organization.
2. Every organization must have at least one Owner.
3. A user can belong to multiple organizations, with a potentially different role in each organization.
4. Every project must belong to exactly one organization.
5. Every task must belong to a project, and its project must belong to the same organization as the acting user.
6. Users can access organization resources only if they are authorized members of that organization.
7. Archived projects are read-only: their tasks can be viewed, but tasks cannot be created, edited, reassigned, or deleted while the project is archived.
8. A task may have a due date in the past, but the application should flag it as overdue if it is not completed.
9. Deleting a project archives it by default rather than immediately permanently deleting its tasks and history.
10. Members can update the status of tasks assigned to them and edit or delete their own comments. Only authorized roles can reassign tasks or change project settings.

## 5. User Stories

1. As a **User**, I want to register and log in securely so that I can access my workspace.
2. As a **User**, I want to verify my email address so that my account can be trusted.
3. As a **User**, I want to create a company so that I can organize my team's work in one place.
4. As an **Owner**, I want to invite colleagues so that they can collaborate within my organization.
5. As an **Admin**, I want to manage organization members so that access remains up to date.
6. As a **Manager**, I want to create projects so that I can organize work around specific goals.
7. As a **Manager**, I want to assign tasks to team members so that everyone knows their responsibilities.
8. As a **Member**, I want to view my assigned tasks and update their status so that I can track my work.
9. As a **Member**, I want to comment on tasks so that I can discuss progress and blockers with my team.
10. As an **Owner**, I want to archive completed projects so that old work remains available for reference without being changed.

## 6. Security and "Hacker" Cases

### Attack 1: Accessing Another Company's Task

**Attack:** A logged-in user changes the task ID in the URL to access a task belonging to another company.

**Stopped by:** The server verifies organization membership and retrieves the task through an organization-scoped query, such as filtering by both task ID and organization ID. If the task is not accessible within that organization, the API returns 404.

### Attack 2: Changing the Organization ID

**Attack:** A user modifies the `organizationId` in a request body or query string to access another company's projects.

**Stopped by:** The server derives the user's authorized organization context from the authenticated identity and verifies membership before accessing the requested resource. Client-supplied organization IDs are never treated as proof of authorization.

### Attack 3: Escalating Permissions

**Attack:** A Member sends a request containing `"role": "Owner`" or calls an admin-only endpoint directly.

**Stopped by:** The server checks the authenticated user's role and permissions for the target organization on every protected operation. Unauthorized requests return 403, and sensitive role changes are restricted to authorized roles.

## 7. Decisions and Reasons

### 1. When a project is archived, can people still edit its tasks?

No. Archived projects are read-only. Users can view tasks and comments, but task changes are blocked. This preserves historical records and prevents accidental updates to completed work.

### 2. When a task is deleted, should it be fully removed or just hidden?

A task should be soft-deleted initially. It is marked as deleted and hidden from normal queries, while its history can be retained for recovery and auditing. Permanent deletion, if required, should follow a defined retention policy.

### 3. Can a Member give their task to another person?

No. Members can update the status of tasks assigned to them, but only Managers and authorized administrators can reassign tasks. This prevents users from changing other people's responsibilities without approval.

### 4. Should an unverified user be allowed to create a company?

No. Email verification is required before organization creation. This reduces spam and makes invitations and account ownership more reliable.

## 8. MVP Scope

The first version of TeamFlow will include:

* User registration, login, logout, and email verification
* Organization creation and membership
* Role-based authorization
* Projects and project archiving
* Tasks, assignments, statuses, and due dates
* Comments
* Pagination and filtering
* PostgreSQL migrations and constraints
* Input validation and centralized error handling
* Unit, integration, and API tests
* Docker-based local development

Advanced features such as real-time notifications, Redis caching, file uploads, advanced analytics, and automated production deployment will be introduced in later milestones.
