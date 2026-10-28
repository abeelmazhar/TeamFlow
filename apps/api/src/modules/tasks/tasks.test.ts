import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../../app.js";
import { pool } from "../../db/pool.js";
import { addMember, createOrg, createProject, createTask, createUser } from "../../db/factories.js";

let acmeId: string;
let hinaId: string;   // member
let bilalId: string;  // manager
let omarId: string;   // Globex owner
let websiteId: string;
let globexProjectId: string;

const tasksUrl = (orgId: string, projectId: string) =>
  `/api/v1/orgs/${orgId}/projects/${projectId}/tasks`;

beforeEach(async () => {
  hinaId = await createUser(pool, "hina@acme.test", "Hina");
  bilalId = await createUser(pool, "bilal@acme.test", "Bilal");
  omarId = await createUser(pool, "omar@globex.test", "Omar");

  acmeId = await createOrg(pool, "Acme");
  const globexId = await createOrg(pool, "Globex");

  await addMember(pool, acmeId, hinaId, "member");
  await addMember(pool, acmeId, bilalId, "manager");
  await addMember(pool, globexId, omarId, "owner");

  websiteId = await createProject(pool, acmeId, "Website", bilalId);
  globexProjectId = await createProject(pool, globexId, "Rocket", omarId);
});

describe("POST /projects/:projectId/tasks", () => {
  it("lets a manager create a task and records activity", async () => {
    const res = await request(app)
      .post(tasksUrl(acmeId, websiteId))
      .set("X-Dev-User-Id", bilalId)
      .send({ title: "Build header", priority: "high", assigneeId: hinaId, dueDate: "2030-11-30" });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      title: "Build header",
      status: "todo",
      priority: "high",
      assigneeId: hinaId,
      projectId: websiteId,
      dueDate: "2030-11-30", // exactly as sent: no time zone shift!
      isOverdue: false,
    });

    const { rows } = await pool.query(
      "SELECT action FROM activity_events WHERE entity_id = $1",
      [res.body.data.id],
    );
    expect(rows).toEqual([{ action: "task.created" }]);
  });

  it("forbids a member", async () => {
    const res = await request(app)
      .post(tasksUrl(acmeId, websiteId))
      .set("X-Dev-User-Id", hinaId)
      .send({ title: "Nope" });
    expect(res.status).toBe(403);
  });

  it("IDOR: 404 for another company's project", async () => {
    const res = await request(app)
      .post(tasksUrl(acmeId, globexProjectId))
      .set("X-Dev-User-Id", bilalId)
      .send({ title: "Sneaky" });
    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe("Project not found");
  });

  it("returns 409 when the project is archived", async () => {
    await pool.query("UPDATE projects SET archived_at = now() WHERE id = $1", [websiteId]);
    const res = await request(app)
      .post(tasksUrl(acmeId, websiteId))
      .set("X-Dev-User-Id", bilalId)
      .send({ title: "Too late" });
    expect(res.status).toBe(409);
  });

  it("rejects an assignee from another company, and saves nothing", async () => {
    const res = await request(app)
      .post(tasksUrl(acmeId, websiteId))
      .set("X-Dev-User-Id", bilalId)
      .send({ title: "Give to Omar", assigneeId: omarId });

    expect(res.status).toBe(400);
    const { rows } = await pool.query("SELECT count(*)::int AS n FROM tasks");
    expect(rows[0].n).toBe(0);
  });

  it.each([
    ["blank title", { title: "  " }],
    ["bad date", { title: "X", dueDate: "2026-13-45" }],
    ["bad priority", { title: "X", priority: "critical" }],
    ["status not allowed on create", { title: "X", status: "done" }],
  ])("rejects invalid body: %s", async (_label, body) => {
    const res = await request(app)
      .post(tasksUrl(acmeId, websiteId))
      .set("X-Dev-User-Id", bilalId)
      .send(body);
    expect(res.status).toBe(400);
  });
});

