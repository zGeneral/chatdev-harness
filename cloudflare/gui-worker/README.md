# chatdev-gui — the harness console

A small Cloudflare app (Worker + static SPA) to **browse/edit graphs**, **inspect & curate the
lessons memory**, **browse personal-rag notebooks**, and see a **run dashboard** — all in one place.
Self-contained: **no external CDNs** (YAML is parsed server-side; the graph diagram is a custom SVG
renderer). Upstream tokens stay **server-side**; the browser only holds the app's `GUI_TOKEN`.

## Tabs
- **Lessons** — list / semantic-search / **edit** / **delete** / add entries in any `chatdev-memory`
  namespace (default `lessons:gamedev`). Edits re-embed; deletes remove vector + text.
- **Notebooks** — list personal-rag notebooks and search within one (read-only).
- **Graphs** — list `graphs/*.yaml` (from the public GitHub repo), view the YAML + a rendered
  node/edge **diagram**, edit + **Render** (server-side parse) + copy/download. Save by pasting back
  into the repo, then run with `/run-graph graphs/<name>.yaml`.
- **Runs** — recent graph runs (logged by `tools/run_log.py` at the end of a run).

## Architecture
- **Worker** (`src/index.js`): serves the SPA (`public/`) and `/api/*`. Proxies to the
  `chatdev-memory` and `personal-rag` Workers (tokens held as secrets), lists graphs from GitHub,
  parses YAML with the bundled `js-yaml`, and reads/writes the `runs` D1 table.
- **Auth**: every `/api/*` (except `/api/health`) requires `Authorization: Bearer <GUI_TOKEN>`.

## Deploy
```bash
cd cloudflare/gui-worker
npm install
wrangler d1 create chatdev-gui                      # paste database_id into wrangler.jsonc (already set here)
wrangler d1 execute chatdev-gui --remote --file schema.sql
# secrets (entered securely, never committed):
wrangler secret put GUI_TOKEN          # app password
wrangler secret put MEMORY_URL         # https://chatdev-memory.<sub>.workers.dev
wrangler secret put MEMORY_TOKEN
wrangler secret put RAG_API_URL        # https://personal-rag-mcp.<sub>.workers.dev
wrangler secret put RAG_API_TOKEN
wrangler deploy
```
Then add `GUI_URL` + `GUI_TOKEN` to the repo `.env` so `tools/run_log.py` can record runs.

> Roadmap (v2): save graphs back to the repo via the GitHub API (needs a PAT), drag-to-edit the
> diagram, and live run streaming.
