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


def download_artifact_bytes(storage_key: str) -> bytes:
    """Downloads a blob previously written by upload_artifact_bytes. Accepts
    either the raw blob name or the "azure://<blob_name>" storage_key form."""
    from azure.storage.blob import BlobServiceClient

    blob_name = storage_key.removeprefix("azure://")
    conn_str = get_connection_string()
    container_name = get_container_name()

    service_client = BlobServiceClient.from_connection_string(conn_str)
    container_client = service_client.get_container_client(container_name)
    return container_client.get_blob_client(blob_name).download_blob().readall()


def generate_sas_url(storage_key: str, expires_in_minutes: int = 120) -> str:
    """Generates a temporary read SAS URL for an azure:// blob reference so external
    services (Meta Graph API, webhook downloaders, etc.) can fetch it over HTTP/HTTPS."""
    from datetime import datetime, timedelta, timezone
    from azure.storage.blob import BlobServiceClient, generate_blob_sas, BlobSasPermissions

    blob_name = storage_key.removeprefix("azure://")
    conn_str = get_connection_string()
    container_name = get_container_name()

    service_client = BlobServiceClient.from_connection_string(conn_str)
    container_client = service_client.get_container_client(container_name)
    blob_client = container_client.get_blob_client(blob_name)

    account_name = getattr(service_client, "account_name", None)
    cred = getattr(service_client, "credential", None)
    account_key = getattr(cred, "account_key", None)

    if account_key and account_name:
        try:
            sas_token = generate_blob_sas(
                account_name=account_name,
                container_name=container_name,
                blob_name=blob_name,
                account_key=account_key,
                permission=BlobSasPermissions(read=True),
                expiry=datetime.now(timezone.utc) + timedelta(minutes=expires_in_minutes),
            )
            return f"{blob_client.url}?{sas_token}"
        except Exception:
            return blob_client.url
    return blob_client.url
