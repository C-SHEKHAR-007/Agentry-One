#!/usr/bin/env python3
"""End-to-end smoke test against a running Agentry stack (API + Redis +
Postgres + the echo-agent worker). Exercises the real user flows and the
security boundaries over HTTP, as three principals: the owner, a member, and
a worker holding the API key.

Run against a disposable database -- it creates the first owner via /auth/setup.

    AGENTRY_API_URL=http://127.0.0.1:4100 AGENTRY_API_KEY=... python scripts/e2e_smoke.py
"""

from __future__ import annotations

import os
import sys
import time
import uuid

import requests

API = os.environ.get("AGENTRY_API_URL", "http://127.0.0.1:4000").rstrip("/")
API_KEY = os.environ["AGENTRY_API_KEY"]

passed: list[str] = []


def check(name: str, cond: bool, detail: object = "") -> None:
    if not cond:
        print(f"FAIL  {name}  {detail}")
        sys.exit(1)
    passed.append(name)
    print(f"ok    {name}")


def session() -> requests.Session:
    s = requests.Session()
    s.headers["Content-Type"] = "application/json"
    return s


def wait_for(fn, timeout=30, interval=0.5):
    deadline = time.time() + timeout
    while time.time() < deadline:
        value = fn()
        if value:
            return value
        time.sleep(interval)
    return None


worker = session()
worker.headers["X-API-Key"] = API_KEY
anon = session()

# --- health / auth basics -------------------------------------------------
check("health is ok", anon.get(f"{API}/health").json().get("status") == "ok")
check("unauthenticated request is 401", anon.get(f"{API}/projects").status_code == 401)
check("wrong API key is 401", anon.get(f"{API}/projects", headers={"X-API-Key": "nope"}).status_code == 401)
r = anon.get(f"{API}/auth/google/callback?dev_mock=true", allow_redirects=False)
check(
    "Google dev_mock bypass creates no session",
    r.status_code == 302 and "agentry_session" not in r.headers.get("set-cookie", ""),
    r.headers,
)
forged = "eyJwbGF0Zm9ybSI6IngiLCJwcm9qZWN0SWQiOiJ2aWN0aW0ifQ"
r = anon.get(f"{API}/social-accounts/oauth/callback?dev_mock=true&state={forged}", allow_redirects=False)
check("forged social OAuth state is rejected", "error=oauth_failed" in r.headers.get("location", ""), r.headers)

# --- first-run setup + owner ----------------------------------------------
if not anon.get(f"{API}/auth/setup-status").json().get("needsSetup"):
    sys.exit("this smoke test needs a fresh database (first-run setup already completed)")
owner = session()
suffix = uuid.uuid4().hex[:6]
owner_email = f"owner-{suffix}@example.com"
r = owner.post(f"{API}/auth/setup", json={"email": owner_email, "password": "owner-pass-123"})
check("setup creates the first owner", r.status_code == 201 and r.json()["user"]["role"] == "owner", r.text)
r = anon.post(f"{API}/auth/setup", json={"email": f"x-{suffix}@example.com", "password": "another-pass-1"})
check("second setup is refused", r.status_code == 409, r.text)
check("login with wrong password is 401", anon.post(f"{API}/auth/login", json={"email": owner_email, "password": "wrong-password"}).status_code == 401)
check("invalid login body is 400", anon.post(f"{API}/auth/login", json={"email": 5}).status_code == 400)

# --- member ---------------------------------------------------------------
member_email = f"member-{suffix}@example.com"
r = owner.post(f"{API}/users", json={"email": member_email, "password": "member-pass-123", "role": "member"})
check("owner creates a member", r.status_code == 201, r.text)
member = session()
check("member logs in", member.post(f"{API}/auth/login", json={"email": member_email, "password": "member-pass-123"}).status_code == 200)

