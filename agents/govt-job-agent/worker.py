import asyncio
import json
import os
import re
import sys
from datetime import date
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import parse_qs, urljoin, urlparse

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))  # repo root

import requests
from python.sdk.agent_job import AgentJob
from python.sdk.artifact_io import write_artifact_bytes
from python.sdk.net_safety import UnsafeUrlError, assert_public_http_url
from python.sdk.providers import CapabilityClient
from python.sdk.runner import run_agent

INGEST_SOURCE = "govt-job-agent"
BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
MAX_PAGE_BYTES = 3 * 1024 * 1024
MAX_REDIRECTS = 5
MAX_PROMPT_TEXT_CHARS = 6000
MAX_PROMPT_LINKS = 40
# Only the Ollama adapter forwards extra kwargs (its default 2048-token
# context is too small for a page, and small models need JSON mode to answer
# reliably); hosted providers ignore them.
GENERATE_KWARGS = {"format": "json", "options": {"num_ctx": 4096}}

TEXT_FIELDS = (
    "titleEn",
    "titleHi",
    "excerptEn",
    "organization",
    "qualification",
    "totalPosts",
    "ageLimit",
    "salary",
    "feeGeneral",
    "feeObc",
    "feeScSt",
    "feeWomen",
)
DATE_FIELDS = ("lastDate", "examDate", "resultDate")
LINK_FIELDS = (
    "applyLink",
    "officialLink",
    "notificationLink",
    "admitCardLink",
    "answerKeyLink",
    "syllabusLink",
)
QUALIFICATION_LEVELS = {"tenth", "twelfth", "graduate", "post_graduate", "any"}


class IngestConfigError(RuntimeError):
    """Sarkari Duniya rejected our credentials -- every candidate would fail the same way."""


# ---------------------------------------------------------------- discovery


def search_candidate_urls(query: str, limit: int) -> list[str]:
    """Real result URLs from DuckDuckGo's HTML endpoint (its links are
    /l/?uddg=<target> redirects; the target is unwrapped here)."""
    res = requests.post(
        "https://html.duckduckgo.com/html/",
        data={"q": query},
        headers={"User-Agent": BROWSER_UA, "Referer": "https://html.duckduckgo.com/"},
        timeout=15,
    )
    res.raise_for_status()
    urls: list[str] = []
    for href in re.findall(r'<a[^>]+class="result__a"[^>]+href="([^"]+)"', res.text):
        href = href.replace("&amp;", "&")
        if href.startswith("//"):
            href = "https:" + href
        parsed = urlparse(href)
        if parsed.netloc.endswith("duckduckgo.com"):
            target = parse_qs(parsed.query).get("uddg", [None])[0]
            if not target:
                continue  # ads (y.js) and other internal links
            href = target
        if href.startswith(("http://", "https://")) and href not in urls:
            urls.append(href)
        if len(urls) >= limit:
            break
    return urls


def parse_url_list(raw) -> list[str]:
    if isinstance(raw, list):
        items = raw
    else:
        items = re.split(r"[\s,]+", str(raw or ""))
    return [
        u.strip()
        for u in items
        if isinstance(u, str) and u.strip().startswith(("http://", "https://"))
    ]


# ---------------------------------------------------------------- fetching


def fetch_page(url: str) -> tuple[str, str]:
    """GETs a page, following redirects by hand so every hop is checked
    against private/internal addresses. Returns (final_url, html)."""
    current = url
    for _ in range(MAX_REDIRECTS + 1):
        assert_public_http_url(current)
        with requests.get(
            current,
            timeout=30,
            stream=True,
            allow_redirects=False,
            headers={"User-Agent": BROWSER_UA},
        ) as res:
            if 300 <= res.status_code < 400 and res.headers.get("Location"):
                current = urljoin(current, res.headers["Location"])
                continue
            res.raise_for_status()
            content_type = (res.headers.get("Content-Type") or "").lower()
            if "pdf" in content_type or urlparse(current).path.lower().endswith(".pdf"):
                raise ValueError("PDF notifications are not supported yet")
            if (
                content_type
                and "html" not in content_type
                and "text" not in content_type
            ):
                raise ValueError(f"unsupported content type {content_type!r}")
            chunks, total = [], 0
            for chunk in res.iter_content(64 * 1024):
                total += len(chunk)
                if total > MAX_PAGE_BYTES:
                    break  # the useful part of a notification page is near the top
                chunks.append(chunk)
            encoding = res.encoding or "utf-8"
            return current, b"".join(chunks).decode(encoding, errors="replace")
    raise ValueError(f"more than {MAX_REDIRECTS} redirects")


