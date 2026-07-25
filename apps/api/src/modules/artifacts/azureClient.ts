import { createHash } from "node:crypto";
import {
  BlobServiceClient,
  BlobSASPermissions,
  generateBlobSASQueryParameters,
  StorageSharedKeyCredential,
} from "@azure/storage-blob";

/**
 * Dedicated Azure Blob Storage client module for data handling and SAS URL generation.
 * Supports both production Azure Blob Storage and local development via Azurite connection string.
 */

function getConnectionString(): string {
  const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connStr) {
    throw new Error("AZURE_STORAGE_CONNECTION_STRING environment variable is not configured.");
  }
  return connStr;
}

export function getContainerName(): string {
  // Prefer AZURE_STORAGE_CONTAINER_NAME_DEV, then AZURE_STORAGE_CONTAINER, then fallback
  return (
    process.env.AZURE_STORAGE_CONTAINER_NAME_DEV ||
    process.env.AZURE_STORAGE_CONTAINER ||
    "agentry-artifacts"
  );
}

export function getBlobServiceClient(): BlobServiceClient {
  return BlobServiceClient.fromConnectionString(getConnectionString());
}

export async function ensureContainerExists(): Promise<void> {
  const serviceClient = getBlobServiceClient();
  const containerClient = serviceClient.getContainerClient(getContainerName());
  await containerClient.createIfNotExists();
}

export function parseAccountCredentialsFromConnString(connStr: string): {
  accountName: string;
  accountKey: string;
} | null {
  const parts = connStr.split(";");
  let accountName = "";
  let accountKey = "";
  for (const part of parts) {
    if (part.startsWith("AccountName=")) accountName = part.substring("AccountName=".length);
    if (part.startsWith("AccountKey=")) accountKey = part.substring("AccountKey=".length);
  }
  if (accountName && accountKey) {
    return { accountName, accountKey };
  }
  return null;
}

/**
 * Uploads a buffer directly to Azure Blob Storage and returns storage details.
 */
export async function uploadBlob(
  blobName: string,
  buffer: Buffer,
  mimeType: string,
): Promise<{ url: string; blobName: string; sizeBytes: bigint; checksum: string }> {
  await ensureContainerExists();
  const serviceClient = getBlobServiceClient();
  const containerClient = serviceClient.getContainerClient(getContainerName());
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  await blockBlobClient.upload(buffer, buffer.length, {
    blobHTTPHeaders: { blobContentType: mimeType },
  });

  const hash = createHash("sha256").update(buffer).digest("hex");
  return {
    url: blockBlobClient.url,
    blobName,
    sizeBytes: BigInt(buffer.length),
    checksum: hash,
  };
}

/**
 * Generates an upload SAS URL with Create/Write permissions so clients can upload directly via PUT.
 */
export async function generateUploadSasUrl(
  blobName: string,
  expiresInMinutes = 20,  // write SAS: 20 min only
): Promise<{ url: string; blobName: string; expiresAt: string }> {
  await ensureContainerExists();
  const serviceClient = getBlobServiceClient();
  const containerName = getContainerName();
  const containerClient = serviceClient.getContainerClient(containerName);
  const blobClient = containerClient.getBlobClient(blobName);

  const expiresOn = new Date(Date.now() + expiresInMinutes * 60 * 1000);
  const connStr = getConnectionString();
  const creds = parseAccountCredentialsFromConnString(connStr);

  let sasToken = "";
  if (creds) {
    const sharedKeyCred = new StorageSharedKeyCredential(creds.accountName, creds.accountKey);
    sasToken = generateBlobSASQueryParameters(
      {
        containerName,
        blobName,
        permissions: BlobSASPermissions.parse("cw"),
        expiresOn,
      },
      sharedKeyCred,
    ).toString();
  } else {
    // Fallback if using user delegation key or managed identity
    sasToken = await blobClient.generateSasUrl({
      permissions: BlobSASPermissions.parse("cw"),
      expiresOn,
    });
    return { url: sasToken, blobName, expiresAt: expiresOn.toISOString() };
  }

  const url = `${blobClient.url}?${sasToken}`;
  return { url, blobName, expiresAt: expiresOn.toISOString() };
}

/**
 * Generates a read SAS URL with Read permissions.
 * Supports 2 modes:
 * - "preview": sets content-disposition to inline for in-browser rendering.
 * - "download": sets content-disposition to attachment for direct file download.
 */
export async function generateReadSasUrl(
  blobName: string,
  options: {
    mode?: "preview" | "download";
    fileName?: string;
    mimeType?: string;
    expiresInMinutes?: number;
  } = {},
): Promise<{ url: string; mode: "preview" | "download"; expiresAt: string }> {
  const mode = options.mode || "preview";
  const expiresInMinutes = options.expiresInMinutes || 120; // read SAS: 2h default
  const expiresOn = new Date(Date.now() + expiresInMinutes * 60 * 1000);

  const serviceClient = getBlobServiceClient();
  const containerName = getContainerName();
  const containerClient = serviceClient.getContainerClient(containerName);
  const blobClient = containerClient.getBlobClient(blobName);

  const contentDisposition =
    mode === "download"
      ? `attachment; filename="${options.fileName || blobName.split("/").pop() || "artifact"}"`
      : "inline";

  const connStr = getConnectionString();
  const creds = parseAccountCredentialsFromConnString(connStr);

  let sasToken = "";
  if (creds) {
    const sharedKeyCred = new StorageSharedKeyCredential(creds.accountName, creds.accountKey);
    sasToken = generateBlobSASQueryParameters(
      {
        containerName,
        blobName,
        permissions: BlobSASPermissions.parse("r"),
        expiresOn,
        contentDisposition,
        ...(options.mimeType ? { contentType: options.mimeType } : {}),
      },
      sharedKeyCred,
    ).toString();
  } else {
    sasToken = await blobClient.generateSasUrl({
      permissions: BlobSASPermissions.parse("r"),
      expiresOn,
    });
    return { url: sasToken, mode, expiresAt: expiresOn.toISOString() };
  }

  const url = `${blobClient.url}?${sasToken}`;
  return { url, mode, expiresAt: expiresOn.toISOString() };
}

/**
 * Downloads blob content as a Node readable stream.
 */
export async function downloadBlobStream(blobName: string) {
  const serviceClient = getBlobServiceClient();
  const containerClient = serviceClient.getContainerClient(getContainerName());
  const blobClient = containerClient.getBlobClient(blobName);
  const downloadResponse = await blobClient.download();
  return {
    stream: downloadResponse.readableStreamBody,
    contentLength: downloadResponse.contentLength,
    contentType: downloadResponse.contentType,
  };
}
