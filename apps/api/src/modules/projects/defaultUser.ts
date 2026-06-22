import { prisma } from "../../db/client.js";

let defaultUserId: string | null = null;

/** Phase 1 has no real multi-user auth (see docs/12-security-and-auth.md) --
 * a single local user is ensured at boot so projects have a stable owner. */
export async function ensureDefaultUser(): Promise<string> {
  const user = await prisma.user.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: { id: "00000000-0000-0000-0000-000000000001", email: "local@agentry.dev" },
  });
  defaultUserId = user.id;
  return user.id;
}

export function getDefaultUserId(): string {
  if (!defaultUserId) throw new Error("ensureDefaultUser() must run at boot before this is called");
  return defaultUserId;
}
