import { generateReadSasUrl } from "./azureClient.js";

/** Browser-facing base path of this API (the web UI reaches it through its
 * /api reverse proxy). Used to build download URLs for locally-stored
 * artifacts, which have no SAS equivalent. */
const PUBLIC_API_BASE = (process.env.PUBLIC_API_BASE ?? "/api").replace(/\/+$/, "");

export const isAzureKey = (storageKey: string) => storageKey.startsWith("azure://");

export interface ArtifactRef {
  id: string;
  kind: string;
  storageKey: string;
  mimeType: string;
}

/** Short-lived read URLs for an artifact: SAS URLs for Azure blobs, the
 * authenticated API download route for local files. Never throws -- a
 * storage misconfiguration degrades to a null URL instead of failing the
 * whole listing it's part of. */
export async function artifactUrl(
  a: ArtifactRef,
  mode: "preview" | "download",
): Promise<string | null> {
  if (!isAzureKey(a.storageKey)) {
    return `${PUBLIC_API_BASE}/artifacts/${a.id}/download${mode === "download" ? "?disposition=attachment" : ""}`;
  }
  try {
    const res = await generateReadSasUrl(a.storageKey.replace(/^azure:\/\//, ""), {
      mode,
      mimeType: a.mimeType,
      ...(mode === "download" ? { fileName: `${a.kind}-${a.id.slice(0, 8)}` } : {}),
      expiresInMinutes: 120,
    });
    return res.url;
  } catch {
    return null;
  }
}

export async function withArtifactUrls<T extends ArtifactRef>(a: T): Promise<T & { previewUrl: string | null; downloadUrl: string | null }> {
  const [previewUrl, downloadUrl] = await Promise.all([artifactUrl(a, "preview"), artifactUrl(a, "download")]);
  return { ...a, previewUrl, downloadUrl };
}