class _PageText(HTMLParser):
    SKIP = {"script", "style", "noscript", "svg", "head"}
    BLOCK = {
        "p",
        "div",
        "br",
        "li",
        "tr",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "table",
        "section",
        "td",
        "th",
    }

    def __init__(self, base_url: str):
        super().__init__(convert_charrefs=True)
        self.base_url = base_url
        self.parts: list[str] = []
        self.links: list[tuple[str, str]] = []
        self._skip_depth = 0
        self._href: str | None = None
        self._anchor: list[str] = []

    def handle_starttag(self, tag, attrs):
        if tag in self.SKIP:
            self._skip_depth += 1
        elif tag in self.BLOCK:
            self.parts.append("\n")
        if tag == "a":
            href = dict(attrs).get("href")
            self._href = urljoin(self.base_url, href) if href else None
            self._anchor = []

    def handle_endtag(self, tag):
        if tag in self.SKIP and self._skip_depth:
            self._skip_depth -= 1
        if tag == "a" and self._href:
            text = " ".join("".join(self._anchor).split())
            if self._href.startswith(("http://", "https://")) and text:
                self.links.append((text[:80], self._href))
            self._href = None

    def handle_data(self, data):
        if self._skip_depth:
            return
        self.parts.append(data)
        if self._href:
            self._anchor.append(data)


def page_to_text(html: str, base_url: str) -> tuple[str, list[tuple[str, str]]]:
    parser = _PageText(base_url)
    parser.feed(html)
    lines = (" ".join(line.split()) for line in "".join(parser.parts).splitlines())
    text = "\n".join(line for line in lines if line)
    seen, links = set(), []
    for anchor, href in parser.links:
        if href not in seen:
            seen.add(href)
            links.append((anchor, href))
    return text, links


# ---------------------------------------------------------------- extraction


def build_prompt(url: str, text: str, links: list[tuple[str, str]]) -> str:
    link_lines = "\n".join(
        f"- {anchor}: {href}" for anchor, href in links[:MAX_PROMPT_LINKS]
    )
    # Instructions go after the page: when a small local model's context is
    # too short, Ollama drops the start of the prompt, and losing some page
    # text is far better than losing the instructions.
    return f"""Below is a web page. After it come instructions for extracting
Indian government job / exam notification details from it.

PAGE URL: {url}

PAGE TEXT:
{text[:MAX_PROMPT_TEXT_CHARS]}

LINKS:
{link_lines}

=== INSTRUCTIONS ===
Today is {date.today().isoformat()}.

Return ONLY one JSON object, no prose, no markdown fences.

If the page is not about ONE specific recruitment, exam, result, admit card or answer key
(for example it is a list of many jobs, a news roundup, or unrelated), return:
{{"isJobNotification": false}}

Otherwise return:
{{
  "isJobNotification": true,
  "titleEn": "short title, e.g. 'SSC CGL 2026 Notification - 17727 Posts'",
  "excerptEn": "1-2 sentence summary",
  "organization": "recruiting body, e.g. 'Staff Selection Commission (SSC)'",
  "qualification": "eligibility text",
  "qualificationLevel": "one of tenth | twelfth | graduate | post_graduate | any",
  "totalPosts": "number of vacancies as text",
  "ageLimit": "e.g. '18-32 years'",
  "minAge": 18,
  "maxAge": 32,
  "salary": "pay scale text",
  "feeGeneral": "", "feeObc": "", "feeScSt": "", "feeWomen": "",
  "lastDate": "YYYY-MM-DD", "examDate": "YYYY-MM-DD", "resultDate": "YYYY-MM-DD",
  "applyLink": "", "officialLink": "", "notificationLink": "",
  "admitCardLink": "", "answerKeyLink": "", "syllabusLink": "",
  "importantDates": [{{"label": "Application Start", "date": "as written on the page"}}]
}}

Rules:
- Use only facts present on the page. Use null for anything not stated; never guess.
- Links must be copied exactly from the LINKS list above.
- Dates in lastDate/examDate/resultDate must be YYYY-MM-DD or null.
- Output the JSON object only.
"""


def parse_json_object(raw: str) -> dict | None:
    cleaned = re.sub(
        r"<think>.*?</think>", "", raw or "", flags=re.DOTALL
    )  # reasoning models (qwen3)
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start == -1 or end <= start:
        return None
    try:
        value = json.loads(cleaned[start : end + 1])
    except ValueError:
        return None
    return value if isinstance(value, dict) else None


