import json
import os
import tempfile
from pathlib import Path


def read_json(path, fallback):
    try:
        with Path(path).open("r", encoding="utf-8") as handle:
            value = json.load(handle)
        return value if isinstance(value, dict) else fallback
    except (OSError, ValueError, json.JSONDecodeError):
        return fallback


def atomic_write_json(path, value):
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_name = tempfile.mkstemp(prefix=target.stem + "-", suffix=".tmp", dir=target.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as handle:
            json.dump(value, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
        os.replace(temp_name, target)
    finally:
        if os.path.exists(temp_name):
            os.unlink(temp_name)
