"""Slow, environment-gated integration test that actually runs local SD-Turbo
image generation -- mirrors VSplitter's own test_pipeline_smoke.py auto-skip
pattern. Skips automatically if the model isn't already cached locally, so it
never blocks a normal test run or a bare CI sandbox."""

import io
from pathlib import Path

import pytest
from PIL import Image

HF_CACHE = Path.home() / ".cache" / "huggingface" / "hub"
MODEL_CACHED = (HF_CACHE / "models--stabilityai--sd-turbo").exists()

pytestmark = pytest.mark.skipif(
    not MODEL_CACHED,
    reason="stabilityai/sd-turbo not cached locally -- run once via the worker to populate ~/.cache/huggingface first",
)


def test_local_sd_turbo_generates_a_real_image():
    import sys

    sys.path.insert(0, str(Path(__file__).resolve().parents[3]))
    from python.sdk.providers import _generate_local_sd_turbo

    result = _generate_local_sd_turbo(
        prompt="a small red bicycle on a white background",
        negative_prompt=None,
        steps=2,
        seed=42,
    )

    assert result.width == 512
    assert result.height == 512
    assert len(result.image_bytes) > 0

    image = Image.open(io.BytesIO(result.image_bytes))
    assert image.format == "PNG"
    assert image.size == (512, 512)
