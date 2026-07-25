"""Azure Blob Storage client for Python workers.
Handles direct uploading of generated artifacts (like images) to Azure Blob Storage
instead of local filesystem storage."""

from __future__ import annotations

import os
import uuid
from typing import Tuple

def get_connection_string() -> str:
    conn_str = os.environ.get("AZURE_STORAGE_CONNECTION_STRING")
    if not conn_str:
        raise RuntimeError("AZURE_STORAGE_CONNECTION_STRING environment variable is not configured.")
    return conn_str


def get_container_name() -> str:
    # Prefer AZURE_STORAGE_CONTAINER_NAME_DEV, then AZURE_STORAGE_CONTAINER, then fallback
    return (
        os.environ.get("AZURE_STORAGE_CONTAINER_NAME_DEV")
        or os.environ.get("AZURE_STORAGE_CONTAINER")
        or "agentry-artifacts"
    )


def upload_artifact_bytes(
    data: bytes,
    workflow_id: str,
    file_ext: str = ".png",
    content_type: str = "image/png",
) -> Tuple[str, str]:
    """Uploads bytes directly to Azure Blob Storage container.
    Returns (storage_key, blob_name). storage_key is formatted as azure://<blob_name>."""
    from azure.storage.blob import BlobServiceClient, ContentSettings

    conn_str = get_connection_string()
    container_name = get_container_name()

    service_client = BlobServiceClient.from_connection_string(conn_str)
    container_client = service_client.get_container_client(container_name)
    try:
        container_client.create_container()
    except Exception:
        # Container already exists — safe to ignore on both Azurite and real Azure
        pass

    blob_name = f"{workflow_id}/{uuid.uuid4()}{file_ext}"
    blob_client = container_client.get_blob_client(blob_name)

    blob_client.upload_blob(
        data,
        overwrite=True,
        content_settings=ContentSettings(content_type=content_type),
    )

    storage_key = f"azure://{blob_name}"
    return storage_key, blob_name
