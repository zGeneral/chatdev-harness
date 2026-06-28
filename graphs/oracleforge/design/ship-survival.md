# Ship survival — re-census the DEPLOYED bundle (oracle factory, final gate)

The factory measures the **dev** engine (oracle census, foundation determinism) but never the **shipped**
one. Bundling, minification, UI glue, and service-worker caching can silently alter solver behavior or
serve a stale build. This final gate drives the actual served bundle in a real browser (Playwright MCP)
and re-runs the oracle *in-page* — the verifier trusts nothing the builder said.

> Distilled from `fagemx/gstack-game` (`gameplay-implementation-review` design-intent-survival,
> `implementation-handoff`, `game-qa`) — extracted, not installed.

## How to run (agent has Bash + the Playwright MCP tools)
Serve `out/factory/` detached on a port, wait for it (bounded curl-retry), `browser_navigate` to it, run the
checks via `browser_evaluate` (importing/using the page's own engine module), then kill the server.

## Checks (the shipped artifact must SURVIVE its own pipeline)
1. **Shipped-engine re-census.** In-page (`browser_evaluate`), import the bundle's engine + solver and run a
   mini yield-census over a FIXED seed-set of N instances. The shipped `solvable%` and `unique-optimal%`
   must match `out/factory`'s recorded oracle/foundation numbers within tolerance (ideally exact on the
   fixed seeds). Any out-of-tolerance metric ⇒ DO_NOT_SHIP (cite the metric, the baseline, the delta).
2. **Twin-run determinism in-browser.** Same level + same moves → identical result, run twice in the page.
3. **Soul-ablation holds in the bundle.** Disabling the signature technique still flips instances to
   unsolvable/non-unique (the soul survived bundling).
4. **Share-URL roundtrip.** Encode a level to a share URL, reload the page with it, assert identical state.
5. **Version sync.** The displayed version string == the build hash / `package.json` version == `sw.js` VERSION.
6. **Service-worker freshness.** The SW registers with the new hash and the OLD cache is purged (no stale
   build); then reload OFFLINE and confirm the puzzle still boots.

## Output
End with EXACTLY `SHIP-SURVIVAL: PASS` if every check holds (re-census within tolerance, determinism, soul,
share roundtrip, version sync, offline boot), else `SHIP-SURVIVAL: FAIL` + the failing check, the measured
value, and the baseline it violated. Edit nothing; failures route back to `ship`.

CREDITS: distilled from `fagemx/gstack-game` (MIT); our words; nothing installed.
