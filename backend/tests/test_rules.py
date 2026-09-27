"""Pure domain rules: unlock state machine, Kuis scoring, XP, diagnostics."""
import pytest

from app.services import diagnostics, scoring, unlock


def test_initial_only_pahami_open():
    p = unlock.initial_phases()
    assert [p[x]["state"] for x in unlock.PHASES] == ["open", "locked", "locked", "locked"]
    assert unlock.current_phase(p) == "pahami"


def test_phases_unlock_in_order():
    p = unlock.complete(unlock.initial_phases(), "pahami")
    assert p["perkuat"]["state"] == "open" and p["kuis"]["state"] == "locked"
    p = unlock.complete(p, "perkuat", 88)
    assert p["kuis"]["state"] == "open"
    with pytest.raises(ValueError):
        unlock.complete(unlock.initial_phases(), "kuis")


def test_kuis_gate_needs_70_percent():
    p = unlock.complete(unlock.complete(unlock.initial_phases(), "pahami"), "perkuat")
    p, passed = unlock.record_kuis(p, 60)
    assert not passed and p["kuis"]["state"] == "open" and p["uji"]["state"] == "locked" and p["kuis"]["score"] == 60
    p, passed = unlock.record_kuis(p, 70)
    assert passed and p["kuis"]["state"] == "done" and p["uji"]["state"] == "open"


def test_chapter_done_after_uji():
    p = unlock.initial_phases()
    for ph in unlock.PHASES:
        p = unlock.complete(p, ph)
    assert unlock.is_chapter_done(p) and unlock.ring_values(p) == [1.0, 1.0, 1.0, 1.0]


def test_kuis_points_and_combo():
    assert scoring.kuis_points(1, 12) == 160
    assert scoring.kuis_points(3, 0) == 300
    combo = 1
    for ok in (True, True, True, True):
        combo = scoring.next_combo(combo, ok)
    assert combo == 3  # capped
    assert scoring.next_combo(3, False) == 1
    assert scoring.kuis_xp(1600) == 80
    assert scoring.perkuat_item_xp(True) == 10 and scoring.perkuat_item_xp(False) == 5


def test_diagnostic_typo_suggests_fix():
    d = diagnostics.diagnose('console.log("Total jajan:", jajn);', {"name": "ReferenceError", "message": "jajn is not defined", "line": 1},
                            scope_code="let jajan = 12000 + 8000;")
    assert d["available"] and "jajan" in d["fix"]["label"] and "jajan);" in d["fix"]["code"]


def test_diagnostic_const_reassign():
    code = "const nyawa = 3;\nnyawa = nyawa - 1;"
    d = diagnostics.diagnose(code, {"name": "TypeError", "message": "Assignment to constant variable.", "line": 2})
    assert d["available"] and d["fix"]["code"].startswith("let nyawa")


def test_diagnostic_capped_and_unknown():
    assert not diagnostics.diagnose("x", {"name": "ReferenceError", "message": "x is not defined"}, assist_cap=1)["available"]
    assert not diagnostics.diagnose("x", {"name": "RangeError", "message": "weird"})["available"]
