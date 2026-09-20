export type FintelRole = "admin" | "analyst" | "client" | "viewer" | "user";

export const ROLE_PERMISSIONS: Record<FintelRole, string[]> = {
  admin: ["*"],
  analyst: ["market.read", "quant.read", "quant.run", "research.read", "portfolio.read", "portfolio.write", "risk.run", "data.read"],
  client: ["market.read", "portfolio.read", "risk.read", "reports.read"],
  viewer: ["market.read", "research.read", "data.read"],
  user: ["market.read"],
};

export const WORKSPACE_PERMISSIONS: Record<string, string> = {
  overview: "market.read",
  market: "market.read",
  curve: "quant.read",
  fixedIncome: "quant.read",
  derivatives: "quant.run",
  risk: "risk.read",
  portfolio: "portfolio.read",
  models: "quant.read",
  research: "research.read",
  data: "data.read",
  settings: "admin.settings",
};

export function hasPermission(role: string | null | undefined, permission: string) {
  if (!role) return false;
  const permissions = ROLE_PERMISSIONS[role as FintelRole] ?? [];
  return permissions.includes("*") || permissions.includes(permission);
}