describe("GET /projects/:projectId/tasks", () => {
  it("lists this project's tasks, hides deleted ones, and flags overdue", async () => {
    await createTask(pool, {
      orgId: acmeId, projectId: websiteId, title: "Late task", status: "todo",
      priority: "high", dueInDays: -2, assigneeId: hinaId, createdBy: bilalId,
    });
    const deletedId = await createTask(pool, {
      orgId: acmeId, projectId: websiteId, title: "Deleted task", status: "todo",
      priority: "low", dueInDays: null, assigneeId: null, createdBy: bilalId,
    });
    await pool.query("UPDATE tasks SET deleted_at = now() WHERE id = $1", [deletedId]);

    const res = await request(app).get(tasksUrl(acmeId, websiteId)).set("X-Dev-User-Id", hinaId);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({ title: "Late task", isOverdue: true });
    expect(res.body.meta.pagination.total).toBe(1);
  });

  it("IDOR: 404 for another company's project", async () => {
    const res = await request(app).get(tasksUrl(acmeId, globexProjectId)).set("X-Dev-User-Id", hinaId);
    expect(res.status).toBe(404);
  });

  // YOUR TURN (see Step 7)
});

const taskUrl = (orgId: string, taskId: string) => `/api/v1/orgs/${orgId}/tasks/${taskId}`;

