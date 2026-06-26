# chatdev-memory — retrieval memory for the ChatDev harness

A tiny Cloudflare Worker that gives the harness's `memory` graph nodes real retrieval memory,
entirely on your own Cloudflare account — **no third-party API keys**.

- **Workers AI** (`@cf/baai/bge-m3`, 1024-dim) embeds text and queries.
- **Vectorize** stores the vectors, filtered by a `namespace` metadata index (per project / per run).
- **D1** holds the raw chunk text keyed by vector id.
- Bearer-token auth on every route.

## Routes
| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/health` | — | `{ ok: true }` |
| POST | `/upsert` | `{ namespace, text, id?, metadata? }` | `{ id, namespace }` |
| POST | `/query` | `{ namespace, query, top_k? }` | `{ matches: [{ id, score, text }] }` |

All POST routes require `Authorization: Bearer <AUTH_TOKEN>`.

## Deploy (one time)
```bash
cd cloudflare/memory-worker
npm install                                   # wrangler

# 1. Vector index (1024-dim cosine for bge-m3) + namespace metadata index
wrangler vectorize create chatdev-memory --dimensions 1024 --metric cosine
wrangler vectorize create-metadata-index chatdev-memory --property-name namespace --type string

# 2. D1 database — paste the printed database_id into wrangler.jsonc (d1_databases[0].database_id)
wrangler d1 create chatdev-memory
wrangler d1 execute chatdev-memory --remote --file schema.sql

# 3. Auth token (choose a strong random value; entered securely, not echoed)
wrangler secret put AUTH_TOKEN

# 4. Deploy — prints your Worker URL
wrangler deploy
```
Then put the Worker URL and the token into the repo `.env` as `MEMORY_URL` / `MEMORY_TOKEN`
(see `../../.env.example`).

## Notes
- **Eventual consistency:** a vector is queryable a few seconds after `/upsert` (Vectorize indexes
  asynchronously). The `memory` node stores one item at a time and retries transient edge errors.
- **Namespaces** isolate data — e.g. `gamedesign`, `proj:todo`, `run:<id>`. Reset by deleting that
  namespace's vectors, or recreate the index.
- **Cost:** Workers AI embeddings + Vectorize are billed to your account on their usual free/paid tiers.
- Tear down: `wrangler delete`, `wrangler vectorize delete chatdev-memory`, `wrangler d1 delete chatdev-memory`.
