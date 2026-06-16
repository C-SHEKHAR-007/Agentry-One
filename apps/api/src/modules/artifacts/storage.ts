import path from "node:path";

/** Phase 1 uses local filesystem storage only (storage_backend: "local_fs").
 * Shared between the API (serves downloads) and Python workers (write
 * output) via a common absolute path, set the same in both environments. */
export const ARTIFACTS_DIR = process.env.ARTIFACTS_DIR ?? path.resolve(process.cwd(), "../../artifacts");

export function resolveArtifactPath(storageKey: string): string {
  // storageKey is already an absolute path written by the worker in this build.
  return path.isAbsolute(storageKey) ? storageKey : path.join(ARTIFACTS_DIR, storageKey);
}
