"""CLI entry point for the todo package."""
from __future__ import annotations

import argparse
import os
import sys

from .core import TodoError, add_todo, format_todo, list_todos, mark_done, remove_todo


def _resolve_path() -> str:
    return os.environ.get("TODO_FILE", "todos.json")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="todo")
    sub = parser.add_subparsers(dest="command", required=True)

    add_p = sub.add_parser("add", help="add a todo")
    add_p.add_argument("text")

    sub.add_parser("list", help="list todos")

    done_p = sub.add_parser("done", help="mark a todo as done")
    done_p.add_argument("id", type=int)

    remove_p = sub.add_parser("remove", help="remove a todo")
    remove_p.add_argument("id", type=int)

    args = parser.parse_args(argv)
    path = _resolve_path()

    if args.command == "add":
        item = add_todo(path, args.text)
        print(f"Added todo {item['id']}: {item['text']}")
        return 0

    if args.command == "list":
        for item in list_todos(path):
            print(format_todo(item))
        return 0

    if args.command == "done":
        try:
            mark_done(path, args.id)
        except TodoError as exc:
            print(f"Error: {exc}", file=sys.stderr)
            return 1
        print(f"Marked todo {args.id} as done")
        return 0

    if args.command == "remove":
        try:
            remove_todo(path, args.id)
        except TodoError as exc:
            print(f"Error: {exc}", file=sys.stderr)
            return 1
        print(f"Removed todo {args.id}")
        return 0

    return 2


if __name__ == "__main__":
    sys.exit(main())