def _clean_text(value) -> str | None:
    if value is None:
        return None
    text = " ".join(str(value).split())
    return text or None


def _clean_date(value) -> str | None:
    text = _clean_text(value)
    if not text:
        return None
    try:
        return date.fromisoformat(text[:10]).isoformat()
    except ValueError:
        return None


def _clean_int(value) -> int | None:
    try:
        number = int(value)
    except (TypeError, ValueError):
        return None
    return number if 0 < number < 100 else None


def _clean_link(value) -> str | None:
    text = _clean_text(value)
    return text if text and text.startswith(("http://", "https://")) else None


def to_ingest_payload(
    extracted: dict, source_url: str, category_slug: str | None, state_slug: str | None
) -> dict | None:
    """Maps the model's answer onto Sarkari Duniya's /api/ingest/posts body,
    dropping anything malformed rather than sending it for review."""
    if not extracted.get("isJobNotification"):
        return None
    title = _clean_text(extracted.get("titleEn"))
    if not title:
        return None

    payload: dict = {
        "titleEn": title[:200],
        "sourceUrl": source_url,
        "ingestSource": INGEST_SOURCE,
    }
    for field in TEXT_FIELDS[1:]:
        if value := _clean_text(extracted.get(field)):
            payload[field] = value
    for field in DATE_FIELDS:
        if value := _clean_date(extracted.get(field)):
            payload[field] = value
    for field in LINK_FIELDS:
        if value := _clean_link(extracted.get(field)):
            payload[field] = value
    for field in ("minAge", "maxAge"):
        if (value := _clean_int(extracted.get(field))) is not None:
            payload[field] = value
    level = _clean_text(extracted.get("qualificationLevel"))
    if level in QUALIFICATION_LEVELS:
        payload["qualificationLevel"] = level

    dates = []
    for item in extracted.get("importantDates") or []:
        if isinstance(item, dict):
            label, when = _clean_text(item.get("label")), _clean_text(item.get("date"))
            if label and when:
                dates.append({"label": label, "date": when})
    if dates:
        payload["importantDates"] = dates
    if category_slug:
        payload["categorySlug"] = category_slug
    if state_slug:
        payload["stateSlug"] = state_slug
    return payload


# ---------------------------------------------------------------- ingestion


def ingest_config() -> tuple[str, str, str]:
    api_url = (os.environ.get("SARKARI_DUNIYA_API_URL") or "").rstrip("/")
    key = os.environ.get("SARKARI_DUNIYA_INGEST_KEY") or ""
    if not api_url or not key:
        raise RuntimeError(
            "SARKARI_DUNIYA_API_URL and SARKARI_DUNIYA_INGEST_KEY must be set in the worker environment"
        )
    public_url = (os.environ.get("SARKARI_DUNIYA_PUBLIC_URL") or api_url).rstrip("/")
    return api_url, key, public_url


def post_draft(api_url: str, key: str, payload: dict) -> dict:
    res = requests.post(
        f"{api_url}/api/ingest/posts",
        json=payload,
        headers={"X-Ingest-Key": key},
        timeout=30,
    )
    if res.status_code == 401:
        raise IngestConfigError(
            "Sarkari Duniya rejected the ingest key (HTTP 401) -- check SARKARI_DUNIYA_INGEST_KEY"
        )
    if res.status_code not in (200, 201):
        try:
            detail = res.json().get("error")
        except ValueError:
            detail = None
        raise RuntimeError(
            f"ingest failed (HTTP {res.status_code}){': ' + detail if detail else ''}"
        )
    return res.json()


# ---------------------------------------------------------------- report


def render_report(query: str | None, outcomes: list[dict], public_url: str) -> str:
    counts = {
        k: sum(1 for o in outcomes if o["status"] == k)
        for k in ("created", "duplicate", "skipped", "failed")
    }
    lines = [
        "# Govt job ingest report",
        "",
        f"**Query:** {query or '(direct URLs only)'}",
        f"**Created drafts:** {counts['created']} | **Already existed:** {counts['duplicate']} | "
        f"**Skipped:** {counts['skipped']} | **Failed:** {counts['failed']}",
        "",
        f"Review drafts at {public_url}/admin/posts?status=draft",
        "",
    ]
    for o in outcomes:
        lines.append(f"## {o['status'].upper()}: {o.get('title') or o['url']}")
        lines.append(f"- Source: {o['url']}")
        if o.get("editUrl"):
            lines.append(f"- Review: {public_url}{o['editUrl']}")
        if o.get("reason"):
            lines.append(f"- Note: {o['reason']}")
        lines.append("")
    return "\n".join(lines)


