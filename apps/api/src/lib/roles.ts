export const ROLES = ["owner", "admin", "manager", "member"] as const;
export type Role = (typeof ROLES)[number]; // "owner" | "admin" | "manager" | "member"