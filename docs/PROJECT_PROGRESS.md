# TeamFlow — Project Progress

## Current
Phase 0, Milestone 0.1: Product spec & ADRs (Ready for review)

## Completed
- Day 1 lesson: scope, roles, rules, architecture proposed
- SPEC.md updated from review: permission table, Admin limit, task and assignee rules, attacks 2 and 3, MVP items, two user stories, soft-delete risk
- DECISIONS.md Decision 2 set to PostgreSQL sessions
- Interview answers for the five open product questions

## Files created/changed
- README.md (empty placeholder)
- docs/SPEC.md
- docs/DECISIONS.md
- docs/PROJECT_PROGRESS.md

## Commands run & verified results
- No application commands yet (documentation only)

## Decisions (proposed, pending your confirmation)
- Shared-schema multi-tenancy; org_id on every tenant table; composite FKs
- Tenant routes: /api/v1/orgs/:orgId/...; role loaded from DB membership
- Cross-tenant access returns 404; a member who lacks permission receives 403
- Auth: opaque session id in an HttpOnly Secure SameSite=Lax cookie; hash stored in PostgreSQL, not Redis
- Passwords: Argon2id
- All org members see all projects (MVP); one assignee per task
- Members update, edit, and delete only tasks assigned to them
- Admin cannot grant, change, or remove the Owner role
- Archived projects are read-only
- Tasks are soft-deleted and excluded from normal reads
- Unverified users cannot create an organization
- Modular monolith + separate worker process

## Open questions
- None. Q1–Q4 and the session-store choice are decided in SPEC.md and DECISIONS.md.

## Known bugs / blockers
- None yet

## Tests run
- None yet (no code)

## Next exact task
- Submit SPEC.md, DECISIONS.md, PROJECT_PROGRESS.md, and the interview answers for review.
