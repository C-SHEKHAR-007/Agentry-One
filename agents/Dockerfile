# syntax=docker/dockerfile:1
# Worker runner: one image for every agent under agents/, supervised by
# python/sdk/worker_supervisor.py. Build context is the repo root.
FROM python:3.12-slim

# System dependencies: espeak-ng for TTS, ffmpeg for video assembly, fonts for
# captions, tini as PID 1 (signal forwarding + zombie reaping for ffmpeg etc.).
RUN apt-get update && apt-get install -y --no-install-recommends \
    espeak-ng \
    ffmpeg \
    fonts-dejavu-core \
    tini \
    && rm -rf /var/lib/apt/lists/*

# uid 1000 matches the API image's `node` user: both share the artifacts volume.
RUN useradd --create-home --uid 1000 agentry
WORKDIR /app

# Requirements first for layer caching; every agent pins through python/sdk.
COPY python/sdk/requirements.txt python/sdk/requirements.txt
COPY agents/sketch/requirements.txt agents/sketch/requirements-local-sd.txt agents/sketch/
COPY agents/social-publisher/requirements.txt agents/social-publisher/
COPY agents/voice/requirements.txt agents/voice/
RUN --mount=type=cache,target=/root/.cache/pip \
    cd agents/sketch && pip install -r requirements.txt \
    && cd ../social-publisher && pip install -r requirements.txt \
    && cd ../voice && pip install -r requirements.txt

# Optional on-box SD-Turbo (~2 GB of CPU torch). Without it, the sketch agent
# needs a hosted image provider configured.
ARG INSTALL_LOCAL_SD=false
RUN --mount=type=cache,target=/root/.cache/pip \
    if [ "$INSTALL_LOCAL_SD" = "true" ]; then \
      pip install --extra-index-url https://download.pytorch.org/whl/cpu -r agents/sketch/requirements-local-sd.txt; \
    fi

COPY python ./python
COPY social-connectors ./social-connectors
COPY agents ./agents

ENV ARTIFACTS_DIR=/artifacts \
    HF_HOME=/home/agentry/.cache/huggingface \
    PYTHONUNBUFFERED=1
RUN mkdir -p /artifacts /home/agentry/.cache/huggingface && chown -R agentry:agentry /artifacts /home/agentry/.cache
USER agentry

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["python", "python/sdk/worker_supervisor.py"]
