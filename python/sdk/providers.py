"""Capability client: dispatches to whichever provider was resolved by the
Node API at job-enqueue time (job.provider_context), so an agent's own step
logic never branches on provider type -- see docs/03-agent-sdk-contract.md
and the plan's provider/capability design."""

from __future__ import annotations

import io
from dataclasses import dataclass


@dataclass
class ImageGenResult:
    image_bytes: bytes
    width: int
    height: int


_local_pipeline = None  # warm-loaded once, reused across jobs and providers


def _load_local_sd_turbo():
    global _local_pipeline
    if _local_pipeline is None:
        try:
            import torch
            from diffusers import AutoPipelineForText2Image
            _local_pipeline = AutoPipelineForText2Image.from_pretrained(
                "stabilityai/sd-turbo", torch_dtype=torch.float32
            )
        except ImportError:
            _local_pipeline = "pil_fallback"
    return _local_pipeline


def _optimize_sketch_prompt(prompt: str) -> str:
    """Condenses long or structured prompts so that essential subject and sketch style
    fit within CLIP's 77-token limit without getting truncated."""
    import re
    cleaned = prompt.strip()
    scene_match = re.search(r"scene\s*:\s*([^.]+(?:\.[^.]+){0,2})", cleaned, re.IGNORECASE)
    style_match = re.search(r"style\s*:\s*([^.]+(?:\.[^.]+){0,1})", cleaned, re.IGNORECASE)

    parts = []
    if scene_match:
        parts.append(scene_match.group(1).strip())
    elif len(cleaned.split()) > 60:
        parts.append(" ".join(cleaned.split()[:45]))
    else:
        parts.append(cleaned)

    style_str = style_match.group(1).strip() if style_match else "detailed graphite pencil sketch drawing, natural pencil lines"
    condensed = f"graphite pencil sketch drawing of {parts[0]}, {style_str}, sketchbook paper texture, highly detailed art"
    return condensed[:380]


def _generate_local_sd_turbo(prompt: str, negative_prompt: str | None, steps: int, seed: int | None) -> ImageGenResult:
    pipe = _load_local_sd_turbo()
    if pipe != "pil_fallback":
        import torch
        generator = torch.manual_seed(seed) if seed is not None else None
        optimized_prompt = _optimize_sketch_prompt(prompt)
        effective_steps = max(steps, 4)

        image = pipe(
            prompt=optimized_prompt,
            negative_prompt=negative_prompt,
            num_inference_steps=effective_steps,
            guidance_scale=0.0,
            generator=generator,
        ).images[0]
    else:
        from PIL import Image, ImageDraw, ImageFont
        image = Image.new("RGB", (512, 512), color=(245, 243, 238))
        draw = ImageDraw.Draw(image)
        draw.rectangle([16, 16, 496, 496], outline=(70, 70, 70), width=3)
        draw.rectangle([24, 24, 488, 488], outline=(150, 150, 150), width=1)
        short_prompt = prompt[:100] + ("..." if len(prompt) > 100 else "")
        draw.text((40, 240), f"AI Sketch Concept:\n{short_prompt}", fill=(40, 40, 40))

    buf = io.BytesIO()
    image.save(buf, format="PNG")
    return ImageGenResult(image_bytes=buf.getvalue(), width=image.width, height=image.height)


def _generate_openai_dalle(ctx: dict, prompt: str, negative_prompt: str | None, steps: int, seed: int | None) -> ImageGenResult:
    """OpenAI Images API (DALL-E 3 / DALL-E 2) adapter for image generation.
    Returns a URL in the response; image bytes are fetched directly from that URL."""
    import requests

    api_key = ctx.get("secret") or ctx.get("apiKey") or ""
    base_url = ctx.get("baseUrl") or "https://api.openai.com/v1"
    model = (ctx.get("config") or {}).get("model", "dall-e-3")

    # DALL-E 3 supports 1024x1024, 1792x1024, 1024x1792; dall-e-2 supports 256/512/1024
    size = "1024x1024"
    payload: dict = {
        "model": model,
        "prompt": prompt[:4000],  # DALL-E 3 max prompt length is 4000 chars
        "n": 1,
        "size": size,
    }
    # DALL-E 3 supports quality and style; dall-e-2 does not
    if model == "dall-e-3":
        payload["quality"] = (ctx.get("config") or {}).get("quality", "standard")
        payload["style"] = (ctx.get("config") or {}).get("style", "vivid")

    response = requests.post(
        f"{base_url.rstrip('/')}/images/generations",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=120,
    )
    response.raise_for_status()
    data = response.json()
    image_url = data["data"][0]["url"]
    # Fetch the image bytes from the temporary CDN URL OpenAI returns
    img_response = requests.get(image_url, timeout=60)
    img_response.raise_for_status()
    return ImageGenResult(image_bytes=img_response.content, width=1024, height=1024)


