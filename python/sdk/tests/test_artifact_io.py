import os
from pathlib import Path
from sdk.artifact_io import write_artifact_bytes, read_text_artifact, write_artifact_file

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
