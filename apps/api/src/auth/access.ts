import type { FastifyReply, FastifyRequest } from "fastify";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db/client.js";

/** Ownership model: every tenant-owned row hangs off a Project, and a Project
 * belongs to one User. The static API key and users with role "owner" are
 * admins and can see everything; members only see their own projects and what
 * lives under them. Global configuration (providers, agents, global settings)
 * is readable by everyone but writable only by admins. */
export function isAdmin(req: FastifyRequest): boolean {
  const p = req.principal;
  return p?.kind === "apiKey" || (p?.kind === "user" && p.user.role === "owner");
}

/** Sends 403 and returns false unless the caller is an admin. */
export function requireAdmin(req: FastifyRequest, reply: FastifyReply): boolean {
  if (isAdmin(req)) return true;
  reply.code(403).send({ error: "owner role required" });
  return false;
}

/** The user id to scope by, or null for admins (no scoping). */
export function scopedUserId(req: FastifyRequest): string | null {
  if (isAdmin(req)) return null;
  const p = req.principal;
  // requireAuth guarantees a principal on non-exempt routes; fail closed anyway.
  return p?.kind === "user" ? p.user.id : "__no_access__";
}

/** Prisma filter for the projects the caller may see. */
export function projectWhere(req: FastifyRequest): Prisma.ProjectWhereInput {
  const userId = scopedUserId(req);
  return userId ? { userId } : {};
}

/** Prisma filter for rows with a `project` relation (workflows, templates,
 * social accounts). */
export function viaProject(req: FastifyRequest): { project?: Prisma.ProjectWhereInput } {
  const userId = scopedUserId(req);
  return userId ? { project: { userId } } : {};
}

export type Resource =
  | "project"
  | "workflow"
  | "workflowStep"
  | "job"
  | "artifact"
  | "template"
  | "templateRun"
  | "schedule"
  | "socialAccount";

/** Resolves the project that owns a resource, or null if it doesn't exist. */
async function owningProjectId(kind: Resource, id: string): Promise<string | null> {
  switch (kind) {
    case "project":
      return (await prisma.project.findUnique({ where: { id }, select: { id: true } }))?.id ?? null;
    case "workflow":
      return (await prisma.workflow.findUnique({ where: { id }, select: { projectId: true } }))?.projectId ?? null;
    case "workflowStep":
      return (
        await prisma.workflowStep.findUnique({ where: { id }, select: { workflow: { select: { projectId: true } } } })
      )?.workflow.projectId ?? null;
    case "job":
      return (
        await prisma.job.findUnique({
          where: { id },
          select: { workflowStep: { select: { workflow: { select: { projectId: true } } } } },
        })
      )?.workflowStep.workflow.projectId ?? null;
    case "artifact":
      return (
        await prisma.artifact.findUnique({
          where: { id },
          select: { workflowStep: { select: { workflow: { select: { projectId: true } } } } },
        })
      )?.workflowStep.workflow.projectId ?? null;
    case "template":
      return (await prisma.template.findUnique({ where: { id }, select: { projectId: true } }))?.projectId ?? null;
    case "templateRun":
      return (
        await prisma.templateRun.findUnique({ where: { id }, select: { template: { select: { projectId: true } } } })
      )?.template.projectId ?? null;
    case "schedule":
      return (
        await prisma.workflowSchedule.findUnique({ where: { id }, select: { template: { select: { projectId: true } } } })
      )?.template.projectId ?? null;
    case "socialAccount":
      return (await prisma.socialAccount.findUnique({ where: { id }, select: { projectId: true } }))?.projectId ?? null;
  }
}

/** True if the caller may act on the given project. */
export async function canAccessProject(req: FastifyRequest, projectId: string | null | undefined): Promise<boolean> {
  if (!projectId) return false;
  const userId = scopedUserId(req);
  if (!userId) return (await prisma.project.count({ where: { id: projectId } })) === 1;
  return (await prisma.project.count({ where: { id: projectId, userId } })) === 1;
}

/** Sends 404 and returns false unless the resource exists and belongs to a
 * project the caller can access. Not-found and forbidden are deliberately
 * indistinguishable so ids can't be probed. */
export async function authorize(
  req: FastifyRequest,
  reply: FastifyReply,
  kind: Resource,
  id: string | null | undefined,
): Promise<boolean> {
  const projectId = id ? await owningProjectId(kind, id) : null;
  if (projectId && (await canAccessProject(req, projectId))) return true;
  reply.code(404).send({ error: `${kind.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)}_not_found` });
  return false;
}

/** Fastify preHandler for plugins that manage global configuration: anyone
 * signed in may read, only admins may change anything. */
export async function adminForWrites(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (req.method === "GET" || req.method === "HEAD") return;
  requireAdmin(req, reply);
}
