from pathlib import Path
import pytest

from sdk.artifact_io import local_artifact_path, resolve_to_local_path, write_artifact_bytes, read_text_artifact, write_artifact_file

def test_write_and_read_local_text_artifact(tmp_path, monkeypatch):
    # Ensure Azure is not configured
    monkeypatch.delenv("STORAGE_PROVIDER", raising=False)
    monkeypatch.setenv("ARTIFACTS_DIR", str(tmp_path))

    data = b"Hello world"
    workflow_id = "test-wf-123"
    
    # Test bytes write
    out_path = write_artifact_bytes(data, workflow_id, ".txt", "text/plain")
    
    assert out_path.endswith(".txt")
    assert workflow_id in out_path
    assert Path(out_path).exists()
    assert Path(out_path).read_bytes() == data

    # Test text read
    content = read_text_artifact(out_path)
    assert content == "Hello world"

def test_read_text_artifact_literal():
    # A literal string that is not a path should be returned unchanged
    assert read_text_artifact("This is a literal prompt") == "This is a literal prompt"


def test_read_text_artifact_never_reads_files_outside_artifacts_dir(tmp_path, monkeypatch):
    # Job params are user-controlled: a host path must come back as a literal
    # string, never as the file's contents (e.g. /proc/self/environ secrets).
    artifacts = tmp_path / "artifacts"
    artifacts.mkdir()
    secret = tmp_path / "secret.txt"
    secret.write_text("TOP-SECRET")
    monkeypatch.setenv("ARTIFACTS_DIR", str(artifacts))

    assert read_text_artifact(str(secret)) == str(secret)
    assert read_text_artifact("../secret.txt") == "../secret.txt"
    assert local_artifact_path(str(secret)) is None
    assert local_artifact_path("../secret.txt") is None


def test_symlink_escaping_artifacts_dir_is_rejected(tmp_path, monkeypatch):
    artifacts = tmp_path / "artifacts"
    artifacts.mkdir()
    secret = tmp_path / "secret.txt"
    secret.write_text("TOP-SECRET")
    (artifacts / "link.txt").symlink_to(secret)
    monkeypatch.setenv("ARTIFACTS_DIR", str(artifacts))

    assert local_artifact_path(str(artifacts / "link.txt")) is None


def test_resolve_to_local_path_rejects_non_artifacts(tmp_path, monkeypatch):
    monkeypatch.setenv("ARTIFACTS_DIR", str(tmp_path))
    with pytest.raises(ValueError):
        resolve_to_local_path("/etc/passwd", tmp_path / "scratch")


def test_write_artifact_file_moves_scratch_file_into_artifacts_dir(tmp_path, monkeypatch):
    monkeypatch.delenv("STORAGE_PROVIDER", raising=False)
    monkeypatch.setenv("ARTIFACTS_DIR", str(tmp_path / "artifacts"))
    scratch = tmp_path / "scratch.txt"
    scratch.write_text("hi")

    out = write_artifact_file(str(scratch), "wf-1", ".txt", "text/plain")

    assert not scratch.exists()
    assert local_artifact_path(out) is not None
    assert read_text_artifact(out) == "hi"
