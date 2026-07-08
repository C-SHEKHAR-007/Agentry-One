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
        import torch
        from diffusers import AutoPipelineForText2Image

        _local_pipeline = AutoPipelineForText2Image.from_pretrained(
            "stabilityai/sd-turbo", torch_dtype=torch.float32
        )
    return _local_pipeline


def _generate_local_sd_turbo(prompt: str, negative_prompt: str | None, steps: int, seed: int | None) -> ImageGenResult:
    import torch

    pipe = _load_local_sd_turbo()
    generator = torch.manual_seed(seed) if seed is not None else None
    image = pipe(
        prompt=prompt,
        negative_prompt=negative_prompt,
        num_inference_steps=steps,
        guidance_scale=0.0,  # SD-Turbo is trained for guidance-free sampling
        generator=generator,
    ).images[0]

    buf = io.BytesIO()
    image.save(buf, format="PNG")
    return ImageGenResult(image_bytes=buf.getvalue(), width=image.width, height=image.height)


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


class CapabilityClient:
    def __init__(self, provider_context: dict | None):
        if provider_context is None:
            raise ValueError("no provider_context on this job -- the API should have rejected this submission at 422")
        self.ctx = provider_context

    def generate_image(
        self, prompt: str, negative_prompt: str | None = None, steps: int = 2, seed: int | None = None
    ) -> ImageGenResult:
        provider_type = self.ctx["providerType"]
        if provider_type == "sd_turbo_local":
            return _generate_local_sd_turbo(prompt, negative_prompt, steps, seed)
        if provider_type == "stability_ai":
            return _generate_stability_ai(self.ctx, prompt, negative_prompt, steps, seed)
        raise NotImplementedError(f"no image-generation adapter for provider type '{provider_type}'")

    def generate_text(self, prompt: str, **kwargs) -> str:
        provider_type = self.ctx["providerType"]
        if provider_type == "ollama_local":
            return _generate_ollama_local(self.ctx, prompt, **kwargs)
        if provider_type == "gemini":
            return _generate_gemini(self.ctx, prompt, **kwargs)
        if provider_type == "openai_compatible":
            return _generate_openai_compatible(self.ctx, prompt, **kwargs)
        raise NotImplementedError(f"no text-generation adapter for provider type '{provider_type}'")
