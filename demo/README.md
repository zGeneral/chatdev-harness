# todo

A tiny install-free command-line TODO app. Todos are stored as a JSON array of
`{id, text, done}` objects.

## Run

From the `demo/` directory:

```bash
python -m todo add "buy milk"     # Added todo 1: buy milk
python -m todo add "walk dog"     # Added todo 2: walk dog
python -m todo list               # 1 [ ] buy milk
                                  # 2 [ ] walk dog
python -m todo done 1             # Marked todo 1 as done
python -m todo done 99            # Error: no todo with id 99   (exit 1)
```

`python -m todo done abc` is an argparse error (exit 2).

## Storage location

The CLI reads the storage path from the `TODO_FILE` environment variable,
defaulting to `todos.json` in the current working directory:

```bash
TODO_FILE=/tmp/mylist.json python -m todo list
```

The Python API (`todo.add_todo`, `list_todos`, `mark_done`, `load_todos`,
`save_todos`, `format_todo`) always takes an explicit path argument, so tests
and callers stay isolated. IDs are `max(existing id) + 1`, so they are never
reused. A missing or empty file is treated as an empty list.

## Tests

From the `demo/` directory:

```bash
python -m pytest -q
```
