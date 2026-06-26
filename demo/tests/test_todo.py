import subprocess
import sys
from pathlib import Path

import pytest

from todo import (
    add_todo,
    format_todo,
    list_todos,
    load_todos,
    mark_done,
    save_todos,
    TodoError,
)

DEMO_DIR = Path(__file__).resolve().parent.parent


def test_add_returns_item_with_id_1(tmp_path):
    p = tmp_path / "todos.json"
    item = add_todo(p, "buy milk")
    assert item == {"id": 1, "text": "buy milk", "done": False}


def test_add_increments_ids(tmp_path):
    p = tmp_path / "todos.json"
    a = add_todo(p, "buy milk")
    b = add_todo(p, "walk dog")
    assert a["id"] == 1
    assert b["id"] == 2


def test_list_returns_all_in_order(tmp_path):
    p = tmp_path / "todos.json"
    add_todo(p, "buy milk")
    add_todo(p, "walk dog")
    items = list_todos(p)
    assert [t["id"] for t in items] == [1, 2]
    assert items[0]["text"] == "buy milk"
    assert items[1]["text"] == "walk dog"
    assert all(t["done"] is False for t in items)


def test_format_todo_open_and_done():
    assert format_todo({"id": 1, "text": "buy milk", "done": False}) == "1 [ ] buy milk"
    assert format_todo({"id": 2, "text": "ship it", "done": True}) == "2 [x] ship it"


def test_done_marks_item(tmp_path):
    p = tmp_path / "todos.json"
    add_todo(p, "buy milk")
    updated = mark_done(p, 1)
    assert updated["done"] is True
    assert updated["id"] == 1
    assert list_todos(p)[0]["done"] is True


def test_done_missing_id_raises(tmp_path):
    p = tmp_path / "todos.json"
    add_todo(p, "buy milk")
    with pytest.raises(TodoError) as exc:
        mark_done(p, 99)
    assert "99" in str(exc.value)
    assert list_todos(p)[0]["done"] is False


def test_persistence_round_trip(tmp_path):
    p = tmp_path / "todos.json"
    add_todo(p, "buy milk")
    mark_done(p, 1)
    reloaded = load_todos(p)
    assert reloaded == [{"id": 1, "text": "buy milk", "done": True}]


def test_load_missing_file_returns_empty(tmp_path):
    p = tmp_path / "nope.json"
    assert load_todos(p) == []


def test_cli_add_and_list_subprocess(tmp_path):
    store = tmp_path / "todos.json"
    env = {"TODO_FILE": str(store)}
    import os
    full_env = {**os.environ, **env}

    add = subprocess.run(
        [sys.executable, "-m", "todo", "add", "buy milk"],
        cwd=DEMO_DIR, env=full_env, capture_output=True, text=True,
    )
    assert add.returncode == 0
    assert add.stdout.strip() == "Added todo 1: buy milk"

    lst = subprocess.run(
        [sys.executable, "-m", "todo", "list"],
        cwd=DEMO_DIR, env=full_env, capture_output=True, text=True,
    )
    assert lst.returncode == 0
    assert lst.stdout.strip() == "1 [ ] buy milk"
    assert not (DEMO_DIR / "todos.json").exists()


def test_cli_done_missing_id_exit_code(tmp_path):
    store = tmp_path / "todos.json"
    import os
    full_env = {**os.environ, "TODO_FILE": str(store)}
    res = subprocess.run(
        [sys.executable, "-m", "todo", "done", "99"],
        cwd=DEMO_DIR, env=full_env, capture_output=True, text=True,
    )
    assert res.returncode == 1
    assert "Error: no todo with id 99" in res.stderr
