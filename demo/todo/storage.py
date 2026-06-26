"""JSON persistence for the todo store."""
from __future__ import annotations

import json
import os


def load_todos(path: str | os.PathLike) -> list[dict]:
    """Load todos from ``path``. Missing or empty file -> []."""
    try:
        with open(path, "r", encoding="utf-8") as fh:
            content = fh.read()
    except FileNotFoundError:
        return []
    content = content.strip()
    if not content:
        return []
    return json.loads(content)


def save_todos(path: str | os.PathLike, todos: list[dict]) -> None:
    """Write ``todos`` to ``path`` as indented JSON."""
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(todos, fh, indent=2)
