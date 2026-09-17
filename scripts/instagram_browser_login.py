#!/usr/bin/env python3
"""
Agentry Automated Instagram Browser Login Helper
Launches Google Chrome on the user's desktop, monitors for successful Instagram login,
automatically extracts the authenticated `sessionid` cookie via Chrome DevTools Protocol (CDP),
and links the account directly into Agentry with ZERO manual copy-pasting.

Endpoints:
  GET  /status        -> Health check
  POST /login/start   -> Starts asynchronous browser login worker (returns immediately)
  GET  /login/status  -> Polls login progress: status ("idle"|"in_progress"|"success"|"failed"|"closed")
  POST /login/cancel  -> Cancels in-progress login and terminates browser
  POST /login         -> Synchronous blocking login (legacy/CLI support)
"""

import sys
import os
import json
import time
import subprocess
import urllib.request
import urllib.parse
import urllib.error
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
import threading

try:
    import websocket
except ImportError:
    print("Error: websocket module is required. Run: pip install websocket-client")
    sys.exit(1)

CDP_PORT = 9222
DAEMON_PORT = 4005
API_URL = os.environ.get("AGENTRY_API_URL", "http://localhost:4000")

# Global state for asynchronous login monitoring
state_lock = threading.Lock()
login_session = {
    "status": "idle",       # "idle", "in_progress", "success", "failed", "closed"
    "handle": None,
    "error": None,
    "started_at": 0,
    "proc": None,
    "ws": None,
}


def cleanup_active_process():
    with state_lock:
        proc = login_session.get("proc")
        ws = login_session.get("ws")
        if ws:
            try:
                ws.close()
            except Exception:
                pass
            login_session["ws"] = None
        if proc and proc.poll() is None:
            try:
                proc.terminate()
                proc.wait(timeout=2)
            except Exception:
                try:
                    proc.kill()
                except Exception:
                    pass
            login_session["proc"] = None


