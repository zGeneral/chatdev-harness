// chatdev-memory — a tiny retrieval-memory service for the ChatDev harness.
// Embeds text with Workers AI (@cf/baai/bge-m3, 1024-dim), stores vectors in Vectorize
// (filtered by `namespace`) and raw text in D1. Two routes, bearer-token auth.
//
//   POST /upsert  { namespace, text, id?, metadata? }   -> { id }
//   POST /query   { namespace, query, top_k? }          -> { matches: [{ id, score, text }] }
//   GET  /health                                         -> { ok: true }

const EMBED_MODEL = '@cf/baai/bge-m3'; // 1024-dim, matches the chatdev-memory index

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });

async function embed(env, text) {
  const res = await env.AI.run(EMBED_MODEL, { text: [String(text)] });
  // Workers AI returns { data: [[...floats...]] } (or { shape, data })
  const vec = res && res.data && res.data[0];
  if (!Array.isArray(vec)) throw new Error('embedding failed');
  return vec;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/health') return json({ ok: true });

    // --- auth ---
    const auth = request.headers.get('authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!env.AUTH_TOKEN || token !== env.AUTH_TOKEN) return json({ error: 'unauthorized' }, 401);

    if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405);

    let body;
    try { body = await request.json(); } catch { return json({ error: 'invalid json' }, 400); }

    try {
      if (url.pathname === '/upsert') {
        const namespace = String(body.namespace || 'default');
        const text = body.text;
        if (!text || !String(text).trim()) return json({ error: 'text required' }, 400);
        const id = String(body.id || crypto.randomUUID());
        const metadata = { namespace, ...(body.metadata && typeof body.metadata === 'object' ? body.metadata : {}) };

        const values = await embed(env, text);
        await env.VECTORIZE.upsert([{ id, values, metadata }]);
        await env.DB.prepare(
          'INSERT OR REPLACE INTO memories (id, namespace, text, metadata, created) VALUES (?, ?, ?, ?, ?)'
        ).bind(id, namespace, String(text), JSON.stringify(metadata), new Date().toISOString()).run();

        return json({ id, namespace });
      }

      if (url.pathname === '/query') {
        const namespace = String(body.namespace || 'default');
        const query = body.query;
        if (!query || !String(query).trim()) return json({ error: 'query required' }, 400);
        const topK = Math.max(1, Math.min(20, parseInt(body.top_k, 10) || 5));

        const values = await embed(env, query);
        const result = await env.VECTORIZE.query(values, {
          topK,
          filter: { namespace: { $eq: namespace } },
          returnMetadata: 'none',
        });
        const matches = (result && result.matches) || [];
        if (!matches.length) return json({ matches: [] });

        // join with D1 for the raw text
        const ids = matches.map((m) => m.id);
        const placeholders = ids.map(() => '?').join(',');
        const rows = await env.DB.prepare(
          `SELECT id, text FROM memories WHERE id IN (${placeholders})`
        ).bind(...ids).all();
        const textById = new Map((rows.results || []).map((r) => [r.id, r.text]));

        return json({
          matches: matches.map((m) => ({ id: m.id, score: m.score, text: textById.get(m.id) || null })),
        });
      }

      if (url.pathname === '/list') {
        // List raw entries in a namespace from D1 (no vector search) — for consolidation.
        const namespace = String(body.namespace || 'default');
        const limit = Math.max(1, Math.min(500, parseInt(body.limit, 10) || 200));
        const rows = await env.DB.prepare(
          'SELECT id, text, metadata, created FROM memories WHERE namespace = ? ORDER BY created DESC LIMIT ?'
        ).bind(namespace, limit).all();
        const items = (rows.results || []).map((r) => ({ id: r.id, text: r.text, metadata: r.metadata, created: r.created }));
        return json({ namespace, count: items.length, items });
      }

      if (url.pathname === '/delete') {
        // Delete by id list, or the whole namespace when no ids are given.
        const namespace = String(body.namespace || 'default');
        let ids = Array.isArray(body.ids) ? body.ids.map(String) : null;
        if (!ids) {
          const rows = await env.DB.prepare('SELECT id FROM memories WHERE namespace = ?').bind(namespace).all();
          ids = (rows.results || []).map((r) => r.id);
        }
        if (!ids.length) return json({ namespace, deleted: 0 });
        await env.VECTORIZE.deleteByIds(ids);
        const placeholders = ids.map(() => '?').join(',');
        await env.DB.prepare(`DELETE FROM memories WHERE id IN (${placeholders})`).bind(...ids).run();
        return json({ namespace, deleted: ids.length });
      }

      return json({ error: 'not found' }, 404);
    } catch (err) {
      return json({ error: String((err && err.message) || err) }, 500);
    }
  },
};
