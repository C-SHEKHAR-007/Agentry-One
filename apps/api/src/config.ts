import { z } from "zod";

const Env = z
  .object({
    NODE_ENV: z.string().default("development"),
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    REDIS_URL: z.string().default("redis://localhost:6379"),
    AGENTRY_API_KEY: z.string().min(16, "AGENTRY_API_KEY must be set (at least 16 characters)"),
    AGENTRY_CREDENTIALS_KEY: z
      .string()
      .min(1, "AGENTRY_CREDENTIALS_KEY must be set (openssl rand -base64 32)")
      .refine((v) => Buffer.from(v, "base64").length === 32, "AGENTRY_CREDENTIALS_KEY must decode to exactly 32 bytes"),
    AGENTRY_DEV_MOCKS: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === "production" && env.AGENTRY_DEV_MOCKS === "true") {
      ctx.addIssue({ code: "custom", path: ["AGENTRY_DEV_MOCKS"], message: "must not be enabled in production" });
    }
  });

/** Validates required configuration at boot so a misconfigured deploy fails
 * immediately and loudly, instead of booting "healthy" and then returning
 * 500s (missing API key) or failing on first use (missing credentials key). */
export function validateEnv(env: NodeJS.ProcessEnv = process.env): void {
  const result = Env.safeParse(env);
  if (result.success) return;
  const lines = result.error.issues.map((i) => `  - ${i.path.join(".") || "env"}: ${i.message}`);
  throw new Error(`Invalid configuration:\n${lines.join("\n")}`);
}