# --- projects & tenant isolation ------------------------------------------
check("project name is validated", owner.post(f"{API}/projects", json={"name": ""}).status_code == 400)
owner_project = owner.post(f"{API}/projects", json={"name": "Owner project"}).json()
member_project = member.post(f"{API}/projects", json={"name": "Member project"}).json()
member_ids = {p["id"] for p in member.get(f"{API}/projects").json()}
check("member lists only their own projects", member_ids == {member_project["id"]}, member_ids)
owner_ids = {p["id"] for p in owner.get(f"{API}/projects").json()}
check("owner (admin) sees all projects", {owner_project["id"], member_project["id"]} <= owner_ids)
check("member cannot read owner's project", member.get(f"{API}/projects/{owner_project['id']}").status_code == 404)
check("member cannot rename owner's project", member.patch(f"{API}/projects/{owner_project['id']}", json={"name": "pwned"}).status_code == 404)
check("member cannot delete owner's project", member.delete(f"{API}/projects/{owner_project['id']}").status_code == 404)

# --- workflow run through a real worker -----------------------------------
r = member.post(f"{API}/projects/{member_project['id']}/workflows", json={"agentId": "echo-agent", "input": {}})
check("input is validated against the agent schema (422)", r.status_code == 422 and "message" in r.json().get("error", ""), r.text)
r = member.post(f"{API}/projects/{owner_project['id']}/workflows", json={"agentId": "echo-agent", "input": {"message": "hi"}})
check("member cannot start a workflow in owner's project", r.status_code == 404, r.text)
r = member.post(f"{API}/projects/{member_project['id']}/workflows", json={"agentId": "echo-agent", "input": {"message": "hello e2e"}})
check("member starts a workflow", r.status_code == 201, r.text)
wf = r.json()

done = wait_for(lambda: (w := member.get(f"{API}/workflows/{wf['id']}").json()).get("status") == "completed" and w)
check("worker completes the workflow", bool(done), member.get(f"{API}/workflows/{wf['id']}").json().get("status"))
artifact = done["steps"][0]["artifacts"][0]
check("artifact has a same-origin download URL", artifact["downloadUrl"].endswith(f"/artifacts/{artifact['id']}/download?disposition=attachment"), artifact)
dl = member.get(f"{API}/artifacts/{artifact['id']}/download")
check("artifact downloads with its content", dl.status_code == 200 and "hello e2e" in dl.text, dl.status_code)
check("download sets nosniff + sandbox CSP", dl.headers.get("x-content-type-options") == "nosniff" and "sandbox" in dl.headers.get("content-security-policy", ""))
check("owner (admin) can read a member's workflow", owner.get(f"{API}/workflows/{wf['id']}").status_code == 200)
outsider = session()
outsider_email = f"outsider-{suffix}@example.com"
owner.post(f"{API}/users", json={"email": outsider_email, "password": "outsider-pass-1", "role": "member"})
outsider.post(f"{API}/auth/login", json={"email": outsider_email, "password": "outsider-pass-1"})
check("another member cannot read the workflow", outsider.get(f"{API}/workflows/{wf['id']}").status_code == 404)
check("another member cannot download the artifact", outsider.get(f"{API}/artifacts/{artifact['id']}/download").status_code == 404)
check("another member's gallery excludes it", all(a["id"] != artifact["id"] for a in outsider.get(f"{API}/artifacts").json()))
check("another member's recent list excludes it", all(w["id"] != wf["id"] for w in outsider.get(f"{API}/workflows/recent?limit=50").json()))
check("cancelling a completed workflow is refused", member.post(f"{API}/workflows/{wf['id']}/cancel").status_code == 409)

job_id = done["steps"][0]["job"]["id"]
check("SSE on a finished job replays its state", "completed" in member.get(f"{API}/jobs/{job_id}/events", timeout=5).text)
check("job secrets endpoint refuses users", member.get(f"{API}/internal/jobs/{job_id}/secrets").status_code == 403)
check("job secrets endpoint refuses finished jobs", worker.get(f"{API}/internal/jobs/{job_id}/secrets").status_code == 410)

