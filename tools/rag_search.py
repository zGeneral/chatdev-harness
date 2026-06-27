#!/usr/bin/env python3
"""Retrieve passages from a personal-rag notebook via the Worker `/api/search` HTTP API.

Used by the engine's `memory` node (backend: personal-rag). OPTIONAL / private: if no
credentials are found it prints "MEMORY UNAVAILABLE" and exits 0, so graphs that reference it
degrade gracefully for anyone without a personal-rag deployment.

Credentials are read from RAG_API_URL + RAG_API_TOKEN (env), falling back to the
`personal-rag-bridge` MCP server's env in ~/.claude.json — so it works out of the box for the
owner without duplicating the token. Author your own personal-rag and set RAG_API_URL/RAG_API_TOKEN
to use a different backend.

  python tools/rag_search.py --notebook game-design --query "movement and game feel" --top-k 5
"""
import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"


def get_creds():
    url, tok = os.environ.get("RAG_API_URL"), os.environ.get("RAG_API_TOKEN")
    if url and tok:
        return url, tok
    try:
        cfg = json.load(open(os.path.expanduser("~/.claude.json")))
    except Exception:
        return None, None

    def find(o):
        if isinstance(o, dict):
            for k, v in o.items():
                if k in ("mcpServers", "mcp_servers") and isinstance(v, dict) and "personal-rag-bridge" in v:
                    return v["personal-rag-bridge"].get("env", {})
                if isinstance(v, (dict, list)):
                    r = find(v)
                    if r:
                        return r
        elif isinstance(o, list):
            for x in o:
                r = find(x)
                if r:
                    return r
        return None

    env = find(cfg) or {}
    return env.get("RAG_API_URL"), env.get("RAG_API_TOKEN")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--notebook", required=True)
    ap.add_argument("--query")
    ap.add_argument("--query-hex")  # hex(encodeURIComponent(text)) — safe transport for untrusted text
    ap.add_argument("--top-k", type=int, default=5)
    a = ap.parse_args()
    query = urllib.parse.unquote(bytes.fromhex(a.query_hex).decode("ascii")) if a.query_hex else (a.query or "")
    if not query.strip():
        sys.stderr.write("query (or --query-hex) required\n")
        return 2

    url, tok = get_creds()
    if not url or not tok:
        print("MEMORY UNAVAILABLE")
        return 0

    req = urllib.request.Request(
        url.rstrip("/") + "/api/search",
        data=json.dumps({"notebook": a.notebook, "query": query, "top_k": a.top_k}).encode(),
        method="POST",
        headers={"Authorization": "Bearer " + tok, "Content-Type": "application/json", "User-Agent": UA},
    )
    try:
        data = json.loads(urllib.request.urlopen(req, timeout=40).read().decode())
    except urllib.error.HTTPError as e:
        sys.stderr.write(f"search HTTP {e.code}: {e.read().decode()[:200]}\n")
        return 1
    except Exception as e:  # noqa: BLE001
        sys.stderr.write(f"search error: {e}\n")
        return 1

    matches = data.get("matches", [])
    if not matches:
        print("no relevant memory")
        return 0
    for m in matches:
        meta = m.get("metadata", {}) or {}
        title = meta.get("document_title") or meta.get("source_filename") or m.get("documentId", "")
        preview = (m.get("text_preview") or "").strip().replace("\n", " ")
        print(f"- ({title}) {preview}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
