"""Unit tests for the govt-job-agent worker: parsing, payload mapping and the
run() handler end to end with the network, LLM and Sarkari Duniya stubbed."""

import asyncio
import importlib.util
import json
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_ROOT))

_spec = importlib.util.spec_from_file_location(
    "govt_job_worker", Path(__file__).resolve().parents[1] / "worker.py"
)
worker = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(worker)


NOTIFICATION_HTML = """
<html><head><title>x</title><script>var a = 1;</script></head><body>
<h1>SSC CGL 2026 Notification</h1>
<p>Staff Selection Commission has released the Combined Graduate Level notification for 17727 posts.
Candidates with a graduate degree aged 18 to 32 years can apply online before the last date.</p>
<p>Application fee: General Rs 100, SC/ST nil. Pay level 4 to 8 of the 7th CPC pay matrix.</p>
<a href="/apply">Apply Online</a> <a href="https://ssc.gov.in/notice.pdf">Download Notification</a>
</body></html>
"""

MODEL_ANSWER = {
    "isJobNotification": True,
    "titleEn": "SSC CGL 2026 Notification - 17727 Posts",
    "organization": "Staff Selection Commission (SSC)",
    "qualificationLevel": "graduate",
    "minAge": 18,
    "maxAge": 32,
    "lastDate": "2026-11-30",
    "examDate": "not announced",
    "applyLink": "https://ssc.gov.in/apply",
    "notificationLink": "javascript:void(0)",
    "importantDates": [
        {"label": "Last Date", "date": "30 Nov 2026"},
        {"label": "", "date": "x"},
    ],
}


def test_page_to_text_drops_scripts_and_resolves_links():
    text, links = worker.page_to_text(NOTIFICATION_HTML, "https://ssc.gov.in/cgl")
    assert "SSC CGL 2026 Notification" in text
    assert "var a" not in text
    assert ("Apply Online", "https://ssc.gov.in/apply") in links


def test_parse_json_object_handles_fences_and_think_blocks():
    raw = '<think>hmm {not json}</think>\n```json\n{"isJobNotification": false}\n```'
    assert worker.parse_json_object(raw) == {"isJobNotification": False}
    assert worker.parse_json_object("no json here") is None


def test_to_ingest_payload_cleans_bad_values():
    payload = worker.to_ingest_payload(
        MODEL_ANSWER, "https://ssc.gov.in/cgl", "latest-jobs", "all-india"
    )
    assert payload["titleEn"] == "SSC CGL 2026 Notification - 17727 Posts"
    assert payload["lastDate"] == "2026-11-30"
    assert "examDate" not in payload  # not a real date
    assert "notificationLink" not in payload  # not an http(s) link
    assert payload["applyLink"] == "https://ssc.gov.in/apply"
    assert payload["importantDates"] == [{"label": "Last Date", "date": "30 Nov 2026"}]
    assert payload["sourceUrl"] == "https://ssc.gov.in/cgl"
    assert payload["ingestSource"] == "govt-job-agent"
    assert payload["categorySlug"] == "latest-jobs"
    assert "status" not in payload


def test_to_ingest_payload_skips_non_notifications():
    assert (
        worker.to_ingest_payload({"isJobNotification": False}, "u", None, None) is None
    )
    assert (
        worker.to_ingest_payload(
            {"isJobNotification": True, "titleEn": " "}, "u", None, None
        )
        is None
    )


def test_search_unwraps_duckduckgo_redirect_links(monkeypatch):
    html = (
        '<a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fssc.gov.in%2Fcgl&amp;rut=x">SSC</a>'
        '<a rel="nofollow" class="result__a" href="https://duckduckgo.com/y.js?ad_provider=x">Ad</a>'
        '<a rel="nofollow" class="result__a" href="https://upsc.gov.in/exams">UPSC</a>'
    )

    class FakeResponse:
        text = html

        def raise_for_status(self):
            pass

    monkeypatch.setattr(worker.requests, "post", lambda *a, **k: FakeResponse())
    assert worker.search_candidate_urls("ssc", 5) == [
        "https://ssc.gov.in/cgl",
        "https://upsc.gov.in/exams",
    ]


class StubJob:
    def __init__(self, params):
        self.params = params
        self.workflow_id = "wf-test"
        self.provider_context = {"providerType": "ollama"}
        self.logs = []

    async def report_progress(self, percent, message):
        pass

    async def log(self, message, level="info"):
        self.logs.append((level, message))


@pytest.fixture
def ingest_env(monkeypatch, tmp_path):
    monkeypatch.setenv("SARKARI_DUNIYA_API_URL", "http://sarkari.test")
    monkeypatch.setenv("SARKARI_DUNIYA_INGEST_KEY", "k")
    monkeypatch.setenv("SARKARI_DUNIYA_PUBLIC_URL", "https://sarkari.example")
    monkeypatch.setattr(
        worker,
        "write_artifact_bytes",
        lambda data, wf, ext, ct: str(tmp_path / f"report{ext}"),
    )
    monkeypatch.setattr(worker, "fetch_page", lambda url: (url, NOTIFICATION_HTML))

    class FakeClient:
        def __init__(self, ctx):
            pass

        def generate_text(self, prompt, **kwargs):
            return json.dumps(MODEL_ANSWER)

    monkeypatch.setattr(worker, "CapabilityClient", FakeClient)


def test_run_posts_drafts_and_reports(monkeypatch, ingest_env):
    posted = []

    def fake_post_draft(api_url, key, payload):
        posted.append(payload)
        return {"id": "p1", "editUrl": "/admin/posts/p1", "duplicate": len(posted) > 1}

    monkeypatch.setattr(worker, "post_draft", fake_post_draft)
    job = StubJob(
        {
            "urls": "https://ssc.gov.in/cgl\nhttps://ssc.gov.in/cgl-2",
            "categorySlug": "latest-jobs",
        }
    )

    result = asyncio.run(worker.run(job))

    assert result["status"] == "completed"
    meta = result["artifacts"][0]["metadata"]
    assert meta["created"] == 1 and meta["duplicates"] == 1
    assert meta["drafts"][0]["url"] == "https://sarkari.example/admin/posts/p1"
    assert result["artifacts"][0]["kind"] == "ingest_report"
    assert posted[0]["categorySlug"] == "latest-jobs"


def test_run_records_per_page_failures_without_failing(monkeypatch, ingest_env):
    def failing_fetch(url):
        raise ValueError("PDF notifications are not supported yet")

    monkeypatch.setattr(worker, "fetch_page", failing_fetch)
    job = StubJob({"urls": "https://ssc.gov.in/a.pdf"})

    result = asyncio.run(worker.run(job))

    assert result["artifacts"][0]["metadata"]["failed"] == 1


def test_run_stops_on_rejected_ingest_key(monkeypatch, ingest_env):
    def rejected(api_url, key, payload):
        raise worker.IngestConfigError("bad key")

    monkeypatch.setattr(worker, "post_draft", rejected)
    with pytest.raises(worker.IngestConfigError):
        asyncio.run(worker.run(StubJob({"urls": "https://ssc.gov.in/cgl"})))


def test_run_requires_ingest_config(monkeypatch):
    monkeypatch.delenv("SARKARI_DUNIYA_API_URL", raising=False)
    with pytest.raises(RuntimeError, match="SARKARI_DUNIYA_API_URL"):
        asyncio.run(worker.run(StubJob({"urls": "https://ssc.gov.in/cgl"})))
