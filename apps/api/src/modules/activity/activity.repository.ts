import type { Db } from "../../db/pool.js";

export type NewActivity = {
  organizationId: string;
  actorId: string | null;
  action: string; // e.g. "project.created"
  entityType: "organization" | "membership" | "project" | "task" | "comment";
  entityId: string;
  projectId: string | null;
  metadata?: Record<string, unknown>;
};

export async function insertActivity(db: Db, e: NewActivity): Promise<void> {
  await db.query(
    `INSERT INTO activity_events
       (organization_id, actor_id, action, entity_type, entity_id, project_id, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [e.organizationId, e.actorId, e.action, e.entityType, e.entityId, e.projectId, e.metadata ?? {}],
  );
}