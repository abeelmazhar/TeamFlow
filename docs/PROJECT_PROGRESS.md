# TeamFlow — Project Progress

## Current
Phase 0, Milestone 0.1: Product spec & ADRs (In progress)

## Completed
- Day 1 lesson: scope, roles, rules, architecture proposed

## Files created/changed
- (fill in) README.md, docs/SPEC.md, docs/DECISIONS.md, PROJECT_PROGRESS.md

## Commands run & verified results
- (fill in after you run them)

## Decisions (proposed, pending your confirmation)
- Shared-schema multi-tenancy; org_id on every tenant table; composite FKs
- Tenant routes: /api/v1/orgs/:orgId/...; role loaded from DB membership
- Cross-tenant access returns 404
- Auth: opaque session token, httpOnly Secure SameSite=Lax cookie, hashed in DB
- Passwords: Argon2id
- All org members see all projects (MVP); one assignee per task
- Modular monolith + separate worker process

## Open questions
- Q1 archived project behavior, Q2 task delete semantics,
  Q3 member reassignment, Q4 unverified users creating orgs

## Known bugs / blockers
- None yet

## Tests run
- None yet (no code)

## Next exact task
- Finish SPEC.md, DECISIONS.md, answer Q1–Q4, commit, then share all three
  plus interview answers for review.