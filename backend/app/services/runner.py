"""Runs learner JavaScript in a Node subprocess (runner/sandbox.mjs).

The program runs in a fresh node:vm context without host objects, with a time
limit, and Node's permission model blocks file writes, child processes and
network access. This is adequate for a school deployment; for a public
service put the runner in a container or use isolated-vm.
"""
from __future__ import annotations

import json
import subprocess
from pathlib import Path
from typing import Any

from ..config import settings

SANDBOX = Path(__file__).resolve().parent.parent.parent / "runner" / "sandbox.mjs"
MAX_CODE_CHARS = 20_000


class RunnerUnavailable(RuntimeError):
    pass


def run(code: str, tests: list[dict[str, Any]] | None = None, var_names: list[str] | None = None) -> dict[str, Any]:
    if len(code) > MAX_CODE_CHARS:
        return {"logs": [], "error": {"name": "Error", "message": "Kode terlalu panjang.", "line": None},
                "vars": {}, "results": [{"id": t["id"], "pass": False, "detail": "kode terlalu panjang", "ms": 0} for t in tests or []]}
    job = {"code": code, "tests": tests or [], "vars": var_names or [], "timeoutMs": settings.runner_timeout_ms}
    cmd = [
        settings.node_bin,
        "--permission",
        f"--allow-fs-read={SANDBOX.parent}",
        "--max-old-space-size=64",
        "--disallow-code-generation-from-strings",
        str(SANDBOX),
    ]
    try:
        proc = subprocess.run(
            cmd, input=json.dumps(job), capture_output=True, text=True, encoding="utf-8",
            timeout=settings.runner_timeout_ms / 1000 + 4,
        )
    except FileNotFoundError as e:
        raise RunnerUnavailable("Node.js tidak ditemukan di server.") from e
    except subprocess.TimeoutExpired:
        return {"logs": [], "error": {"name": "TimeoutError", "message": "Program berjalan terlalu lama (mungkin loop tanpa akhir).", "line": None},
                "vars": {}, "results": [{"id": t["id"], "pass": False, "detail": "program berhenti karena error", "ms": 0} for t in tests or []]}
    if proc.returncode != 0 or not proc.stdout.strip():
        raise RunnerUnavailable(f"Runner gagal: {proc.stderr.strip()[:300]}")
    return json.loads(proc.stdout)


def error_text(err: dict[str, Any] | None) -> str:
    if not err:
        return ""
    line = f" · baris {err['line']}" if err.get("line") else ""
    return f"{err['name']}: {err['message']}{line}"
