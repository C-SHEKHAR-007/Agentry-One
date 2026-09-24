import path from "node:path";

/** Local filesystem artifact root. Shared between the API (serves downloads)
 * and Python workers (write output) via a common absolute path, set the same
 * in both environments. */
export const ARTIFACTS_DIR = path.resolve(process.env.ARTIFACTS_DIR ?? path.resolve(process.cwd(), "../../artifacts"));

/** Maps a local storage key to a file path, or null if it would resolve
 * outside ARTIFACTS_DIR. Storage keys come from worker results, so they are
 * never trusted to name arbitrary host files (e.g. "/etc/shadow" or "../"). */
export function resolveArtifactPath(storageKey: string): string | null {
  const resolved = path.resolve(ARTIFACTS_DIR, storageKey);
  return resolved.startsWith(ARTIFACTS_DIR + path.sep) ? resolved : null;
}
