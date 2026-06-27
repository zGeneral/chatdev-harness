#!/usr/bin/env python3
"""Log a graph run to the GUI's run dashboard (chatdev-gui Worker -> D1).

Best-effort + optional: if GUI_URL / GUI_TOKEN aren't set (env or repo .env), it prints
"RUN LOG SKIPPED" and exits 0, so it never affects a build. Called at the end of a graph run.

  python tools/run_log.py --graph tandem --green true --steps 6 --final "10/10 green"
"""
import argparse
import json
import os
import sys
import urllib.error
import urllib.request

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"


def creds():
    url, tok = os.environ.get("GUI_URL"), os.environ.get("GUI_TOKEN")
    if url and tok:
        return url, tok
    envf = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
    if os.path.isfile(envf):
        for line in open(envf):
            line = line.strip()
            if line.startswith("GUI_URL=") and not url:
                url = line.split("=", 1)[1]
            elif line.startswith("GUI_TOKEN=") and not tok:
                tok = line.split("=", 1)[1]
    return url, tok


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--graph", required=True)
    ap.add_argument("--green", default="false")
    ap.add_argument("--steps", type=int, default=0)
    ap.add_argument("--final", default="")
    a = ap.parse_args()

    url, tok = creds()
    if not url or not tok:
        print("RUN LOG SKIPPED (no GUI_URL/GUI_TOKEN)")
        return 0
    body = {"graph": a.graph, "green": str(a.green).lower() in ("1", "true", "yes"),
            "steps": a.steps, "final": a.final[:2000]}
    req = urllib.request.Request(url.rstrip("/") + "/api/runs/log",
                                 data=json.dumps(body).encode(), method="POST",
                                 headers={"Authorization": "Bearer " + tok, "Content-Type": "application/json", "User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            print("logged " + (json.loads(r.read().decode()).get("id", "?")))
    except Exception as e:  # noqa: BLE001 — best-effort, never fail a build
        sys.stderr.write("run log failed (ignored): " + str(e) + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
