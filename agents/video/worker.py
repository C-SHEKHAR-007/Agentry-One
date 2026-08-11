"""Video Agent worker. Assembles a short-form video entirely locally via
ffmpeg -- a static image (looped for the voiceover's duration, or a fixed
duration if there's no voiceover) with an optional burned-in caption. No
generative video model, no external API, no BYOK provider: see the
content-studio plan's call to ship templated assembly before true
generative video."""

from __future__ import annotations

import asyncio
import subprocess
import sys
import tempfile
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))  # repo root, for python.sdk imports

from python.sdk.agent_job import AgentJob
from python.sdk.artifact_io import read_text_artifact, resolve_to_local_path, write_artifact_file
from python.sdk.runner import run_agent

FRAME_SIZE = 1080  # square -- a reasonable default across Reels/Shorts/TikTok/feed posts
CAPTION_FONT = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")


def _escape_drawtext(text: str) -> str:
    # ffmpeg's drawtext filter treats : \ ' and % as syntax -- escape them.
    for ch in ("\\", ":", "'", "%"):
        text = text.replace(ch, f"\\{ch}")
    return text


def _run_ffmpeg(args: list[str]) -> None:
    result = subprocess.run(["ffmpeg", "-y", *args], capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg failed: {result.stderr[-2000:]}")


def _assemble(image_path: str, audio_path: str | None, caption: str | None, duration_sec: float, out_path: str) -> bool:
    scale_pad = f"scale={FRAME_SIZE}:{FRAME_SIZE}:force_original_aspect_ratio=decrease,pad={FRAME_SIZE}:{FRAME_SIZE}:(ow-iw)/2:(oh-ih)/2:color=black"

    captioned = False
    if caption and CAPTION_FONT.exists():
        drawtext = (
            f"drawtext=fontfile={CAPTION_FONT}:text='{_escape_drawtext(caption)}':"
            "fontcolor=white:fontsize=54:x=(w-text_w)/2:y=h-220:"
            "box=1:boxcolor=black@0.55:boxborderw=24"
        )
        vf = f"{scale_pad},{drawtext}"
        captioned = True
    else:
        vf = scale_pad

    if audio_path:
        _run_ffmpeg([
            "-loop", "1", "-i", image_path,
            "-i", audio_path,
            "-vf", vf,
            "-c:v", "libx264", "-tune", "stillimage", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "192k",
            "-shortest",
            out_path,
        ])
    else:
        _run_ffmpeg([
            "-loop", "1", "-i", image_path,
            "-t", str(duration_sec),
            "-vf", vf,
            "-c:v", "libx264", "-pix_fmt", "yuv420p",
            out_path,
        ])
    return captioned


async def assemble(job: AgentJob) -> dict:
    await job.report_progress(0, "Fetching inputs...")

    scratch_dir = Path(tempfile.gettempdir()) / f"video-{job.job_id}"
    # imagePath/audioPath are storage_keys from the artifacts DB (a local path,
    # or "azure://..." if STORAGE_PROVIDER=azure) -- resolve either to a local
    # file ffmpeg can actually open.
    image_path = resolve_to_local_path(job.params["imagePath"], scratch_dir)
    audio_param = job.params.get("audioPath")
    audio_path = resolve_to_local_path(audio_param, scratch_dir) if audio_param else None
    # caption may be a literal string or a Template `fromStep` reference (the
    # upstream text artifact's storage_key) -- resolve either to real text.
    caption = read_text_artifact(job.params.get("caption") or "") or None
    duration_sec = float(job.params.get("durationSec", 6))

    if not Path(image_path).exists():
        raise ValueError(f"could not resolve imagePath to a local file: {job.params['imagePath']}")
    if audio_path and not Path(audio_path).exists():
        raise ValueError(f"could not resolve audioPath to a local file: {audio_param}")

    out_scratch = str(scratch_dir / f"{uuid.uuid4()}.mp4")
    scratch_dir.mkdir(parents=True, exist_ok=True)

    await job.report_progress(30, "Encoding with ffmpeg...")
    loop = asyncio.get_event_loop()
    captioned = await loop.run_in_executor(
        None, lambda: _assemble(image_path, audio_path, caption, duration_sec, out_scratch)
    )
    out_path = write_artifact_file(out_scratch, job.workflow_id, ".mp4", "video/mp4")

    await job.report_progress(100, "Done.")
    return {
        "status": "completed",
        "artifacts": [
            {
                "kind": "video",
                "path": out_path,
                "mimeType": "video/mp4",
                "metadata": {"durationSec": duration_sec, "captioned": captioned},
            }
        ],
        "error": None,
    }


if __name__ == "__main__":
    run_agent({"assemble": assemble}, queue_name="agent.video")
