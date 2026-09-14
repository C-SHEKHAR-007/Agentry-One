FROM python:3.12-slim

WORKDIR /app

# System dependencies: espeak-ng for TTS, ffmpeg for video assembly, fonts for video captions
RUN apt-get update && apt-get install -y --no-install-recommends \
    espeak-ng \
    ffmpeg \
    fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

# OPTIMIZATION: Copy ONLY requirements first to leverage Docker layer caching.
# Modifying agent code (*.py, manifests) will NO LONGER re-trigger heavy pip downloads (like PyTorch ~2GB).
COPY agents/sketch/requirements.txt ./req_sketch.txt
COPY agents/social-publisher/requirements.txt ./req_social.txt
COPY agents/voice/requirements.txt ./req_voice.txt
COPY agents/video/requirements.txt ./req_video.txt
COPY agents/dynamic/requirements.txt ./req_dynamic.txt
COPY agents/web-search/requirements.txt ./req_search.txt

RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -r req_sketch.txt \
                -r req_social.txt \
                -r req_voice.txt \
                -r req_video.txt \
                -r req_dynamic.txt \
                -r req_search.txt

# Copy source code after dependencies are installed and cached
COPY agents ./agents
COPY python ./python
COPY social-connectors ./social-connectors

ENV ARTIFACTS_DIR=/artifacts
ENV HF_HOME=/root/.cache/huggingface

CMD ["python", "python/sdk/worker_supervisor.py"]
