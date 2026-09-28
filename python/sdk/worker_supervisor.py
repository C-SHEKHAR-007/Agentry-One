#!/usr/bin/env python3
"""
Dynamic Worker Supervisor for Agentry Agents.
Automatically discovers any agent with a `worker.py` inside `agents/` and spawns/supervises
its worker process. If an agent is added dynamically via UI scaffold or crashes,
this supervisor detects and starts/restarts it -- with exponential backoff, so a
worker that fails at import doesn't restart-loop every few seconds forever.
"""

from __future__ import annotations

import os
import signal
import subprocess
import sys
import time
from pathlib import Path
from typing import Dict

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))  # repo root, for python.sdk imports

from python.sdk.log import get_logger  # noqa: E402

AGENTS_ROOT = Path(os.environ.get("AGENTS_DIR", str(Path(__file__).resolve().parent.parent.parent / "agents")))
POLL_INTERVAL_SEC = 5
# How long workers get to finish in-flight jobs on shutdown before being
# killed. Keep it >= the largest manifest timeoutSec, and set the container
# stop grace period (docker compose stop_grace_period) above it.
STOP_TIMEOUT_SEC = float(os.environ.get("SUPERVISOR_STOP_TIMEOUT_SEC", "120"))
BACKOFF_BASE_SEC = 5
BACKOFF_MAX_SEC = 300
# A worker that stays up this long is considered healthy again.
HEALTHY_AFTER_SEC = 60

log = get_logger("agentry.supervisor")

running_workers: Dict[str, subprocess.Popen] = {}
started_at: Dict[str, float] = {}
failures: Dict[str, int] = {}
next_start: Dict[str, float] = {}
should_run = True


def stop_all(timeout: float) -> None:
    for agent_id, proc in running_workers.items():
        if proc.poll() is None:
            log.info("stopping worker", extra={"agent": agent_id, "pid": proc.pid})
            proc.terminate()  # SIGTERM: the runner stops polling and drains in-flight jobs
    deadline = time.monotonic() + timeout
    for agent_id, proc in running_workers.items():
        remaining = max(0.0, deadline - time.monotonic())
        try:
            proc.wait(timeout=remaining)
        except subprocess.TimeoutExpired:
            log.warning("worker did not stop in time; killing", extra={"agent": agent_id, "pid": proc.pid})
            proc.kill()
            proc.wait()


def signal_handler(signum, frame):
    global should_run
    should_run = False


signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)


def discover_agents() -> list[str]:
    discovered = []
    if not AGENTS_ROOT.exists():
        return discovered
    for child in sorted(AGENTS_ROOT.iterdir()):
        if child.is_dir() and (child / "worker.py").exists():
            discovered.append(child.name)
    return discovered


def start_worker(agent_id: str) -> subprocess.Popen:
    worker_script = AGENTS_ROOT / agent_id / "worker.py"
    proc = subprocess.Popen(
        [sys.executable, str(worker_script)],
        cwd=str(AGENTS_ROOT.parent),
        env=os.environ.copy(),
    )
    started_at[agent_id] = time.monotonic()
    log.info("started worker", extra={"agent": agent_id, "pid": proc.pid})
    return proc


def handle_exit(agent_id: str, proc: subprocess.Popen) -> None:
    uptime = time.monotonic() - started_at.get(agent_id, 0)
    failures[agent_id] = 0 if uptime >= HEALTHY_AFTER_SEC else failures.get(agent_id, 0) + 1
    delay = min(BACKOFF_MAX_SEC, BACKOFF_BASE_SEC * (2 ** max(0, failures[agent_id] - 1))) if failures[agent_id] else 0
    next_start[agent_id] = time.monotonic() + delay
    running_workers.pop(agent_id, None)
    log.warning(
        f"worker exited; restarting in {int(delay)}s",
        extra={"agent": agent_id, "exit_code": proc.returncode, "pid": proc.pid},
    )


def main():
    log.info(f"supervisor scanning {AGENTS_ROOT}")
    while should_run:
        try:
            agents = discover_agents()
            now = time.monotonic()
            for agent_id in agents:
                proc = running_workers.get(agent_id)
                if proc is not None and proc.poll() is not None:
                    handle_exit(agent_id, proc)
                    proc = None
                if proc is None and now >= next_start.get(agent_id, 0):
                    running_workers[agent_id] = start_worker(agent_id)

            # Stop (and reap) workers whose agent directory was removed.
            for agent_id in list(running_workers.keys()):
                if agent_id not in agents:
                    proc = running_workers.pop(agent_id)
                    if proc.poll() is None:
                        log.info("agent removed; stopping its worker", extra={"agent": agent_id, "pid": proc.pid})
                        proc.terminate()
                        try:
                            proc.wait(timeout=STOP_TIMEOUT_SEC)
                        except subprocess.TimeoutExpired:
                            proc.kill()
                            proc.wait()
        except Exception:
            log.exception("supervisor iteration failed")

        # Sleep in small steps so a stop signal is acted on promptly.
        for _ in range(POLL_INTERVAL_SEC * 10):
            if not should_run:
                break
            time.sleep(0.1)

    log.info("supervisor stopping")
    stop_all(STOP_TIMEOUT_SEC)
    sys.exit(0)


if __name__ == "__main__":
    main()
