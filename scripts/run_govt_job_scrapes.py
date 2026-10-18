#!/usr/bin/env python3
"""Starts one govt-job-agent workflow per seed query, e.g. once a day from cron:

    0 6 * * *  cd /path/to/Agentry-One && python3 scripts/run_govt_job_scrapes.py >> /tmp/govt-jobs.log 2>&1

Needs AGENTRY_API_URL, AGENTRY_API_KEY and GOVT_JOB_PROJECT_ID (the Agentry
project whose text-generation provider the agent should use). Each workflow
sends what it finds to Sarkari Duniya as drafts; it does not wait for them.
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import date

import requests

YEAR = date.today().year

# (query, categorySlug, stateSlug) -- edit freely.
SEED_QUERIES: list[tuple[str, str, str]] = [
    (f"SSC recruitment notification {YEAR}", "latest-jobs", "all-india"),
    (f"UPSC recruitment notification {YEAR}", "latest-jobs", "all-india"),
    (f"RRB railway recruitment notification {YEAR}", "latest-jobs", "all-india"),
    (f"IBPS bank recruitment notification {YEAR}", "latest-jobs", "all-india"),
    (
        f"Indian Army Navy Air Force recruitment notification {YEAR}",
        "latest-jobs",
        "all-india",
    ),
    (f"CTET teacher recruitment notification {YEAR}", "latest-jobs", "all-india"),
    (f"UPSSSC UPPSC recruitment notification {YEAR}", "latest-jobs", "uttar-pradesh"),
    (f"BPSC BSSC recruitment notification {YEAR}", "latest-jobs", "bihar"),
    (f"RPSC RSMSSB recruitment notification {YEAR}", "latest-jobs", "rajasthan"),
    (f"MPPSC MPESB recruitment notification {YEAR}", "latest-jobs", "madhya-pradesh"),
    (f"sarkari result declared {YEAR}", "results", "all-india"),
    (f"admit card released {YEAR} government exam", "admit-card", "all-india"),
]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--query", help="run a single query instead of the seed list")
    parser.add_argument("--max-candidates", type=int, default=4)
    parser.add_argument(
        "--dry-run", action="store_true", help="print what would be started"
    )
    args = parser.parse_args()

    api_url = os.environ.get("AGENTRY_API_URL", "http://localhost:4000").rstrip("/")
    api_key = os.environ.get("AGENTRY_API_KEY")
    project_id = os.environ.get("GOVT_JOB_PROJECT_ID")
    if not api_key or not project_id:
        print("AGENTRY_API_KEY and GOVT_JOB_PROJECT_ID must be set", file=sys.stderr)
        return 2

    seeds = [(args.query, "latest-jobs", "all-india")] if args.query else SEED_QUERIES
    failures = 0
    for query, category, state in seeds:
        body = {
            "agentId": "govt-job-agent",
            "input": {
                "query": query,
                "categorySlug": category,
                "stateSlug": state,
                "maxCandidates": args.max_candidates,
            },
        }
        if args.dry_run:
            print(f"would start: {body['input']}")
            continue
        res = requests.post(
            f"{api_url}/projects/{project_id}/workflows",
            json=body,
            headers={"X-API-Key": api_key},
            timeout=30,
        )
        if res.ok:
            print(f"started {res.json().get('id')}: {query}")
        else:
            failures += 1
            print(
                f"FAILED ({res.status_code}) {query}: {res.text[:300]}", file=sys.stderr
            )
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
