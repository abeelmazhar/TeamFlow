# TeamFlow — Project Progress

## Current
Phase 0, Milestone 0.1: Product spec & decisions — Final (waiting for interview answers)

## Completed
- Day 1: Problem, scope, roles, rules, architecture proposed
- Day 2: SPEC.md and DECISIONS.md written, reviewed twice, and finalized

## Files created/changed
- README.md (empty placeholder)
- docs/SPEC.md (final)
- docs/DECISIONS.md (final, Decisions 1–5)
- docs/PROJECT_PROGRESS.md

## Commands run & verified results
- git init, docs folder and files created
- Commits: (paste output of `git log --oneline` here)

## Decisions (confirmed)
- One shared PostgreSQL database; organization_id on every tenant table; composite foreign keys
- Organization ID comes from the URL (/api/v1/orgs/:orgId/...); role loaded from membership in the database
- 401 not logged in; 404 not a member or not in this org; 403 member without permission; 400 invalid input
- Sessions in PostgreSQL; random ID in HttpOnly, Secure, SameSite=Lax cookie; only a SHA-256 hash stored
- CSRF: SameSite=Lax plus Origin check; XSS: output escaping plus CSP
- Passwords: Argon2id (bcrypt fallback)
- Exactly one Owner; ownership transfer required before the Owner leaves
- Admin manages only Managers and Members
- Members can update, edit, and delete only tasks assigned to them; cannot create or reassign
- Removing a member unassigns their open tasks in the same transaction
- Invitations expire, are single-use, and require a matching verified email
- Unverified users cannot create or join organizations
- Archived projects are read-only; deleting a project archives it
- Tasks are soft-deleted (deleted_at); repositories always filter them out
- Activity events written in the same transaction as the change
- All org members see all projects (MVP); one assignee per task
- Modular monolith; worker process added in Version 1

## Open questions
- None

## Known bugs / blockers
- None (no code yet)

## Known issues
- devAuth header is temporary; remove in Phase 4.

## Tests run
- None yet (no code)

## Next exact task
1. Replace docs with the final SPEC.md, DECISIONS.md, PROJECT_PROGRESS.md
2. Commit: `docs: finalize TeamFlow spec and architecture decisions`
3. Answer the 5 Day 1 interview questions
4. Start Phase 1: discuss the repository folder structure before any setup code

## Progress tracker
| Milestone | Status | Evidence | Pending | Next action |
|---|---|---|---|---|
| 0.1 Spec & decisions | Completed (pending interview answers) | docs/SPEC.md, docs/DECISIONS.md final | Interview answers | Commit and answer questions |
| 1.1 Folder structure discussion | Not started | — | — | Next session |
| 1.2 Repo & tooling setup | Not started | — | Verify package versions | After 1.1 |