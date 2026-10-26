import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../../app.js";
import { pool } from "../../db/pool.js";
import { addMember, createOrg, createProject, createUser } from "../../db/factories.js";

let acmeId: string;
let hinaId: string;
let omarId: string;
let bilalId: string;
let websiteId: string;
let globexProjectId: string;

const listUrl = (orgId: string) => `/api/v1/orgs/${orgId}/projects`;
const projectUrl = (orgId: string, projectId: string) => `/api/v1/orgs/${orgId}/projects/${projectId}`;

beforeEach(async () => {
  hinaId = await createUser(pool, "hina@acme.test", "Hina");
  bilalId = await createUser(pool, "bilal@acme.test", "Bilal");
  omarId = await createUser(pool, "omar@globex.test", "Omar");

  acmeId = await createOrg(pool, "Acme");
  const globexId = await createOrg(pool, "Globex");

  await addMember(pool, acmeId, hinaId, "member");
  await addMember(pool, acmeId, bilalId, "manager");
  await addMember(pool, globexId, omarId, "owner");

  websiteId = await createProject(pool, acmeId, "Website Redesign", hinaId);
  await createProject(pool, acmeId, "Mobile App", hinaId);
  globexProjectId = await createProject(pool, globexId, "Secret Globex Project", omarId);
});

