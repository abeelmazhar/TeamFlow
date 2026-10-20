import type { Db } from "../../db/pool.js";
import type { Role } from "../../lib/roles.js";
import type { TenantContext } from "../../lib/tenant-context.js";

type MembershipRow = { organization_id: string; user_id: string; role: Role };

export async function findMembership(
  db: Db,
  organizationId: string,
  userId: string,
): Promise<TenantContext | null> {
  const { rows } = await db.query<MembershipRow>(
    `SELECT organization_id, user_id, role
     FROM memberships
     WHERE organization_id = $1 AND user_id = $2`,
    [organizationId, userId],
  );
  const row = rows[0];
  if (!row) return null;
  return { organizationId: row.organization_id, userId: row.user_id, role: row.role };
}