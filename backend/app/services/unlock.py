"""Per-chapter unlock state machine (INFORMATION-ARCHITECTURE §1, CONCEPT §3).

    pahami:open  --complete-->                 pahami:done  + perkuat:open
    perkuat:open --all items correct once-->   perkuat:done + kuis:open
    kuis:open    --round >= pass_pct-->        kuis:done    + uji:open   (below pass: stays open)
    uji:open     --exam passed / all tests-->  uji:done  -> chapter done -> next chapter pahami:open

Pure functions over the `phases` dict so they are trivially testable.
"""
from __future__ import annotations

import copy
from typing import Any

PHASES = ("pahami", "perkuat", "kuis", "uji")
PHASE_LABEL = {"pahami": "Pahami", "perkuat": "Perkuat", "kuis": "Kuis", "uji": "Uji"}
KUIS_PASS_PCT = 70

Phases = dict[str, dict[str, Any]]


def initial_phases() -> Phases:
    return {p: {"state": "open" if p == "pahami" else "locked", "progress": 0.0} for p in PHASES}


def all_done_phases() -> Phases:
    return {p: {"state": "done", "progress": 1.0} for p in PHASES}


def current_phase(phases: Phases) -> str:
    """The phase the "Lanjutkan" button opens: the first one not done (or uji if all done)."""
    for p in PHASES:
        if phases[p]["state"] != "done":
            return p
    return "uji"


def is_open(phases: Phases, phase: str) -> bool:
    return phases[phase]["state"] in ("open", "done")


def is_chapter_done(phases: Phases) -> bool:
    return all(phases[p]["state"] == "done" for p in PHASES)


def set_progress(phases: Phases, phase: str, progress: float) -> Phases:
    out = copy.deepcopy(phases)
    if out[phase]["state"] == "open":
        out[phase]["progress"] = max(0.0, min(1.0, round(progress, 3)))
    return out


def complete(phases: Phases, phase: str, score: float | None = None) -> Phases:
    """Mark `phase` done and open the next one. Raises if the phase is still locked."""
    if phases[phase]["state"] == "locked":
        raise ValueError(f"{phase} masih terkunci")
    out = copy.deepcopy(phases)
    out[phase]["state"] = "done"
    out[phase]["progress"] = 1.0
    if score is not None:
        out[phase]["score"] = score
    idx = PHASES.index(phase)
    if idx + 1 < len(PHASES):
        nxt = PHASES[idx + 1]
        if out[nxt]["state"] == "locked":
            out[nxt]["state"] = "open"
    return out


def record_kuis(phases: Phases, pct: int, pass_pct: int = KUIS_PASS_PCT) -> tuple[Phases, bool]:
    """Apply a finished gate round. Returns (phases, passed). Failing keeps Kuis open with the best score."""
    passed = pct >= pass_pct
    if passed:
        best = max(pct, phases["kuis"].get("score") or 0)
        return complete(phases, "kuis", best), True
    out = copy.deepcopy(phases)
    if out["kuis"]["state"] != "done":
        out["kuis"]["score"] = max(pct, out["kuis"].get("score") or 0)
        out["kuis"]["progress"] = round(pct / 100, 3)
    return out, False


def ring_values(phases: Phases) -> list[float]:
    """Values for the 4-arc PhaseRing (done = 1, open = progress, locked = 0)."""
    vals = []
    for p in PHASES:
        st = phases[p]
        vals.append(1.0 if st["state"] == "done" else float(st.get("progress") or 0) if st["state"] == "open" else 0.0)
    return vals


def done_count(phases: Phases) -> int:
    return sum(1 for p in PHASES if phases[p]["state"] == "done")
