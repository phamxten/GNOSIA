"""Scores and XP (CONCEPT §3.3, §5). XP is never removed."""
from __future__ import annotations

KUIS_COMBO_MAX = 3
KUIS_POINTS_BASE = 100
KUIS_POINTS_PER_SECOND = 5

XP_PERKUAT_FIRST_TRY = 10
XP_PERKUAT_RETRY = 5
XP_PHASE_DONE = {"pahami": 50, "perkuat": 75, "kuis": 60}
XP_CHAPTER_DONE = 180
XP_KUIS_FAIL_CONSOLATION = 0  # the round's score/20 is still granted
XP_CHALLENGE_APPROVED = 30
XP_DAILY_QUIZ_CAP = 20


def kuis_points(combo: int, seconds_left: int) -> int:
    """Points for one correct answer: 100 × combo + remainingSeconds × 5."""
    return KUIS_POINTS_BASE * combo + max(0, seconds_left) * KUIS_POINTS_PER_SECOND


def next_combo(combo: int, correct: bool, combo_max: int = KUIS_COMBO_MAX) -> int:
    """Combo starts ×1, +1 per correct answer up to the max, resets on wrong/timeout."""
    if not correct:
        return 1
    return min(combo_max, combo + 1)


def kuis_xp(score: int) -> int:
    return score // 20


def accuracy_pct(correct: int, total: int) -> int:
    return round(100 * correct / total) if total else 0


def perkuat_item_xp(first_try: bool) -> int:
    return XP_PERKUAT_FIRST_TRY if first_try else XP_PERKUAT_RETRY
