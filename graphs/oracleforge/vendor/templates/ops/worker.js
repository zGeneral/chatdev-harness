// TEMPLATE — the one-Worker ship: static game assets + comments + scarce hints.
// Pattern: skills/ship-web-game. Privacy posture: no cookies,
// no raw IPs stored, comments are explicit submissions, reads token-gated.

const DIMS = ['fun', 'difficulty', 'fair'];
const HINTS_PER_DAY = 3;

export function validateComment(body) {
  // strict: user/lv required + length-capped; ratings ints 1–5 on DIMS only;
  // text ≤500; reject empty (no rating AND no text); never throw.
  return { ok: false, error: 'TODO' };
}

async function hintKey(request) {
  // salted hash of (IP, UTC day) — second browsers share the allowance,
  // the raw IP never touches storage.
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const day = new Date().toISOString().slice(0, 10);
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`hints|${ip}|${day}`));
  return `h:${[...new Uint8Array(d)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/hint' && request.method === 'POST') {
      const key = await hintKey(request);
      const used = Number((await env.COMMENTS.get(key)) || 0);
      if (used >= HINTS_PER_DAY) {
        return new Response(JSON.stringify({ granted: false, remaining: 0 }), { status: 429, headers: { 'Content-Type': 'application/json' } });
      }
      await env.COMMENTS.put(key, String(used + 1), { expirationTtl: 86400 * 2 });
      return new Response(JSON.stringify({ granted: true, remaining: HINTS_PER_DAY - used - 1 }), { headers: { 'Content-Type': 'application/json' } });
    }

    if (url.pathname === '/api/comment' && request.method === 'POST') {
      // size-cap body → JSON.parse guarded → validateComment →
      // KV put `c:<level>:<user>:<ts>` → 204
    }

    if (url.pathname === '/api/comments' && request.method === 'GET') {
      // token gate (env.COMMENTS_TOKEN) → list prefix c: → group per level
      // per user → JSON. 403 otherwise.
    }

    return env.ASSETS.fetch(request); // static game files
  },
};

// wrangler.jsonc next to this file:
// { "name": "<game>", "main": "worker.js", "compatibility_date": "<recent>",
//   "assets": { "directory": "./public", "binding": "ASSETS" },
//   "kv_namespaces": [{ "binding": "COMMENTS" }] }   // id omitted → auto-provision
// Secrets: COMMENTS_TOKEN via `wrangler secret put` from a GITIGNORED file —
// verify the gitignore BEFORE the first commit; rotate, don't delete, on leaks.