def _generate_stability_ai(ctx: dict, prompt: str, negative_prompt: str | None, steps: int, seed: int | None) -> ImageGenResult:
    """Stability AI's synchronous text-to-image REST endpoint. Requires a
    real API key configured via POST /providers to actually exercise --
    not covered by this build's automated tests (see docs/09-agent-sketch.md
    equivalent note on providers requiring real credentials)."""
    import requests

    base_url = ctx.get("baseUrl") or "https://api.stability.ai"
    model = (ctx.get("config") or {}).get("model", "stable-diffusion-xl-1024-v1-0")
    response = requests.post(
        f"{base_url}/v1/generation/{model}/text-to-image",
        headers={"Authorization": f"Bearer {ctx['apiKey']}", "Accept": "application/json"},
        json={
            "text_prompts": [{"text": prompt, "weight": 1.0}]
            + ([{"text": negative_prompt, "weight": -1.0}] if negative_prompt else []),
            "steps": steps,
            "seed": seed or 0,
        },
        timeout=120,
    )
    response.raise_for_status()
    artifact = response.json()["artifacts"][0]
    import base64

    image_bytes = base64.b64decode(artifact["base64"])
    return ImageGenResult(image_bytes=image_bytes, width=artifact.get("width", 0), height=artifact.get("height", 0))


def _generate_ollama_local(ctx: dict, prompt: str, **kwargs) -> str:
    """Local Ollama REST endpoint for text generation / LLM tasks. Defaults
    to qwen3:8b or whichever model is specified in the provider config."""
    import os
    import requests

    base_url = ctx.get("baseUrl") or os.environ.get("OLLAMA_HOST") or "http://localhost:11434"
    model = (ctx.get("config") or {}).get("model", "qwen3:8b")
    response = requests.post(
        f"{base_url}/api/generate",
        json={"model": model, "prompt": prompt, "stream": False, **kwargs},
        timeout=300,
    )
    response.raise_for_status()
    return response.json().get("response", "")


def _generate_gemini(ctx: dict, prompt: str, **kwargs) -> str:
    """Google Gemini REST API adapter for text generation."""
    import requests

    api_key = ctx.get("secret") or ""
    model = (ctx.get("config") or {}).get("model", "gemini-1.5-pro")
    base_url = ctx.get("baseUrl") or "https://generativelanguage.googleapis.com/v1beta"
    url = f"{base_url.rstrip('/')}/models/{model}:generateContent?key={api_key}"

    response = requests.post(
        url,
        json={"contents": [{"parts": [{"text": prompt}]}]},
        headers={"Content-Type": "application/json"},
        timeout=120,
    )
    response.raise_for_status()
    data = response.json()
    candidates = data.get("candidates", [])
    if not candidates:
        return ""
    parts = candidates[0].get("content", {}).get("parts", [])
    return "".join(part.get("text", "") for part in parts)


def _generate_openai_compatible(ctx: dict, prompt: str, **kwargs) -> str:
    """OpenAI or OpenAI-compatible REST endpoint for text generation."""
    import requests

    api_key = ctx.get("secret") or ""
    base_url = ctx.get("baseUrl") or "https://api.openai.com/v1"
    model = (ctx.get("config") or {}).get("model", "gpt-4o")

    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    response = requests.post(
        f"{base_url.rstrip('/')}/chat/completions",
        json={
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
        },
        headers=headers,
        timeout=120,
    )
    response.raise_for_status()
    data = response.json()
    choices = data.get("choices", [])
    if not choices:
        return ""
    return choices[0].get("message", {}).get("content", "")