describe("single task: GET / PATCH / DELETE", () => {
  let hinaTaskId: string;   // assigned to Hina (member)
  let bilalTaskId: string;  // assigned to Bilal (manager)
  let globexTaskId: string;

  beforeEach(async () => {
    hinaTaskId = await createTask(pool, {
      orgId: acmeId, projectId: websiteId, title: "Hina's task", status: "todo",
      priority: "medium", dueInDays: 5, assigneeId: hinaId, createdBy: bilalId,
    });
    bilalTaskId = await createTask(pool, {
      orgId: acmeId, projectId: websiteId, title: "Bilal's task", status: "todo",
      priority: "medium", dueInDays: null, assigneeId: bilalId, createdBy: bilalId,
    });
    const globexOrgId = (
      await pool.query("SELECT organization_id FROM projects WHERE id = $1", [globexProjectId])
    ).rows[0].organization_id;
    globexTaskId = await createTask(pool, {
      orgId: globexOrgId, projectId: globexProjectId, title: "Globex secret", status: "todo",
      priority: "low", dueInDays: null, assigneeId: omarId, createdBy: omarId,
    });
  });

  // ---------- GET ----------
  it("GET: any member can view a task", async () => {
    const res = await request(app).get(taskUrl(acmeId, bilalTaskId)).set("X-Dev-User-Id", hinaId);
    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe("Bilal's task");
  });

  it("GET IDOR: another company's task → 404", async () => {
    const res = await request(app).get(taskUrl(acmeId, globexTaskId)).set("X-Dev-User-Id", bilalId);
    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe("Task not found");
  });

  it("GET: a deleted task → 404", async () => {
    await pool.query("UPDATE tasks SET deleted_at = now() WHERE id = $1", [hinaTaskId]);
    const res = await request(app).get(taskUrl(acmeId, hinaTaskId)).set("X-Dev-User-Id", hinaId);
    expect(res.status).toBe(404);
  });

  // ---------- PATCH ----------
  it("PATCH: assignee member can complete and reopen their task (completedAt follows)", async () => {
    const done = await request(app)
      .patch(taskUrl(acmeId, hinaTaskId)).set("X-Dev-User-Id", hinaId).send({ status: "done" });
    expect(done.status).toBe(200);
    expect(done.body.data.status).toBe("done");
    expect(done.body.data.completedAt).not.toBeNull();

    const reopened = await request(app)
      .patch(taskUrl(acmeId, hinaTaskId)).set("X-Dev-User-Id", hinaId).send({ status: "in_progress" });
    expect(reopened.status).toBe(200);
    expect(reopened.body.data.completedAt).toBeNull();
  });

  it("PATCH: member cannot edit a task assigned to someone else", async () => {
    const res = await request(app)
      .patch(taskUrl(acmeId, bilalTaskId)).set("X-Dev-User-Id", hinaId).send({ title: "Mine now" });
    expect(res.status).toBe(403);
    const { rows } = await pool.query("SELECT title FROM tasks WHERE id = $1", [bilalTaskId]);
    expect(rows[0].title).toBe("Bilal's task");
  });

  it("PATCH: member cannot reassign their own task", async () => {
    const res = await request(app)
      .patch(taskUrl(acmeId, hinaTaskId)).set("X-Dev-User-Id", hinaId).send({ assigneeId: bilalId });
    expect(res.status).toBe(403);
  });

  it("PATCH: member sending their OWN current assigneeId is not a reassignment", async () => {
    const res = await request(app)
      .patch(taskUrl(acmeId, hinaTaskId)).set("X-Dev-User-Id", hinaId)
      .send({ status: "in_progress", assigneeId: hinaId });
    expect(res.status).toBe(200);
  });

  it("PATCH: manager reassigns and activity records from/to", async () => {
    const res = await request(app)
      .patch(taskUrl(acmeId, hinaTaskId)).set("X-Dev-User-Id", bilalId).send({ assigneeId: bilalId });
    expect(res.status).toBe(200);
    expect(res.body.data.assigneeId).toBe(bilalId);

    const { rows } = await pool.query(
      "SELECT action, metadata FROM activity_events WHERE entity_id = $1", [hinaTaskId],
    );
    expect(rows).toEqual([
      { action: "task.updated", metadata: { assigneeId: { from: hinaId, to: bilalId } } },
    ]);
  });

  it("PATCH: manager can unassign with null", async () => {
    const res = await request(app)
      .patch(taskUrl(acmeId, hinaTaskId)).set("X-Dev-User-Id", bilalId).send({ assigneeId: null });
    expect(res.status).toBe(200);
    expect(res.body.data.assigneeId).toBeNull();
  });

  it("PATCH: cannot assign to someone outside the company → 400", async () => {
    const res = await request(app)
      .patch(taskUrl(acmeId, hinaTaskId)).set("X-Dev-User-Id", bilalId).send({ assigneeId: omarId });
    expect(res.status).toBe(400);
  });

  it("PATCH: archived project → 409", async () => {
    await pool.query("UPDATE projects SET archived_at = now() WHERE id = $1", [websiteId]);
    const res = await request(app)
      .patch(taskUrl(acmeId, hinaTaskId)).set("X-Dev-User-Id", bilalId).send({ status: "done" });
    expect(res.status).toBe(409);
  });

  it("PATCH IDOR: another company's task → 404 and unchanged", async () => {
    const res = await request(app)
      .patch(taskUrl(acmeId, globexTaskId)).set("X-Dev-User-Id", bilalId).send({ title: "Hacked" });
    expect(res.status).toBe(404);
    const { rows } = await pool.query("SELECT title FROM tasks WHERE id = $1", [globexTaskId]);
    expect(rows[0].title).toBe("Globex secret");
  });

  // ---------- DELETE ----------
  it("DELETE: assignee member soft-deletes their task", async () => {
    const res = await request(app).delete(taskUrl(acmeId, hinaTaskId)).set("X-Dev-User-Id", hinaId);
    expect(res.status).toBe(204);

    // Gone for the API...
    const get = await request(app).get(taskUrl(acmeId, hinaTaskId)).set("X-Dev-User-Id", hinaId);
    expect(get.status).toBe(404);

    // ...but still in the database, with history
    const { rows } = await pool.query("SELECT deleted_at FROM tasks WHERE id = $1", [hinaTaskId]);
    expect(rows[0].deleted_at).not.toBeNull();
    const events = await pool.query(
      "SELECT action FROM activity_events WHERE entity_id = $1", [hinaTaskId],
    );
    expect(events.rows).toEqual([{ action: "task.deleted" }]);
  });

  // YOUR TURN (Step 8):
  // 1. PATCH: manager clears the due date with { dueDate: null } → 200, dueDate null
  // 2. DELETE: member deleting a task assigned to someone else → 403, task still visible
  // 3. DELETE twice → first 204, second 404
});