---
description: Run a declarative ChatDev-2.0-style graph (YAML) through the graph engine — real Claude Code subagents + tools
argument-hint: <path/to/graph.yaml> [initial input...]
---

Execute a declarative graph (a port of ChatDev 2.0's YAML-graph engine) via
`.claude/workflows/chatdev-graph.js`. Nodes are agent/literal/passthrough/loop_counter/subgraph;
edges route on the source node's text output (`contains:` / `!contains:` / `regex:` / `equals:` / `default`).

Graph file + optional initial input: $ARGUMENTS

Do this:
1. The engine sandbox has **no YAML parser**, so convert the authored YAML → JSON first (ensure pyyaml:
   `.venv/bin/pip install pyyaml`):
   ```bash
   .venv/bin/python -c "import yaml,json,sys; print(json.dumps(yaml.safe_load(open(sys.argv[1]))['graph']))" <graph.yaml>
   ```
   Capture that JSON object (it is the value of the top-level `graph:` key).
2. Invoke the engine, passing the parsed graph as `args.graph` and any initial input as `args.input`:
   `Workflow({ scriptPath: ".claude/workflows/chatdev-graph.js", args: { graph: <the JSON object>, input: "<initial input>" } })`
3. When it finishes, report the **final node output** and the **execution trace** (which nodes ran, in order),
   plus any real artifacts the agent nodes produced on disk.

Author new graphs in `graphs/*.yaml`. See `graphs/demo_build.yaml` for the shape and
`CLAUDE.md` → "Declarative graph engine" for the node/edge reference.
