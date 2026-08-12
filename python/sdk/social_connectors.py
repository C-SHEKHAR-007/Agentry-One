"""Dynamically loads a social platform's publish.py -- mirrors
worker_supervisor.py's directory-based agent discovery so adding a new
platform is "drop social-connectors/<platform>/publish.py", no registration
list to maintain here."""

from __future__ import annotations

import importlib.util
import os
from pathlib import Path
from typing import Callable, Optional

SOCIAL_CONNECTORS_DIR = Path(
    os.environ.get("SOCIAL_CONNECTORS_DIR", str(Path(__file__).resolve().parents[2] / "social-connectors"))
)


def load_publisher(platform: str) -> Callable[[str, str, Optional[str]], str]:
    """Returns the `post(access_token: str, text: str, media_url: str | None = None) -> str`
    function from social-connectors/<platform>/publish.py. Raises
    NotImplementedError with a clear message if that platform has no publish
    adapter yet."""
    publish_path = SOCIAL_CONNECTORS_DIR / platform / "publish.py"
    if not publish_path.exists():
        raise NotImplementedError(f"no publish adapter for platform '{platform}' ({publish_path} not found)")

    spec = importlib.util.spec_from_file_location(f"social_connectors.{platform}.publish", publish_path)
    module = importlib.util.module_from_spec(spec)  # type: ignore[arg-type]
    spec.loader.exec_module(module)  # type: ignore[union-attr]
    return module.post