# --- providers: secrets write-only, SSRF, admin-only writes ----------------
r = owner.post(
    f"{API}/providers",
    json={"capabilityKey": "text-generation", "providerType": "openai", "name": "e2e", "authMode": "bearer", "secret": "sk-e2e-secret", "baseUrl": "https://8.8.8.8/v1"},
)
check("owner creates a provider", r.status_code == 201, r.text)
provider = r.json()
check("provider response never contains the secret", "sk-e2e-secret" not in r.text and provider.get("hasSecret") is True)
check("GET provider never contains the secret", "sk-e2e-secret" not in owner.get(f"{API}/providers/{provider['id']}").text)
check("plaintext secret endpoint is gone", owner.get(f"{API}/providers/{provider['id']}/secret").status_code == 404)
for bad in ["http://169.254.169.254/latest/meta-data", "http://10.0.0.1/v1", "file:///etc/passwd"]:
    r = owner.post(f"{API}/providers", json={"capabilityKey": "text-generation", "providerType": "openai", "name": "ssrf", "authMode": "none", "baseUrl": bad})
    check(f"SSRF baseUrl rejected: {bad}", r.status_code == 400, r.text)
r = owner.put(f"{API}/providers/{provider['id']}", json={"baseUrl": "https://1.1.1.1/v1"})
check("moving a saved key to a new host requires re-entering it", r.status_code == 400 and "re-enter" in r.text, r.text)
check("member cannot create providers", member.post(f"{API}/providers", json={"capabilityKey": "text-generation", "providerType": "openai", "name": "m", "authMode": "none"}).status_code == 403)
check("member cannot delete providers", member.delete(f"{API}/providers/{provider['id']}").status_code == 403)
check("member can still list providers", member.get(f"{API}/providers").status_code == 200)
check("member cannot scaffold agents (code generation)", member.post(f"{API}/agents/scaffold", json={"id": "evil", "name": "x", "description": "x", "fields": [{"name": "a", "type": "string"}]}).status_code == 403)
check("member cannot read cost stats", member.get(f"{API}/stats/costs").status_code == 403)

# --- templates & schedules -------------------------------------------------
tpl = member.post(
    f"{API}/projects/{member_project['id']}/templates",
    json={"name": "e2e", "steps": [{"stepOrder": 0, "agentId": "echo-agent", "agentStepKey": "run", "inputMapping": {"message": {"kind": "literal", "value": "scheduled"}}}]},
)
check("member creates a template", tpl.status_code == 201, tpl.text)
tpl = tpl.json()
check("another member cannot read the template", outsider.get(f"{API}/templates/{tpl['id']}").status_code == 404)
check("invalid cron is a 400", member.post(f"{API}/templates/{tpl['id']}/schedule", json={"cronExpr": "every day"}).status_code == 400)
check("sub-minute cron is a 400", member.post(f"{API}/templates/{tpl['id']}/schedule", json={"cronExpr": "*/5 * * * * *"}).status_code == 400)
r = member.post(f"{API}/templates/{tpl['id']}/schedule", json={"cronExpr": "0 3 * * *", "runInputs": {}})
check("member schedules the template", r.status_code == 201, r.text)
sched = r.json()
check("schedule is listed", any(s["id"] == sched["id"] for s in member.get(f"{API}/templates/{tpl['id']}/schedules").json()))
check("another member cannot delete the schedule", outsider.delete(f"{API}/schedules/{sched['id']}").status_code == 404)
check("owner of the template deletes the schedule", member.delete(f"{API}/schedules/{sched['id']}").status_code == 204)
check("schedule is gone", member.get(f"{API}/templates/{tpl['id']}/schedules").json() == [])

# --- sessions --------------------------------------------------------------
r = member.patch(f"{API}/auth/profile", json={"password": "new-member-pass-1"})
check("password change without current password is refused", r.status_code == 403, r.text)
other_device = session()
other_device.post(f"{API}/auth/login", json={"email": member_email, "password": "member-pass-123"})
r = member.patch(f"{API}/auth/profile", json={"password": "new-member-pass-1", "currentPassword": "member-pass-123"})
check("password change with current password succeeds", r.status_code == 200, r.text)
check("password change signs out other sessions", other_device.get(f"{API}/auth/me").status_code == 401)
check("the session that changed it stays signed in", member.get(f"{API}/auth/me").status_code == 200)

# --- rate limiting (last: it locks this client IP out of login briefly) -----
codes = [anon.post(f"{API}/auth/login", json={"email": "nobody@example.com", "password": "x"}).status_code for _ in range(12)]
check("login is rate limited", 429 in codes, codes)

print(f"\n{len(passed)} checks passed")
