import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../../app.js";
import { pool } from "../../db/pool.js";
import {
  addMember, createComment, createOrg, createProject, createTask, createUser,
} from "../../db/factories.js";

let acmeId: string;
let hinaId: string;   // member
let zaraId: string;   // another member
let bilalId: string;  // manager
let omarId: string;   // Globex owner
let websiteId: string;
let taskId: string;
let globexCommentId: string;

const commentsUrl = (orgId: string, tId: string) => `/api/v1/orgs/${orgId}/tasks/${tId}/comments`;
const commentUrl = (orgId: string, cId: string) => `/api/v1/orgs/${orgId}/comments/${cId}`;

beforeEach(async () => {
  hinaId = await createUser(pool, "hina@acme.test", "Hina");
  zaraId = await createUser(pool, "zara@acme.test", "Zara");
  bilalId = await createUser(pool, "bilal@acme.test", "Bilal");
  omarId = await createUser(pool, "omar@globex.test", "Omar");

  acmeId = await createOrg(pool, "Acme");
  const globexId = await createOrg(pool, "Globex");

  await addMember(pool, acmeId, hinaId, "member");
  await addMember(pool, acmeId, zaraId, "member");
  await addMember(pool, acmeId, bilalId, "manager");
  await addMember(pool, globexId, omarId, "owner");

  websiteId = await createProject(pool, acmeId, "Website", bilalId);
  taskId = await createTask(pool, {
    orgId: acmeId, projectId: websiteId, title: "Header", status: "todo",
    priority: "medium", dueInDays: null, assigneeId: hinaId, createdBy: bilalId,
  });

  const globexProject = await createProject(pool, globexId, "Rocket", omarId);
  const globexTask = await createTask(pool, {
    orgId: globexId, projectId: globexProject, title: "Secret", status: "todo",
    priority: "low", dueInDays: null, assigneeId: null, createdBy: omarId,
  });
  globexCommentId = await createComment(pool, {
    orgId: globexId, taskId: globexTask, authorId: omarId, body: "Globex only",
  });
});

describe("POST /tasks/:taskId/comments", () => {
  it("lets any member comment, returns the author's name, and logs activity", async () => {
    const res = await request(app)
      .post(commentsUrl(acmeId, taskId)).set("X-Dev-User-Id", zaraId).send({ body: "  Looks good!  " });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      body: "Looks good!",
      taskId,
      author: { id: zaraId, name: "Zara" },
      isEdited: false,
    });
    expect(res.body.data.author.email).toBeUndefined(); // never leak emails

    const { rows } = await pool.query(
      "SELECT action, metadata FROM activity_events WHERE entity_id = $1", [res.body.data.id],
    );
    expect(rows).toEqual([{ action: "comment.created", metadata: { taskId } }]);
  });

  it("IDOR: 404 for another company's task", async () => {
    const globexTaskId = (await pool.query("SELECT task_id FROM comments WHERE id = $1", [globexCommentId])).rows[0].task_id;
    const res = await request(app)
      .post(commentsUrl(acmeId, globexTaskId)).set("X-Dev-User-Id", bilalId).send({ body: "hi" });
    expect(res.status).toBe(404);
  });

  it("404 for a deleted task", async () => {
    await pool.query("UPDATE tasks SET deleted_at = now() WHERE id = $1", [taskId]);
    const res = await request(app)
      .post(commentsUrl(acmeId, taskId)).set("X-Dev-User-Id", hinaId).send({ body: "hi" });
    expect(res.status).toBe(404);
  });

  it("409 when the project is archived", async () => {
    await pool.query("UPDATE projects SET archived_at = now() WHERE id = $1", [websiteId]);
    const res = await request(app)
      .post(commentsUrl(acmeId, taskId)).set("X-Dev-User-Id", hinaId).send({ body: "hi" });
    expect(res.status).toBe(409);
  });

  it.each([
    ["blank body", { body: "   " }],
    ["fake author (mass assignment)", { body: "hi", authorId: "x" }],
  ])("rejects invalid body: %s", async (_label, body) => {
    const res = await request(app)
      .post(commentsUrl(acmeId, taskId)).set("X-Dev-User-Id", hinaId).send(body);
    expect(res.status).toBe(400);
  });
});

describe("GET /tasks/:taskId/comments", () => {
  it("lists comments oldest first with author names", async () => {
    await createComment(pool, { orgId: acmeId, taskId, authorId: hinaId, body: "First" });
    await createComment(pool, { orgId: acmeId, taskId, authorId: bilalId, body: "Second" });

    const res = await request(app).get(commentsUrl(acmeId, taskId)).set("X-Dev-User-Id", zaraId);

    expect(res.status).toBe(200);
    expect(res.body.data.map((c: { body: string }) => c.body)).toEqual(["First", "Second"]);
    expect(res.body.data[1].author.name).toBe("Bilal");
    expect(res.body.meta.pagination.total).toBe(2);
  });
});

describe("PATCH / DELETE /comments/:commentId", () => {
  let hinaCommentId: string;

  beforeEach(async () => {
    hinaCommentId = await createComment(pool, { orgId: acmeId, taskId, authorId: hinaId, body: "Original" });
  });

  it("author can edit their own comment (isEdited becomes true)", async () => {
    const res = await request(app)
      .patch(commentUrl(acmeId, hinaCommentId)).set("X-Dev-User-Id", hinaId).send({ body: "Fixed typo" });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ body: "Fixed typo", isEdited: true });
  });

  it("another member cannot edit it", async () => {
    const res = await request(app)
      .patch(commentUrl(acmeId, hinaCommentId)).set("X-Dev-User-Id", zaraId).send({ body: "Changed" });
    expect(res.status).toBe(403);
  });

  it("author can delete their own comment", async () => {
    const res = await request(app).delete(commentUrl(acmeId, hinaCommentId)).set("X-Dev-User-Id", hinaId);
    expect(res.status).toBe(204);

    const list = await request(app).get(commentsUrl(acmeId, taskId)).set("X-Dev-User-Id", hinaId);
    expect(list.body.data).toHaveLength(0);
  });

  it("manager can delete someone else's comment", async () => {
    const res = await request(app).delete(commentUrl(acmeId, hinaCommentId)).set("X-Dev-User-Id", bilalId);
    expect(res.status).toBe(204);
  });

  // YOUR TURN (Step 8):
  // 1. Manager tries to EDIT Hina's comment → 403 (nobody edits others' words)
  // 2. Zara (member) tries to DELETE Hina's comment → 403, and the comment still exists
  // 3. IDOR: DELETE globexCommentId through the Acme URL as Bilal → 404, and it still exists
});