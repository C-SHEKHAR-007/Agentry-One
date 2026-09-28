"""Shared artifact read/write helpers so each worker doesn't re-implement the
STORAGE_PROVIDER branch (local disk vs. Azure Blob) -- see agents/dynamic
/worker.py and agents/sketch/worker.py for the original inline version this
factors out for the newer Voice/Video/Social-Publisher agents."""

from __future__ import annotations

import os
import shutil
import uuid
from pathlib import Path

_DEFAULT_ARTIFACTS_DIR = str(Path(__file__).resolve().parents[2] / "artifacts")


def artifacts_dir() -> Path:
    """Read at call time (not import time) so tests and supervisors can set it."""
    return Path(os.environ.get("ARTIFACTS_DIR", _DEFAULT_ARTIFACTS_DIR))


def local_artifact_path(value: str) -> Path | None:
    """Returns the resolved path if `value` names an existing file inside
    ARTIFACTS_DIR, else None. Job params are user-controlled, so a param is
    only ever treated as a file when it points at a real artifact -- never at
    arbitrary host files like /proc/self/environ or ../../etc/passwd."""
    if not value or "\x00" in value:
        return None
    root = artifacts_dir().resolve()
    candidate = Path(value)
    if not candidate.is_absolute():
        candidate = root / candidate
    try:
        resolved = candidate.resolve(strict=True)
    except (OSError, RuntimeError):
        return None
    if not resolved.is_file() or not resolved.is_relative_to(root):
        return None
    return resolved


def _using_azure() -> bool:
    return os.environ.get("STORAGE_PROVIDER") == "azure"


def write_artifact_bytes(data: bytes, workflow_id: str, ext: str, content_type: str) -> str:
    """Persists artifact bytes to whichever backend is configured and returns
    the storage_key to report back to the API (a local path, or "azure://...")."""
    if _using_azure():
        from .azure_storage import upload_artifact_bytes

        storage_key, _ = upload_artifact_bytes(data, workflow_id, ext, content_type)
        return storage_key

    job_dir = artifacts_dir() / workflow_id
    job_dir.mkdir(parents=True, exist_ok=True)
    out_path = job_dir / f"{uuid.uuid4()}{ext}"
    out_path.write_bytes(data)
    return str(out_path)


def write_artifact_file(local_path: str, workflow_id: str, ext: str, content_type: str) -> str:
    """Same as write_artifact_bytes, but for a worker (like ffmpeg or pyttsx3)
    that only knows how to write to a local file first. Azure: uploads the
    bytes and discards the scratch file. Local: relocates it under
    ARTIFACTS_DIR/<workflow_id>/ so it lives in the same place every other
    agent's local-mode output does."""
    src = Path(local_path)
    if _using_azure():
        storage_key = write_artifact_bytes(src.read_bytes(), workflow_id, ext, content_type)
        src.unlink(missing_ok=True)
        return storage_key

    job_dir = artifacts_dir() / workflow_id
    job_dir.mkdir(parents=True, exist_ok=True)
    dest = job_dir / f"{uuid.uuid4()}{ext}"
    # shutil.move, not Path.replace: scratch (/tmp) and ARTIFACTS_DIR are often
    # different filesystems, where a rename fails with EXDEV.
    shutil.move(str(src), dest)
    return str(dest)


def read_text_artifact(value: str) -> str:
    """Resolves a value that may be a text artifact's storage_key (a local
    path or "azure://...", as produced by a Template's `fromStep` mapping --
    see templates/service.ts's resolveParams, which passes the referenced
    artifact's storage_key through verbatim) to its actual decoded content.
    A plain literal string that isn't a resolvable path/blob reference is
    returned unchanged, so a directly-typed caption works the same way.
    Only files inside ARTIFACTS_DIR are ever read (see local_artifact_path)."""
    if not value:
        return value
    if value.startswith("azure://"):
        from .azure_storage import download_artifact_bytes

        return download_artifact_bytes(value).decode("utf-8")
    path = local_artifact_path(value)
    if path is not None:
        return path.read_text(encoding="utf-8")
    return value


def resolve_to_local_path(storage_key: str, scratch_dir: Path) -> str:
    """Given a storage_key that may be a local path or an "azure://..." blob
    reference, returns a local filesystem path a subprocess (ffmpeg) can open
    -- downloading the blob to scratch_dir first if needed. Raises ValueError
    for anything that isn't a blob reference or a file inside ARTIFACTS_DIR."""
    if storage_key.startswith("azure://"):
        from .azure_storage import download_artifact_bytes

        scratch_dir.mkdir(parents=True, exist_ok=True)
        ext = Path(storage_key).suffix or ".bin"
        local_path = scratch_dir / f"{uuid.uuid4()}{ext}"
        local_path.write_bytes(download_artifact_bytes(storage_key))
        return str(local_path)
    path = local_artifact_path(storage_key)
    if path is None:
        raise ValueError(f"not an artifact reference: {storage_key!r}")
    return str(path)


def resolve_to_public_url(storage_key: str) -> str:
    """Given a storage_key that may be an 'azure://...' blob reference or a public HTTP URL,
    generates a temporary SAS URL if azure, or returns the URL directly."""
    if storage_key.startswith("azure://"):
        from .azure_storage import generate_sas_url
        return generate_sas_url(storage_key)
    return storage_key
