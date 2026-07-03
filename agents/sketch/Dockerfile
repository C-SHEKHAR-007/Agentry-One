FROM python:3.12-slim

WORKDIR /app

COPY agents/sketch/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# The worker imports python.sdk from the repo root, so the build context is
# the repo root (see docker-compose.yml) and both trees are copied in.
COPY python ./python
COPY agents/sketch ./agents/sketch

ENV ARTIFACTS_DIR=/artifacts
ENV HF_HOME=/root/.cache/huggingface

CMD ["python", "agents/sketch/worker.py"]
