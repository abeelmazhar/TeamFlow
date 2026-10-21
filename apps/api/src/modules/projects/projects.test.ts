import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../../app.js";
import { pool } from "../../db/pool.js";
import { addMember, createOrg, createProject, createUser } from "../../db/factories.js";

let acmeId: string;
let hinaId: string;
let omarId: string;

const listUrl = (orgId: string) => `/api/v1/orgs/${orgId}/projects`;

// Runs before EACH test (after setup.ts has emptied the DB)
beforeEach(async () => {
  hinaId = await createUser(pool, "hina@acme.test", "Hina");
  omarId = await createUser(pool, "omar@globex.test", "Omar");

  acmeId = await createOrg(pool, "Acme");
  const globexId = await createOrg(pool, "Globex");

  await addMember(pool, acmeId, hinaId, "member");
  await addMember(pool, globexId, omarId, "owner");

  await createProject(pool, acmeId, "Website Redesign", hinaId);
  await createProject(pool, acmeId, "Mobile App", hinaId);
  await createProject(pool, globexId, "Secret Globex Project", omarId);
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