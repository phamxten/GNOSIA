"""Chapter content documents: loading published versions, hiding answer keys
from learners, and checking answers server-side.

Content shape (one JSON document per chapter version):

    {
      "minutes": {"pahami": 6, "perkuat": 8, ...},
      "concepts": ["let", "const", ...],
      "cheatsheet": "let skor = 10;  // ...",
      "pahami":  {"scenes":  [Scene, ...]},
      "perkuat": {"items":   [Exercise, ...]},
      "kuis":    {"round_size": 10, "seconds": 20, "pass_pct": 70, "combo_max": 3, "bank": [Question, ...]},
      "ulangan": {"minutes": 30, "pass_mark": 75, "questions": [ExamQuestion, ...]},
      "challenge": {"title", "story", "steps", "starter", "filename", "tests": [Test, ...], ...},
      "uji_mode": "any" | "ulangan" | "challenge"
    }
"""
from __future__ import annotations

import copy
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Chapter, ChapterVersion

ANSWER_KEYS = ("answer", "a", "l6")


def published(db: Session, chapter: Chapter, version: int | None = None) -> dict[str, Any] | None:
    v = version or chapter.version
    if not v:
        return None
    row = db.scalar(select(ChapterVersion).where(ChapterVersion.chapter_id == chapter.id, ChapterVersion.version == v))
    if row is None and version:
        return published(db, chapter)
    return row.content if row else None


def empty_content() -> dict[str, Any]:
    return {
        "minutes": {"pahami": 6, "perkuat": 8, "kuis": 4, "uji": 10},
        "concepts": [],
        "cheatsheet": "",
        "pahami": {"scenes": []},
        "perkuat": {"items": []},
        "kuis": {"round_size": 10, "seconds": 20, "pass_pct": 70, "combo_max": 3, "bank": []},
        "ulangan": {"minutes": 30, "pass_mark": 75, "questions": []},
        "challenge": None,
        "uji_mode": "any",
    }


# ------------------------------------------------------------- learner views
def perkuat_item_public(item: dict[str, Any]) -> dict[str, Any]:
    out = {k: v for k, v in item.items() if k not in ("answer", "hints", "explain", "l6")}
    out["has_hints"] = [lvl for lvl in ("l3", "l4", "l5") if (item.get("hints") or {}).get(lvl)]
    out["has_solution"] = bool(item.get("l6"))
    return out


def kuis_question_public(q: dict[str, Any]) -> dict[str, Any]:
    return {k: q[k] for k in ("id", "t", "c", "o", "trivia") if k in q}


def exam_question_public(q: dict[str, Any]) -> dict[str, Any]:
    return {k: q[k] for k in ("id", "t", "code", "type", "o", "pts", "pre", "label") if k in q}


def challenge_public(ch: dict[str, Any]) -> dict[str, Any]:
    out = {k: v for k, v in ch.items() if k != "tests"}
    out["tests"] = [
        {"id": t["id"], "name": ("Tes tersembunyi" if t.get("hidden") else t["name"]), "hidden": bool(t.get("hidden"))}
        for t in ch.get("tests", [])
    ]
    return out


def find(items: list[dict[str, Any]], item_id: str) -> dict[str, Any] | None:
    return next((i for i in items if i.get("id") == item_id), None)


# ------------------------------------------------------------- answer checks
def check_perkuat(item: dict[str, Any], answer: Any) -> tuple[bool, Any]:
    """Returns (correct, marks). `marks` tells the UI which parts to outline."""
    t = item["type"]
    key = item.get("answer")
    if t in ("choice", "predict"):
        ok = _as_int(answer) == key
        return ok, {"picked": _as_int(answer), "ok": ok}
    if t == "bug":
        ok = _as_int(answer) == key
        return ok, {"picked": _as_int(answer), "ok": ok}
    if t == "fill":
        got = list(answer or [])
        marks = [i < len(got) and got[i] == exp for i, exp in enumerate(key)]
        return all(marks) and len(got) == len(key), marks
    if t == "parsons":
        got = [str(x) for x in (answer or [])]
        marks = [i < len(key) and got[i] == str(key[i]) for i in range(len(got))]
        return got == [str(k) for k in key], marks
    if t == "slider":
        ok = _as_int(answer) == key
        return ok, {"ok": ok}
    if t == "match":
        pairs = answer or []
        left = {p["key"] for p in item.get("left", [])}
        ok = len(pairs) == len(left) and all(isinstance(p, (list, tuple)) and len(p) == 2 and p[0] == p[1] for p in pairs)
        return ok, {"ok": ok}
    raise ValueError(f"tipe soal tidak dikenal: {t}")


def check_exam_static(q: dict[str, Any], answer: Any) -> bool | None:
    """Checks choice/short questions. Returns None for code questions (run by the sandbox)."""
    if answer is None or answer == "":
        return False
    if q["type"] == "choice":
        return _as_int(answer) == q.get("answer")
    if q["type"] == "short":
        norm = str(answer).strip().rstrip(";").strip().lower()
        return norm in [a.lower() for a in q.get("accept", [])]
    return None


def _as_int(v: Any) -> int | None:
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def item_concepts(content: dict[str, Any], phase: str, item_id: str) -> list[str]:
    pool = {
        "perkuat": content.get("perkuat", {}).get("items", []),
        "kuis": content.get("kuis", {}).get("bank", []),
        "ulangan": content.get("ulangan", {}).get("questions", []),
    }.get(phase, [])
    it = find(pool, item_id)
    return list((it or {}).get("concepts", []))


def phase_counts(content: dict[str, Any]) -> dict[str, int]:
    items = content.get("perkuat", {}).get("items", [])
    return {
        "scenes": len(content.get("pahami", {}).get("scenes", [])),
        "items": len([i for i in items if not i.get("adaptive")]),
        "similar": len([i for i in items if i.get("adaptive")]),
        "bank": len(content.get("kuis", {}).get("bank", [])),
        "exam": len((content.get("ulangan") or {}).get("questions", [])),
    }


def clone(content: dict[str, Any]) -> dict[str, Any]:
    return copy.deepcopy(content)
