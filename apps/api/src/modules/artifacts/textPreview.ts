import { open } from "node:fs/promises";
import { downloadBlobHead } from "./azureClient.js";
import { resolveArtifactPath } from "./storage.js";
import { isAzureKey } from "./urls.js";

/** Characters of a text artifact shown on its card in the gallery. */
export const PREVIEW_CHARS = 400;
// Enough bytes for PREVIEW_CHARS even when every character is multi-byte.
const HEAD_BYTES = PREVIEW_CHARS * 4;

export const isTextArtifact = (a: { mimeType: string; kind: string }) =>
  a.mimeType.startsWith("text/") || a.mimeType.includes("json") || a.kind === "text" || a.kind === "search_brief";

/** Turns the first bytes of a file into a preview: drops a multi-byte
 * character cut in half at the end, and trims to PREVIEW_CHARS. */
export function previewFromHead(head: Buffer): string {
  let text = head.toString("utf8");
  if (text.endsWith("�")) text = text.replace(/�+$/, "");
  return text.length > PREVIEW_CHARS ? text.slice(0, PREVIEW_CHARS) : text;
}

/** The start of a text artifact's contents, or null if it can't be read
 * (missing file, storage down); a preview is never worth failing a list for. */
export async function textPreview(a: { storageKey: string; mimeType: string; kind: string }): Promise<string | null> {
  if (!isTextArtifact(a)) return null;
  try {
    if (isAzureKey(a.storageKey)) return previewFromHead(await downloadBlobHead(a.storageKey.replace(/^azure:\/\//, ""), HEAD_BYTES));
    const file = resolveArtifactPath(a.storageKey);
    if (!file) return null;
    const handle = await open(file, "r");
    try {
      const buf = Buffer.alloc(HEAD_BYTES);
      const { bytesRead } = await handle.read(buf, 0, HEAD_BYTES, 0);
      return previewFromHead(buf.subarray(0, bytesRead));
    } finally {
      await handle.close();
    }
  } catch {
    return null;
  }
}
