#!/usr/bin/env python3
"""
Dynamic Worker Supervisor for Agentry Agents.
Automatically discovers any agent with a `worker.py` inside `agents/` and spawns/supervises
its worker process. If an agent is added dynamically via UI scaffold or crashes,
this supervisor detects and starts/restarts it.
"""

from __future__ import annotations

import os
import signal
import subprocess
import sys
import time
from pathlib import Path
from typing import Dict

AGENTS_ROOT = Path(__file__).resolve().parent.parent.parent / "agents"
POLL_INTERVAL_SEC = 5

running_workers: Dict[str, subprocess.Popen] = {}
should_run = True


def signal_handler(signum, frame):
    global should_run
    print(f"\n[supervisor] Received signal {signum}, stopping all supervised workers...", flush=True)
    should_run = False
    for agent_id, proc in running_workers.items():
        if proc.poll() is None:
            print(f"[supervisor] Terminating worker '{agent_id}' (pid={proc.pid})...", flush=True)
            proc.terminate()
    # Wait briefly for graceful exit
    time.sleep(1)
    for agent_id, proc in running_workers.items():
        if proc.poll() is None:
            proc.kill()
    sys.exit(0)


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
    print(f"[supervisor] Starting worker for agent '{agent_id}' ({worker_script})...", flush=True)
    proc = subprocess.Popen(
        [sys.executable, str(worker_script)],
        cwd=str(AGENTS_ROOT.parent),
        env=os.environ.copy(),
    )
    return proc


def main():
    print(f"[supervisor] Starting Dynamic Worker Supervisor scanning {AGENTS_ROOT}", flush=True)
    while should_run:
        try:
            agents = discover_agents()
            for agent_id in agents:
                proc = running_workers.get(agent_id)
                if proc is None:
                    running_workers[agent_id] = start_worker(agent_id)
                elif proc.poll() is not None:
                    code = proc.returncode
                    print(
                        f"[supervisor] Worker '{agent_id}' exited with code {code}. Restarting...",
                        flush=True,
                    )
                    running_workers[agent_id] = start_worker(agent_id)

            # Check if any running worker corresponds to a removed agent directory
            for agent_id in list(running_workers.keys()):
                if agent_id not in agents:
                    proc = running_workers.pop(agent_id)
                    if proc.poll() is None:
                        print(
                            f"[supervisor] Agent '{agent_id}' removed. Terminating worker...",
                            flush=True,
                        )
                        proc.terminate()
        except Exception as e:
            print(f"[supervisor] Error during supervisor iteration: {e}", flush=True)

        time.sleep(POLL_INTERVAL_SEC)


if __name__ == "__main__":
    main()