# ---------------------------------------------------------------- handler


async def run(job: AgentJob) -> dict:
    api_url, key, public_url = ingest_config()
    params = job.params
    query = (params.get("query") or "").strip() or None
    category_slug = params.get("categorySlug") or None
    state_slug = params.get("stateSlug") or None
    try:
        max_candidates = max(1, min(10, int(params.get("maxCandidates") or 4)))
    except (TypeError, ValueError):
        max_candidates = 4

    loop = asyncio.get_running_loop()

    candidates = parse_url_list(params.get("urls"))
    if query and len(candidates) < max_candidates:
        await job.report_progress(5, f"Searching the web for: {query}")
        try:
            found = await loop.run_in_executor(
                None, search_candidate_urls, query, max_candidates * 2
            )
        except requests.RequestException as exc:
            await job.log(f"web search failed: {exc}", level="warn")
            found = []
        candidates += [u for u in found if u not in candidates]
    candidates = candidates[:max_candidates]
    if not candidates:
        raise ValueError("No pages to process: give a search query or at least one URL")
    await job.log(f"processing {len(candidates)} page(s): " + ", ".join(candidates))

    client = CapabilityClient(job.provider_context)
    outcomes: list[dict] = []

    for index, url in enumerate(candidates):
        base = 10 + int(85 * index / len(candidates))
        outcome: dict = {"url": url}
        outcomes.append(outcome)
        try:
            await job.report_progress(
                base, f"[{index + 1}/{len(candidates)}] Fetching {url}"
            )
            final_url, html = await loop.run_in_executor(None, fetch_page, url)
            text, links = page_to_text(html, final_url)
            if len(text) < 200:
                outcome.update(
                    status="skipped",
                    reason="page has almost no readable text (may need JavaScript)",
                )
                continue

            await job.report_progress(
                base + 3, f"[{index + 1}/{len(candidates)}] Extracting details"
            )
            raw = await loop.run_in_executor(
                None,
                lambda: client.generate_text(
                    build_prompt(final_url, text, links), **GENERATE_KWARGS
                ),
            )
            extracted = parse_json_object(raw)
            if extracted is None:
                outcome.update(
                    status="failed", reason="model did not return valid JSON"
                )
                await job.log(
                    f"{url}: unparseable model output: {(raw or '')[:200]!r}",
                    level="warn",
                )
                continue

            payload = to_ingest_payload(extracted, final_url, category_slug, state_slug)
            if payload is None:
                outcome.update(status="skipped", reason="not a single job notification")
                continue
            outcome["title"] = payload["titleEn"]

            result = await loop.run_in_executor(None, post_draft, api_url, key, payload)
            outcome.update(
                status="duplicate" if result.get("duplicate") else "created",
                editUrl=result.get("editUrl"),
            )
            await job.log(f"{outcome['status']}: {payload['titleEn']}")
        except IngestConfigError:
            raise
        except (
            UnsafeUrlError,
            ValueError,
            requests.RequestException,
            RuntimeError,
        ) as exc:
            outcome.update(status="failed", reason=str(exc)[:300])
            await job.log(f"{url}: {exc}", level="warn")

    await job.report_progress(97, "Saving report")
    report = render_report(query, outcomes, public_url)
    path = write_artifact_bytes(
        report.encode("utf-8"), job.workflow_id, ".md", "text/markdown"
    )
    counts = {
        k: sum(1 for o in outcomes if o["status"] == k)
        for k in ("created", "duplicate", "skipped", "failed")
    }
    await job.report_progress(100, f"Done: {counts['created']} new draft(s)")

    return {
        "status": "completed",
        "artifacts": [
            {
                "kind": "ingest_report",
                "path": path,
                "mimeType": "text/markdown",
                "metadata": {
                    "query": query,
                    "created": counts["created"],
                    "duplicates": counts["duplicate"],
                    "skipped": counts["skipped"],
                    "failed": counts["failed"],
                    "drafts": [
                        {"title": o.get("title"), "url": f"{public_url}{o['editUrl']}"}
                        for o in outcomes
                        if o.get("editUrl")
                    ],
                },
            }
        ],
        "error": None,
    }


if __name__ == "__main__":
    run_agent({"run": run}, queue_name="agent.govt-job-agent")
