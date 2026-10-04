export type Role = "owner" | "member" | string;

/** The signed-in user (GET /auth/me). */
export interface AuthUser {
  id: string | null;
  email: string | null;
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
  role: Role;
}

/** A workspace member (GET /users). */
export interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl?: string | null;
  role: Role;
  createdAt: string;
  isStub?: boolean;
}

export type AuthStatus = "loading" | "needsSetup" | "unauthed" | "authed";
