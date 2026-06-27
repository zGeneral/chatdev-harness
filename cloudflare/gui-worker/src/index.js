// chatdev-gui — backend for the harness GUI. Serves the SPA (public/) and a small /api/* that
// proxies to the chatdev-memory Worker (lessons) and personal-rag Worker (notebooks) with their
// tokens held server-side, lists graphs from the public GitHub repo, and records runs in D1.
// Browser auth: a single bearer GUI_TOKEN.

import yaml from 'js-yaml';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const GH = { owner: 'zGeneral', repo: 'chatdev-harness', branch: 'main' };

const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json' } });

// Constant-time token comparison: compare fixed-length SHA-256 digests (no early-exit, no length leak).
async function safeEqual(a, b) {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([crypto.subtle.digest('SHA-256', enc.encode(String(a || ''))), crypto.subtle.digest('SHA-256', enc.encode(String(b || '')))]);
  const x = new Uint8Array(ha), y = new Uint8Array(hb);
  let r = 0; for (let i = 0; i < x.length; i++) r |= x[i] ^ y[i];
  return r === 0 && !!a && !!b;
}

// Call a bound Worker (service binding) directly — avoids same-account public-fetch error 1042.
async function svc(binding, token, path, method, body) {
  const init = { method, headers: { 'User-Agent': UA, Accept: 'application/json' } };
  if (token) init.headers.Authorization = 'Bearer ' + token;
  if (body !== undefined) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(body); }
  const r = await binding.fetch(new Request('https://svc' + path, init));
  const t = await r.text();
  let data; try { data = JSON.parse(t); } catch { data = { raw: t.slice(0, 500) }; }
  return { status: r.status, data };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const p = url.pathname;
    if (!p.startsWith('/api/')) return new Response('Not found', { status: 404 }); // assets serve the SPA

    if (p === '/api/health') return json({ ok: true });

    // --- auth (everything except /api/health) ---
    const auth = request.headers.get('authorization') || '';
    const tok = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!env.GUI_TOKEN || !(await safeEqual(tok, env.GUI_TOKEN))) return json({ error: 'unauthorized' }, 401);

    try {
      const body = request.method === 'POST' ? await request.json().catch(() => ({})) : {};

      // ---- lessons (chatdev-memory Worker) ----
      if (p === '/api/lessons/list')
        return relay(await svc(env.MEMORY, env.MEMORY_TOKEN, '/list', 'POST', { namespace: body.namespace, limit: body.limit || 300 }));
      if (p === '/api/lessons/search')
        return relay(await svc(env.MEMORY, env.MEMORY_TOKEN, '/query', 'POST', { namespace: body.namespace, query: body.query, top_k: body.top_k || 8 }));
      if (p === '/api/lessons/save')
        return relay(await svc(env.MEMORY, env.MEMORY_TOKEN, '/upsert', 'POST', { namespace: body.namespace, id: body.id, text: body.text, metadata: body.metadata || {} }));
      if (p === '/api/lessons/delete')
        return relay(await svc(env.MEMORY, env.MEMORY_TOKEN, '/delete', 'POST', { namespace: body.namespace, ids: body.ids }));

      // ---- personal-rag (notebooks) ----
      if (p === '/api/rag/notebooks')
        return relay(await svc(env.RAG, env.RAG_API_TOKEN, '/api/notebooks', 'GET'));
      if (p === '/api/rag/search')
        return relay(await svc(env.RAG, env.RAG_API_TOKEN, '/api/search', 'POST', { notebook: body.notebook, query: body.query, top_k: body.top_k || 8 }));
      if (p === '/api/rag/documents') {
        const nb = encodeURIComponent(body.notebook || '');
        return relay(await svc(env.RAG, env.RAG_API_TOKEN, '/api/documents?notebook=' + nb + '&limit=200', 'GET'));
      }

      // ---- graphs (public GitHub repo) ----
      if (p === '/api/graphs/list') {
        const r = await fetch(`https://api.github.com/repos/${GH.owner}/${GH.repo}/contents/graphs?ref=${GH.branch}`,
          { headers: { 'User-Agent': UA, Accept: 'application/vnd.github+json' } });
        const arr = await r.json();
        const files = Array.isArray(arr) ? arr.filter((f) => f.name.endsWith('.yaml')).map((f) => f.name) : [];
        return json({ files });
      }
      if (p === '/api/graphs/get') {
        const name = String(body.name || '').replace(/[^a-zA-Z0-9_.-]/g, '');
        const r = await fetch(`https://raw.githubusercontent.com/${GH.owner}/${GH.repo}/${GH.branch}/graphs/${name}`,
          { headers: { 'User-Agent': UA } });
        if (!r.ok) return json({ error: 'graph not found' }, 404);
        const text = await r.text();
        let graph = null, parse_error = null;
        // js-yaml load() is safe by default (no code execution); CORE_SCHEMA = standard YAML scalars only.
        try { const doc = yaml.load(text, { schema: yaml.CORE_SCHEMA }); graph = (doc && doc.graph) || doc; } catch (e) { parse_error = String((e && e.message) || e); }
        return json({ name, yaml: text, graph, parse_error });
      }
      if (p === '/api/graphs/parse') {
        try { const doc = yaml.load(body.yaml || '', { schema: yaml.CORE_SCHEMA }); return json({ graph: (doc && doc.graph) || doc }); }
        catch (e) { return json({ error: String((e && e.message) || e) }, 400); }
      }

      // ---- runs (D1) ----
      if (p === '/api/runs/list') {
        const rows = await env.DB.prepare('SELECT id, graph, green, steps, final, created FROM runs ORDER BY created DESC LIMIT 100').all();
        return json({ runs: rows.results || [] });
      }
      if (p === '/api/runs/log') {
        const id = crypto.randomUUID();
        await env.DB.prepare('INSERT INTO runs (id, graph, green, steps, final, created) VALUES (?,?,?,?,?,?)')
          .bind(id, String(body.graph || '?'), body.green ? 1 : 0, parseInt(body.steps, 10) || 0,
                String(body.final || '').slice(0, 2000), new Date().toISOString()).run();
        return json({ id });
      }

      return json({ error: 'not found' }, 404);
    } catch (e) {
      return json({ error: String((e && e.message) || e) }, 500);
    }

    function relay(r) { return json(r.data, r.status >= 400 ? r.status : 200); }
  },
};