describe("GET /api/v1/orgs/:orgId/projects", () => {
  it("returns only this org's projects to a member", async () => {
    const res = await request(app).get(listUrl(acmeId)).set("X-Dev-User-Id", hinaId);

    expect(res.status).toBe(200);
    const names = res.body.data.map((p: { name: string }) => p.name).sort();
    expect(names).toEqual(["Mobile App", "Website Redesign"]); // no Globex project!
    expect(res.body.meta.pagination).toEqual({ page: 1, limit: 20, total: 2, totalPages: 1 });
  });

  it("returns 404 to a user from another organization", async () => {
    const res = await request(app).get(listUrl(acmeId)).set("X-Dev-User-Id", omarId);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("returns 401 when the dev user header is missing", async () => {
    const res = await request(app).get(listUrl(acmeId));

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 404 when the org id is not a uuid", async () => {
    const res = await request(app).get(listUrl("abc")).set("X-Dev-User-Id", hinaId);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("returns the second page with one project per page", async () => {
    const res = await request(app)
      .get(listUrl(acmeId))
      .query({ limit: 1, page: 2 })
      .set("X-Dev-User-Id", hinaId);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta.pagination).toEqual({ page: 2, limit: 1, total: 2, totalPages: 2 });
  });

  it("returns 400 when limit is above the maximum", async () => {
    const res = await request(app)
      .get(listUrl(acmeId))
      .query({ limit: 500 })
      .set("X-Dev-User-Id", hinaId);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details[0].path).toBe("limit");
  });

  it("returns only archived projects", async () => {
    const empty = await request(app)
      .get(listUrl(acmeId))
      .query({ status: "archived" })
      .set("X-Dev-User-Id", hinaId);

    expect(empty.status).toBe(200);
    expect(empty.body.data).toEqual([]);

    await pool.query(
      `UPDATE projects SET archived_at = now()
       WHERE organization_id = $1 AND name = $2`,
      [acmeId, "Mobile App"],
    );

    const archived = await request(app)
      .get(listUrl(acmeId))
      .query({ status: "archived" })
      .set("X-Dev-User-Id", hinaId);

    expect(archived.status).toBe(200);
    const names = archived.body.data.map((p: { name: string }) => p.name);
    expect(names).toEqual(["Mobile App"]);
  });
});




describe("POST /api/v1/orgs/:orgId/projects", () => {
  it.each(["owner", "admin", "manager"] as const)(
    "lets a %s create a project and records activity",
    async (role) => {
      const userId = await createUser(pool, `${role}@acme.test`, role);
      await addMember(pool, acmeId, userId, role);

      const res = await request(app)
        .post(listUrl(acmeId))
        .set("X-Dev-User-Id", userId)
        .send({ name: "  New Website  ", description: "Redesign" });

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        name: "New Website", // trimmed
        description: "Redesign",
        archivedAt: null,
      });

      // The activity event was saved in the same transaction
      const { rows } = await pool.query(
        `SELECT action, actor_id, entity_type, entity_id
         FROM activity_events WHERE organization_id = $1`,
        [acmeId],
      );
      expect(rows).toEqual([
        { action: "project.created", actor_id: userId, entity_type: "project", entity_id: res.body.data.id },
      ]);
    },
  );

  it("forbids a member from creating a project, and saves nothing", async () => {
    const res = await request(app)
      .post(listUrl(acmeId))
      .set("X-Dev-User-Id", hinaId) // Hina is a member
      .send({ name: "Sneaky Project" });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");

    const { rows } = await pool.query(
      "SELECT count(*)::int AS n FROM projects WHERE name = 'Sneaky Project'",
    );
    expect(rows[0].n).toBe(0);
  });

  it("returns 404 to a user from another organization", async () => {
    const res = await request(app)
      .post(listUrl(acmeId))
      .set("X-Dev-User-Id", omarId)
      .send({ name: "Hacked" });

    expect(res.status).toBe(404);
  });

  it.each([
    ["missing name", {}],
    ["blank name", { name: "   " }],
    ["name too long", { name: "x".repeat(121) }],
    ["mass assignment: organizationId", { name: "Ok", organizationId: "anything" }],
    ["mass assignment: createdBy", { name: "Ok", createdBy: "anything" }],
  ])("rejects invalid body: %s", async (_label, body) => {
    const managerId = await createUser(pool, "manager@acme.test", "Manager");
    await addMember(pool, acmeId, managerId, "manager");

    const res = await request(app)
      .post(listUrl(acmeId))
      .set("X-Dev-User-Id", managerId)
      .send(body);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});


// ------------------------------------------------------------
//-----------------------------------------------------------
describe("GET /api/v1/orgs/:orgId/projects/:projectId", () => {
  it("returns the project to a member", async () => {
    const res = await request(app).get(projectUrl(acmeId, websiteId)).set("X-Dev-User-Id", hinaId);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: websiteId, name: "Website Redesign" });
  });

  it("IDOR: returns 404 for another company's project through my org URL", async () => {
    const res = await request(app)
      .get(projectUrl(acmeId, globexProjectId)) // real ID, wrong company
      .set("X-Dev-User-Id", hinaId);
    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe("Project not found");
  });

  it("IDOR: returns 404 when using the other company's org URL", async () => {
    const res = await request(app)
      .get(projectUrl(/* Globex org */ (await orgOfProject(globexProjectId)), globexProjectId))
      .set("X-Dev-User-Id", hinaId);
    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe("Organization not found");
  });

  it("returns 404 for an invalid project id", async () => {
    const res = await request(app).get(projectUrl(acmeId, "abc")).set("X-Dev-User-Id", hinaId);
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/v1/orgs/:orgId/projects/:projectId", () => {
  it("lets a manager rename a project and records what changed", async () => {
    const res = await request(app)
      .patch(projectUrl(acmeId, websiteId))
      .set("X-Dev-User-Id", bilalId)
      .send({ name: "Website v2" });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("Website v2");

    const { rows } = await pool.query(
      "SELECT action, metadata FROM activity_events WHERE entity_id = $1",
      [websiteId],
    );
    expect(rows).toEqual([
      { action: "project.updated", metadata: { name: { from: "Website Redesign", to: "Website v2" } } },
    ]);
  });

  it("clears the description when sent null", async () => {
    await pool.query("UPDATE projects SET description = 'old' WHERE id = $1", [websiteId]);
    const res = await request(app)
      .patch(projectUrl(acmeId, websiteId))
      .set("X-Dev-User-Id", bilalId)
      .send({ description: null });

    expect(res.status).toBe(200);
    expect(res.body.data.description).toBeNull();
  });

  it("forbids a member", async () => {
    const res = await request(app)
      .patch(projectUrl(acmeId, websiteId))
      .set("X-Dev-User-Id", hinaId)
      .send({ name: "Nope" });
    expect(res.status).toBe(403);
  });

  it("IDOR: cannot update another company's project, and it stays unchanged", async () => {
    const res = await request(app)
      .patch(projectUrl(acmeId, globexProjectId))
      .set("X-Dev-User-Id", bilalId)
      .send({ name: "Hacked" });
    expect(res.status).toBe(404);

    const { rows } = await pool.query("SELECT name FROM projects WHERE id = $1", [globexProjectId]);
    expect(rows[0].name).toBe("Secret Globex Project");
  });

  it("rejects an empty body", async () => {
    const res = await request(app)
      .patch(projectUrl(acmeId, websiteId))
      .set("X-Dev-User-Id", bilalId)
      .send({});
    expect(res.status).toBe(400);
  });

  it("returns 409 when the project is archived", async () => {
    await pool.query("UPDATE projects SET archived_at = now() WHERE id = $1", [websiteId]);
    const res = await request(app)
      .patch(projectUrl(acmeId, websiteId))
      .set("X-Dev-User-Id", bilalId)
      .send({ name: "Too late" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CONFLICT");
  });
});

// Small helper for the second IDOR test
async function orgOfProject(projectId: string): Promise<string> {
  const { rows } = await pool.query("SELECT organization_id FROM projects WHERE id = $1", [projectId]);
  return rows[0].organization_id;
}