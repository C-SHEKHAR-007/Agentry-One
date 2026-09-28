import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../db/client.js";

export const SESSION_COOKIE = "agentry_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/** Pure: sha256 hex of a session token. The raw token lives only in the
 * cookie; the DB stores this hash so a DB leak can't replay sessions. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// A real bcrypt hash of a random value, so a login for an unknown email costs
// the same as one for a known email (no timing oracle for account existence).
const DUMMY_HASH = bcrypt.hashSync(randomBytes(16).toString("hex"), 10);

/** Constant-work password check: always runs bcrypt, even with no user. */
export async function verifyPasswordOrDummy(password: string, hash: string | null | undefined): Promise<boolean> {
  const ok = await bcrypt.compare(password, hash ?? DUMMY_HASH);
  return ok && Boolean(hash);
}

/** Ends a user's sessions (e.g. after a password or role change), optionally
 * keeping the caller's current one. */
export async function destroyUserSessions(userId: string, keepToken?: string): Promise<void> {
  await prisma.session.deleteMany({
    where: { userId, ...(keepToken ? { tokenHash: { not: hashToken(keepToken) } } : {}) },
  });
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.session.create({ data: { tokenHash: hashToken(token), userId, expiresAt } });
  return { token, expiresAt };
}

export async function resolveSession(token: string) {
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          role: true,
        },
      },
    },
  });
  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => null);
    return null;
  }
  return session;
}

export async function destroySession(token: string) {
  await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
}
