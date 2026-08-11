FROM python:3.12-slim

WORKDIR /app

# Shared worker-runner image: python/sdk/worker_supervisor.py auto-discovers
# and spawns every agents/<id>/worker.py, so this one image's system + pip
# deps need to cover every agent, not just sketch. espeak-ng backs the Voice
# agent's offline pyttsx3 TTS; ffmpeg backs the Video agent's local assembly.
RUN apt-get update && apt-get install -y --no-install-recommends \
    espeak-ng \
    ffmpeg \
    fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

COPY agents ./agents
# The trailing `; true` some versions of this loop used to have would mask a
# genuinely failed/timed-out pip install (build "succeeds" with a package
# silently missing) -- `|| exit 1` makes any real install failure fail the
# build instead.
RUN for req in agents/*/requirements.txt; do \
      pip install --no-cache-dir -r "$req" || exit 1; \
    done

# The workers import python.sdk from the repo root, so the build context is
# the repo root (see docker-compose.yml).
COPY python ./python

ENV ARTIFACTS_DIR=/artifacts
ENV HF_HOME=/root/.cache/huggingface

CMD ["python", "python/sdk/worker_supervisor.py"]
