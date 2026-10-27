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