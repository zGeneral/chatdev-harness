"""Core todo API operating on an explicit storage path."""
from __future__ import annotations

import os

from .storage import load_todos, save_todos


class TodoError(Exception):
    """Raised for todo operations that fail (e.g. unknown id)."""


def add_todo(path: str | os.PathLike, text: str) -> dict:
    """Append a todo with ``text``, assign next id, persist, return it."""
    todos = load_todos(path)
    new_id = max((t["id"] for t in todos), default=0) + 1
    item = {"id": new_id, "text": text, "done": False}
    todos.append(item)
    save_todos(path, todos)
    return item


def list_todos(path: str | os.PathLike) -> list[dict]:
    """Return all todos in ascending id order."""
    return sorted(load_todos(path), key=lambda t: t["id"])


def mark_done(path: str | os.PathLike, todo_id: int) -> dict:
    """Mark the todo with ``todo_id`` as done. Raise TodoError if absent."""
    todos = load_todos(path)
    for item in todos:
        if item["id"] == todo_id:
            item["done"] = True
            save_todos(path, todos)
            return item
    raise TodoError(f"no todo with id {todo_id}")


def remove_todo(path: str | os.PathLike, todo_id: int) -> dict:
    """Remove the todo with ``todo_id``, persist remainder, return it.

    Raise TodoError if no todo has that id (store left unchanged).
    """
    todos = load_todos(path)
    for index, item in enumerate(todos):
        if item["id"] == todo_id:
            del todos[index]
            save_todos(path, todos)
            return item
    raise TodoError(f"no todo with id {todo_id}")


def format_todo(todo: dict) -> str:
    """Render a todo as '<id> [ ] <text>' / '<id> [x] <text>'."""
    mark = "x" if todo["done"] else " "
    return f"{todo['id']} [{mark}] {todo['text']}"