def launch_chrome_and_extract_session(project_id: str | None = None, timeout_sec: int = 300) -> dict:
    """Launches Google Chrome, monitors for login, extracts sessionid, and posts to Agentry."""
    print("[agentry-ig] Launching Google Chrome for Instagram login...")
    user_data_dir = os.path.expanduser("~/.config/agentry_ig_chrome_session")
    os.makedirs(user_data_dir, exist_ok=True)

    env = dict(os.environ)
    if "DISPLAY" not in env:
        env["DISPLAY"] = ":0"

    chrome_cmd = [
        "google-chrome",
        f"--remote-debugging-port={CDP_PORT}",
        "--remote-allow-origins=*",
        f"--user-data-dir={user_data_dir}",
        "--no-first-run",
        "--no-default-browser-check",
        "https://www.instagram.com/accounts/login/"
    ]

    try:
        proc = subprocess.Popen(chrome_cmd, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except FileNotFoundError:
        return {"success": False, "error": "Google Chrome binary not found. Please install google-chrome."}
    except Exception as e:
        return {"success": False, "error": f"Failed to start Chrome: {e}"}

    with state_lock:
        login_session["proc"] = proc

    ws = None
    try:
        # 1. Wait for Chrome CDP endpoint to be ready
        v_data = None
        for _ in range(30):
            time.sleep(0.5)
            if proc.poll() is not None:
                return {"success": False, "error": "Chrome closed unexpectedly during launch."}
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{CDP_PORT}/json/version", timeout=2) as resp:
                    v_data = json.loads(resp.read().decode())
                    if v_data and "webSocketDebuggerUrl" in v_data:
                        break
            except Exception:
                pass

        if not v_data or "webSocketDebuggerUrl" not in v_data:
            return {"success": False, "error": "Could not connect to Chrome DevTools debugging port."}

        ws_url = v_data["webSocketDebuggerUrl"]
        print(f"[agentry-ig] Connected to Chrome CDP: {ws_url}")
        ws = websocket.create_connection(ws_url, timeout=5)
        with state_lock:
            login_session["ws"] = ws

        # 2. Poll for sessionid in cookies
        start_time = time.time()
        session_id = None
        ds_user_id = None
        username = "instagram_user"

        print("[agentry-ig] Waiting for user to complete login in the opened browser window...")
        while time.time() - start_time < timeout_sec:
            if proc.poll() is not None:
                # Browser was closed by user
                print("[agentry-ig] Chrome window closed by user.")
                return {"success": False, "status": "closed", "error": "Chrome window was closed before login completed."}

            try:
                ws.send(json.dumps({"id": 101, "method": "Storage.getCookies"}))
                ws.settimeout(2.0)
                msg = ws.recv()
                res = json.loads(msg)
                cookies = res.get("result", {}).get("cookies", [])

                cookie_map = {c["name"]: c["value"] for c in cookies if "instagram.com" in c.get("domain", "")}

                if "sessionid" in cookie_map:
                    session_id = cookie_map["sessionid"]
                    ds_user_id = cookie_map.get("ds_user_id")
                    print(f"[agentry-ig] SUCCESS: Captured Instagram sessionid (length: {len(session_id)}, user_id: {ds_user_id})")
                    break
            except Exception:
                # Transient socket read or non-matching CDP event
                pass

            time.sleep(1.5)

        if not session_id:
            return {"success": False, "error": "Login timed out. Please try again."}

        # 3. Resolve username if possible
        if ds_user_id:
            try:
                req = urllib.request.Request(
                    f"https://www.instagram.com/api/v1/users/{ds_user_id}/info/",
                    headers={
                        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
                        "Cookie": f"sessionid={session_id}; ds_user_id={ds_user_id};"
                    }
                )
                with urllib.request.urlopen(req, timeout=5) as u_resp:
                    u_data = json.loads(u_resp.read().decode())
                    username = u_data.get("user", {}).get("username", username)
                    print(f"[agentry-ig] Resolved Instagram username: @{username}")
            except Exception as e:
                print(f"[agentry-ig] Could not resolve username from Instagram API: {e}")

        # 4. If project_id wasn't provided, get the first project from Agentry
        api_key = os.environ.get("AGENTRY_API_KEY", "dev-local-api-key")
        if not project_id:
            try:
                p_req = urllib.request.Request(
                    f"{API_URL}/projects",
                    headers={"x-api-key": api_key}
                )
                with urllib.request.urlopen(p_req, timeout=5) as p_resp:
                    projects = json.loads(p_resp.read().decode())
                    if projects and len(projects) > 0:
                        project_id = projects[0]["id"]
            except Exception as e:
                print(f"[agentry-ig] Warning: Could not fetch projects: {e}")

        if not project_id:
            return {"success": False, "error": "No active project found to attach the account to."}

        # 5. Link the account in Agentry via API
        payload = json.dumps({
            "projectId": project_id,
            "platform": "instagram",
            "accessToken": f"sessionid::{session_id}",
            "handle": f"@{username}"
        }).encode("utf-8")

        post_req = urllib.request.Request(
            f"{API_URL}/social-accounts/direct-login",
            data=payload,
            headers={
                "Content-Type": "application/json",
                "x-api-key": api_key
            }
        )

        try:
            with urllib.request.urlopen(post_req, timeout=10) as link_resp:
                result = json.loads(link_resp.read().decode())
                print(f"[agentry-ig] Account successfully linked to Agentry! Handle: @{username}")
            return {"success": True, "handle": f"@{username}", "sessionIdLength": len(session_id)}
        except urllib.error.HTTPError as e:
            err_body = e.read().decode() if e.fp else str(e)
            print(f"[agentry-ig] API error linking account: {e.code} -> {err_body}")
            return {"success": False, "error": f"API Error ({e.code}): {err_body}"}
        except Exception as e:
            print(f"[agentry-ig] Error linking account: {e}")
            return {"success": False, "error": f"Error linking account: {e}"}

    finally:
        if ws:
            try:
                ws.close()
            except Exception:
                pass
            with state_lock:
                login_session["ws"] = None
        if proc and proc.poll() is None:
            try:
                proc.terminate()
                proc.wait(timeout=3)
            except Exception:
                pass
            with state_lock:
                login_session["proc"] = None


def async_login_worker(project_id: str | None):
    try:
        res = launch_chrome_and_extract_session(project_id)
        with state_lock:
            if res.get("success"):
                login_session["status"] = "success"
                login_session["handle"] = res.get("handle")
                login_session["error"] = None
            elif res.get("status") == "closed":
                login_session["status"] = "closed"
                login_session["error"] = res.get("error", "Chrome window was closed before login.")
            else:
                login_session["status"] = "failed"
                login_session["error"] = res.get("error", "Login failed.")
    except Exception as e:
        with state_lock:
            login_session["status"] = "failed"
            login_session["error"] = str(e)
    finally:
        cleanup_active_process()


class DaemonHandler(BaseHTTPRequestHandler):
    def _send_cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, x-api-key")

    def do_OPTIONS(self):
        self.send_response(204)
        self._send_cors()
        self.end_headers()

    def do_GET(self):
        if self.path == "/status":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self._send_cors()
            self.end_headers()
            self.wfile.write(json.dumps({
                "ready": True,
                "service": "agentry-instagram-helper",
                "session_status": login_session.get("status", "idle")
            }).encode())

        elif self.path.startswith("/login/status"):
            with state_lock:
                status_copy = {
                    "status": login_session.get("status", "idle"),
                    "handle": login_session.get("handle"),
                    "error": login_session.get("error"),
                    "elapsed": int(time.time() - login_session["started_at"]) if login_session["started_at"] else 0
                }
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self._send_cors()
            self.end_headers()
            self.wfile.write(json.dumps(status_copy).encode())

        else:
            self.send_response(404)
            self._send_cors()
            self.end_headers()

    def do_POST(self):
        content_len = int(self.headers.get("Content-Length", 0))
        body = {}
        if content_len > 0:
            try:
                body = json.loads(self.rfile.read(content_len).decode())
            except Exception:
                pass

        if self.path.startswith("/login/start"):
            # Start non-blocking asynchronous login
            project_id = body.get("projectId")
            cleanup_active_process()
            with state_lock:
                login_session["status"] = "in_progress"
                login_session["handle"] = None
                login_session["error"] = None
                login_session["started_at"] = time.time()

            t = threading.Thread(target=async_login_worker, args=(project_id,), daemon=True)
            t.start()

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self._send_cors()
            self.end_headers()
            self.wfile.write(json.dumps({"started": True, "status": "in_progress"}).encode())

        elif self.path.startswith("/login/cancel"):
            cleanup_active_process()
            with state_lock:
                login_session["status"] = "idle"
                login_session["error"] = None
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self._send_cors()
            self.end_headers()
            self.wfile.write(json.dumps({"canceled": True}).encode())

        elif self.path.startswith("/login"):
            # Legacy synchronous blocking login
            project_id = body.get("projectId")
            result = launch_chrome_and_extract_session(project_id)
            status_code = 200 if result.get("success") else 400
            self.send_response(status_code)
            self.send_header("Content-Type", "application/json")
            self._send_cors()
            self.end_headers()
            self.wfile.write(json.dumps(result).encode())

        else:
            self.send_response(404)
            self._send_cors()
            self.end_headers()

    def log_message(self, format, *args):
        # Keep daemon logs clean
        pass


def run_daemon():
    server = ThreadingHTTPServer(("0.0.0.0", DAEMON_PORT), DaemonHandler)
    print(f"[agentry-ig] Local Instagram Browser Login Daemon running at http://localhost:{DAEMON_PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--daemon":
        run_daemon()
    else:
        pid = sys.argv[1] if len(sys.argv) > 1 else None
        res = launch_chrome_and_extract_session(pid)
        print("Result:", json.dumps(res, indent=2))