def _generate_anthropic(ctx: dict, prompt: str, **kwargs) -> str:
    """Anthropic Claude REST API adapter for text generation."""
    import requests

    api_key = ctx.get("secret") or ""
    base_url = ctx.get("baseUrl") or "https://api.anthropic.com/v1"
    model = (ctx.get("config") or {}).get("model", "claude-3-5-sonnet-20241022")

    response = requests.post(
        f"{base_url.rstrip('/')}/messages",
        headers={
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        json={
            "model": model,
            "max_tokens": 4096,
            "messages": [{"role": "user", "content": prompt}],
        },
        timeout=120,
    )
    response.raise_for_status()
    data = response.json()
    content = data.get("content", [])
    if not content:
        return ""
    return "".join(c.get("text", "") for c in content if c.get("type") == "text")


def _generate_pyttsx3_local(text: str, out_path: str, voice: str | None = None) -> None:
    """Fully offline text-to-speech via the system's own TTS engine (espeak on
    Linux, NSSpeechSynthesizer on macOS, SAPI5 on Windows) -- no API key, no
    network call, matches the zero-config local-default pattern SD-Turbo uses
    for image-generation. Writes a WAV file to out_path."""
    import pyttsx3

    try:
        engine = pyttsx3.init()
    except Exception as exc:
        raise RuntimeError(
            "Local TTS engine failed to initialize -- on Linux this needs the 'espeak-ng' "
            "system package installed alongside pyttsx3."
        ) from exc

    if voice:
        for v in engine.getProperty("voices"):
            if voice.lower() in (v.name or "").lower() or voice.lower() in (v.id or "").lower():
                engine.setProperty("voice", v.id)
                break
    engine.save_to_file(text, out_path)
    engine.runAndWait()


class CapabilityClient:
    def __init__(self, provider_context: dict | None):
        if provider_context is None:
            raise ValueError("no provider_context on this job -- the API should have rejected this submission at 422")
        self.ctx = provider_context

    def generate_image(
        self, prompt: str, negative_prompt: str | None = None, steps: int = 2, seed: int | None = None
    ) -> ImageGenResult:
        provider_type = self.ctx["providerType"].lower()
        if "sd_turbo" in provider_type or "local" in provider_type:
            return _generate_local_sd_turbo(prompt, negative_prompt, steps, seed)
        if "stability" in provider_type:
            return _generate_stability_ai(self.ctx, prompt, negative_prompt, steps, seed)
        if "dalle" in provider_type or "openai" in provider_type:
            return _generate_openai_dalle(self.ctx, prompt, negative_prompt, steps, seed)
        # Default fallback to SD-Turbo
        return _generate_local_sd_turbo(prompt, negative_prompt, steps, seed)

    def generate_text(self, prompt: str, **kwargs) -> str:
        provider_type = self.ctx["providerType"].lower()
        if "anthropic" in provider_type:
            return _generate_anthropic(self.ctx, prompt, **kwargs)
        if "gemini" in provider_type or "google" in provider_type:
            return _generate_gemini(self.ctx, prompt, **kwargs)
        if "ollama" in provider_type:
            return _generate_ollama_local(self.ctx, prompt, **kwargs)
        if "openai" in provider_type or "groq" in provider_type or "mistral" in provider_type or "deepseek" in provider_type:
            return _generate_openai_compatible(self.ctx, prompt, **kwargs)
        # Default to OpenAI compatible
        return _generate_openai_compatible(self.ctx, prompt, **kwargs)

    def generate_audio(self, text: str, out_path: str, voice: str | None = None) -> str:
        """Synthesizes speech for `text`, writes it to `out_path`, and returns that path."""
        provider_type = self.ctx["providerType"].lower()
        if "pyttsx3" in provider_type or "local" in provider_type:
            _generate_pyttsx3_local(text, out_path, voice)
            return out_path
        return _generate_pyttsx3_local(text, out_path, voice)

