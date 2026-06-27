#!/usr/bin/env python3
"""CLI for the chatdev-memory Cloudflare Worker — the factory's experiential ("lessons learned")
memory. Subcommands: search | store | list | delete. Reads MEMORY_URL + MEMORY_TOKEN from env,
falling back to the repo .env (gitignored). Retries transient Cloudflare edge errors (e.g. 1042)
with backoff. Used by the engine's `memory` node (backend: cloudflare) and the reflection /
consolidation graphs.

  python tools/mem.py search --namespace lessons:gamedev --query "headless pygame" --top-k 5
  python tools/mem.py store  --namespace lessons:gamedev --text "<lesson>" [--meta source=tandem]
  python tools/mem.py list   --namespace lessons:gamedev [--limit 200]
  python tools/mem.py delete --namespace lessons:gamedev [--id <id> ...]   # no --id => whole namespace
"""
import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"


def dehex(h):
    # Inverse of the engine's hexEnc: hex -> ascii (percent-encoded UTF-8) -> text.
    return urllib.parse.unquote(bytes.fromhex(h).decode("ascii"))


def creds():
    url, tok = os.environ.get("MEMORY_URL"), os.environ.get("MEMORY_TOKEN")
    if url and tok:
        return url, tok
    envf = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
    if os.path.isfile(envf):
        for line in open(envf):
            line = line.strip()
            if line.startswith("MEMORY_URL=") and not url:
                url = line.split("=", 1)[1]
            elif line.startswith("MEMORY_TOKEN=") and not tok:
                tok = line.split("=", 1)[1]
    return url, tok


def call(url, tok, path, body, retries=4):
    last = None
    for attempt in range(retries):
        req = urllib.request.Request(
            url.rstrip("/") + path,
            data=json.dumps(body).encode(),
            method="POST",
            headers={"Authorization": "Bearer " + tok, "Content-Type": "application/json", "User-Agent": UA},
        )
        try:
            with urllib.request.urlopen(req, timeout=45) as r:
                return json.loads(r.read().decode())
        except urllib.error.HTTPError as e:
            last = f"HTTP {e.code}: {e.read().decode()[:200]}"
        except Exception as e:  # noqa: BLE001
            last = str(e)
        time.sleep(1.5 * (attempt + 1))  # backoff for transient edge errors (1042 etc.)
    raise RuntimeError(last or "request failed")


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    for c in ("search", "store", "list", "delete"):
        p = sub.add_parser(c)
        p.add_argument("--namespace", required=True)
        if c == "search":
            p.add_argument("--query")
            p.add_argument("--query-hex")  # hex(encodeURIComponent(text)) — safe transport for untrusted text
            p.add_argument("--top-k", type=int, default=5)
        elif c == "store":
            p.add_argument("--text")
            p.add_argument("--text-hex")
            p.add_argument("--meta", action="append", default=[])
        elif c == "list":
            p.add_argument("--limit", type=int, default=200)
        elif c == "delete":
            p.add_argument("--id", action="append", default=[])
    a = ap.parse_args()

    url, tok = creds()
    if not url or not tok:
        print("MEMORY UNAVAILABLE")
        return 0
    try:
        if a.cmd == "search":
            q = dehex(a.query_hex) if a.query_hex else (a.query or "")
            if not q.strip():
                sys.stderr.write("query (or --query-hex) required\n")
                return 2
            d = call(url, tok, "/query", {"namespace": a.namespace, "query": q, "top_k": a.top_k})
            ms = d.get("matches", [])
            if not ms:
                print("no relevant memory")
                return 0
            for m in ms:
                print("- " + (m.get("text") or "").strip())
        elif a.cmd == "store":
            text = dehex(a.text_hex) if a.text_hex else (a.text or "")
            if not text.strip():
                sys.stderr.write("text (or --text-hex) required\n")
                return 2
            meta = {}
            for kv in a.meta:
                if "=" in kv:
                    k, v = kv.split("=", 1)
                    meta[k] = v
            d = call(url, tok, "/upsert", {"namespace": a.namespace, "text": text, "metadata": meta})
            print("stored id=" + str(d.get("id")))
        elif a.cmd == "list":
            d = call(url, tok, "/list", {"namespace": a.namespace, "limit": a.limit})
            items = d.get("items", [])
            print(json.dumps({"namespace": a.namespace, "count": len(items),
                              "items": [{"id": i.get("id"), "text": i.get("text")} for i in items]}))
        elif a.cmd == "delete":
            body = {"namespace": a.namespace}
            if a.id:
                body["ids"] = a.id
            d = call(url, tok, "/delete", body)
            print("deleted=" + str(d.get("deleted")))
    except Exception as e:  # noqa: BLE001
        sys.stderr.write(str(e) + "\n")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
