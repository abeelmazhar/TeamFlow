import { forbidden } from "./errors.js";
import type { Role } from "./roles.js";

// Mirrors the permission table in docs/SPEC.md. Keep them in sync.
const PERMISSIONS = {
  "project:create": ["owner", "admin", "manager"],
  "project:update": ["owner", "admin", "manager"],
  "project:archive": ["owner", "admin", "manager"],
  "task:create": ["owner", "admin", "manager"],
} as const satisfies Record<string, readonly Role[]>;

export type Action = keyof typeof PERMISSIONS;

export function can(role: Role, action: Action): boolean {
  return (PERMISSIONS[action] as readonly Role[]).includes(role);
}

export function assertCan(role: Role, action: Action): void {
  if (!can(role, action)) {
    throw forbidden();
  }
}