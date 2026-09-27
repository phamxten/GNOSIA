"""Mentor signals (CONCEPT §6): computed from attempts and shown as sentences.

  repeated   same item wrong ≥ 3×                         "Alex salah 4× di Perkuat · Variabel · soal susun kode"
  gate       Kuis < pass mark twice for the same chapter  "Rizky gagal gerbang Kuis Variabel dua kali (60%, 50%)"
  hints      ≥ 3 items where all hints opened within 30 s "Maya membuka semua petunjuk dalam < 30 detik…"
  stalled    no progress in the current phase > 3 days    "Bayu tidak maju dari Pahami · scene 4 selama 5 hari"
  review     challenge / project submitted                "Salsa minta review · Challenge Rapor"
"""
from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Attempt, Chapter, ChapterProgress, HintOpen, PlayerState, QuizRound, Submission, User
from . import content as content_svc, unlock

TYPE_LABEL = {"choice": "pilih jawaban", "predict": "tebak output", "fill": "lengkapi kode", "parsons": "susun kode",
              "bug": "temukan bug", "slider": "atur nilai", "match": "pasangkan"}
SEVERITY = {"repeated": 4, "gate": 3, "hints": 2, "stalled": 1, "review": 0}
STALL_DAYS = 3


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _ch_content(db: Session, cache: dict[int, dict[str, Any]], chapter_id: int) -> tuple[Chapter | None, dict[str, Any]]:
    ch = db.get(Chapter, chapter_id)
    if chapter_id not in cache:
        cache[chapter_id] = (content_svc.published(db, ch) or {}) if ch else {}
    return ch, cache[chapter_id]


def learner_signals(db: Session, learner: User, cache: dict[int, dict[str, Any]] | None = None) -> list[dict[str, Any]]:
    cache = cache if cache is not None else {}
    first = learner.name.split()[0]
    out: list[dict[str, Any]] = []
    now_ = datetime.now(timezone.utc)

    # repeated failure on one Perkuat item
    wrong = Counter()
    last_at: dict[tuple[int, str], datetime] = {}
    answers: dict[tuple[int, str], list[Any]] = defaultdict(list)
    for a in db.scalars(select(Attempt).where(Attempt.user_id == learner.id, Attempt.phase == "perkuat", Attempt.correct.is_(False))):
        key = (a.chapter_id, a.item_id)
        wrong[key] += 1
        last_at[key] = max(last_at.get(key, _aware(a.created_at)), _aware(a.created_at))
        answers[key].append(a.answer)
    solved = {(a.chapter_id, a.item_id) for a in db.scalars(select(Attempt).where(
        Attempt.user_id == learner.id, Attempt.phase == "perkuat", Attempt.correct.is_(True)))}
    for (cid, iid), n in wrong.items():
        if n < 3 or (cid, iid) in solved:
            continue
        ch, content = _ch_content(db, cache, cid)
        item = content_svc.find(content.get("perkuat", {}).get("items", []), iid) or {}
        order = [i["id"] for i in content.get("perkuat", {}).get("items", []) if not i.get("adaptive")]
        num = order.index(iid) + 1 if iid in order else None
        same = len({repr(x) for x in answers[(cid, iid)]}) == 1
        out.append({
            "kind": "repeated", "phase": "perkuat", "count": n, "at": last_at[(cid, iid)],
            "html": f"{first} salah <b>{n}×</b> di Perkuat · {ch.title if ch else ''} · soal {TYPE_LABEL.get(item.get('type'), 'latihan')}",
            "pattern": "jawaban yang sama setiap kali" if same else "jawabannya berganti-ganti",
            "chapter_id": cid, "item_id": iid, "item_no": num,
            "action": {"label": "Kirim bantuan", "kind": "assign"},
        })

    # gate failure: Kuis below the pass mark twice for the same chapter (while still not passed)
    fails: dict[int, list[int]] = defaultdict(list)
    fail_at: dict[int, datetime] = {}
    rounds = db.scalars(select(QuizRound).where(QuizRound.user_id == learner.id, QuizRound.kind == "gate", QuizRound.finished.is_(True))
                        .order_by(QuizRound.created_at))
    passed_ch = set()
    for r in rounds:
        if r.passed:
            passed_ch.add(r.chapter_id)
        else:
            fails[r.chapter_id].append(r.pct or 0)
            fail_at[r.chapter_id] = _aware(r.created_at)
    for cid, pcts in fails.items():
        if len(pcts) >= 2 and cid not in passed_ch:
            ch, content = _ch_content(db, cache, cid)
            # the question they miss most
            missed = Counter()
            for a in db.scalars(select(Attempt).where(Attempt.user_id == learner.id, Attempt.chapter_id == cid, Attempt.phase == "kuis", Attempt.correct.is_(False))):
                missed[a.item_id] += 1
            q = content_svc.find(content.get("kuis", {}).get("bank", []), missed.most_common(1)[0][0]) if missed else None
            times = "dua kali" if len(pcts) == 2 else f"{len(pcts)} kali"
            out.append({
                "kind": "gate", "phase": "kuis", "count": len(pcts), "at": fail_at[cid],
                "html": f"{first} gagal gerbang <b>Kuis</b> {ch.title if ch else ''} {times} ({', '.join(f'{p}%' for p in pcts[-2:])})",
                "pattern": f"soal “{_plain(q['t'])[:48]}” selalu salah" if q else "",
                "chapter_id": cid, "action": {"label": "Buka Perkuat mini", "kind": "mini"},
            })

    # hint rushing: ≥ 3 items where every hint was opened within 30 s of seeing the item
    per_item: dict[tuple[int, str], list[HintOpen]] = defaultdict(list)
    for h in db.scalars(select(HintOpen).where(HintOpen.user_id == learner.id, HintOpen.created_at >= now_ - timedelta(days=7))):
        per_item[(h.chapter_id, h.item_id)].append(h)
    rushed = []
    for key, hs in per_item.items():
        levels = {h.level for h in hs}
        if {3, 4, 5} <= levels and max(h.ms_since_shown for h in hs if h.level in (3, 4, 5)) < 30_000:
            rushed.append(max(_aware(h.created_at) for h in hs))
    if len(rushed) >= 3 and learner.assist_cap > 3:
        out.append({
            "kind": "hints", "phase": "perkuat", "count": len(rushed), "at": max(rushed),
            "html": f"{first} membuka semua petunjuk dalam &lt; 30 detik di {len(rushed)} soal terakhir",
            "pattern": "pola: melompat ke petunjuk", "action": {"label": "Batasi petunjuk ke L3", "kind": "cap", "value": 3},
        })

    # stalled in the current phase
    for p in db.scalars(select(ChapterProgress).where(ChapterProgress.user_id == learner.id, ChapterProgress.completed_at.is_(None))):
        since = _aware(p.updated_at)
        days = (now_ - since).days
        if days > STALL_DAYS:
            ch = db.get(Chapter, p.chapter_id)
            cur = unlock.current_phase(p.phases)
            where = unlock.PHASE_LABEL[cur]
            if cur == "pahami":
                st = db.scalar(select(PlayerState).where(PlayerState.user_id == learner.id, PlayerState.chapter_id == p.chapter_id, PlayerState.phase == "pahami"))
                if st and st.data.get("scene"):
                    where += f" · scene {st.data['scene']}"
            out.append({
                "kind": "stalled", "phase": cur, "count": days, "at": since,
                "html": f"{first} tidak maju dari <b>{where}</b> selama {days} hari",
                "pattern": f"terakhir aktif {_weekday(learner.last_active_at or since)}", "chapter_id": p.chapter_id,
                "action": {"label": "Kirim pengingat", "kind": "remind"},
            })

    # review requests
    for s in db.scalars(select(Submission).where(Submission.user_id == learner.id, Submission.status == "pending")):
        out.append({
            "kind": "review", "phase": "uji" if s.kind == "challenge" else "proyek", "count": 1, "at": _aware(s.created_at),
            "html": f"{first} minta review · {s.title.split('·')[-1].strip() if s.kind == 'challenge' else s.title}",
            "pattern": f"{s.tests_passed}/{s.tests_total} tes lulus", "submission_id": s.id,
            "action": {"label": "Review kode", "kind": "review"},
        })
    return out


def _weekday(dt: datetime) -> str:
    names = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"]
    return names[_aware(dt).astimezone(timezone(timedelta(hours=7))).weekday()]


def _plain(s: str) -> str:
    import re
    return re.sub(r"<[^>]+>", "", s or "")


def rank(signals: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Most in need of help first: severity, then the count, then recency."""
    return sorted(signals, key=lambda s: (-SEVERITY[s["kind"]], -s.get("count", 0), -s["at"].timestamp()))


def phase_funnel(db: Session, learner_ids: list[int], chapter_id: int) -> dict[str, Any]:
    counts = {p: 0 for p in unlock.PHASES}
    durations: dict[str, list[float]] = {p: [] for p in unlock.PHASES}
    now_ = datetime.now(timezone.utc)
    for p in db.scalars(select(ChapterProgress).where(ChapterProgress.chapter_id == chapter_id, ChapterProgress.user_id.in_(learner_ids))):
        if p.completed_at:
            continue
        cur = unlock.current_phase(p.phases)
        counts[cur] += 1
        durations[cur].append((now_ - _aware(p.phase_since)).total_seconds() / 86400)
    total = sum(counts.values())
    all_d = sorted(d for ds in durations.values() for d in ds)
    median = all_d[len(all_d) // 2] if all_d else 0
    pile = None
    for ph, n in counts.items():
        avg = sum(durations[ph]) / len(durations[ph]) if durations[ph] else 0
        if total and n / total > 0.4 and avg > median:
            pile = {"phase": ph, "count": n, "avg_days": round(avg, 1)}
    return {"counts": counts, "total": total, "pile": pile}


def hardest_concepts(db: Session, learner_ids: list[int], path_id: int, limit: int = 4) -> list[dict[str, Any]]:
    """First-try wrong % per concept across Perkuat, Kuis and Ulangan."""
    from ..models import Concept
    concept_names = {c.key: c.name for c in db.scalars(select(Concept).where(Concept.path_id == path_id))}
    cache: dict[int, dict[str, Any]] = {}
    tally: dict[str, list[int]] = defaultdict(lambda: [0, 0])
    for a in db.scalars(select(Attempt).where(Attempt.user_id.in_(learner_ids), Attempt.attempt_no == 1,
                                              Attempt.phase.in_(["perkuat", "kuis", "ulangan"]))):
        _, content = _ch_content(db, cache, a.chapter_id)
        for c in content_svc.item_concepts(content, a.phase, a.item_id):
            tally[c][1] += 1
            if not a.correct:
                tally[c][0] += 1
    rows = [{"key": k, "name": concept_names.get(k, k), "pct": round(100 * w / n)} for k, (w, n) in tally.items() if n >= 3]
    return sorted(rows, key=lambda r: -r["pct"])[:limit]


def wrong_patterns(db: Session, learner: User, limit: int = 5) -> list[dict[str, Any]]:
    """Wrong answers grouped per item, with identical repeats side by side and a one-line diagnosis."""
    cache: dict[int, dict[str, Any]] = {}
    groups: dict[tuple[str, int, str], list[Attempt]] = defaultdict(list)
    for a in db.scalars(select(Attempt).where(Attempt.user_id == learner.id, Attempt.correct.is_(False),
                                              Attempt.phase.in_(["perkuat", "kuis", "ulangan"])).order_by(Attempt.created_at)):
        groups[(a.phase, a.chapter_id, a.item_id)].append(a)
    out = []
    for (phase, cid, iid), atts in sorted(groups.items(), key=lambda kv: (-len(kv[1]), -kv[1][-1].id)):
        ch, content = _ch_content(db, cache, cid)
        pool = {"perkuat": content.get("perkuat", {}).get("items", []), "kuis": content.get("kuis", {}).get("bank", []),
                "ulangan": (content.get("ulangan") or {}).get("questions", [])}[phase]
        item = content_svc.find(pool, iid) or {}
        entry: dict[str, Any] = {"phase": phase, "chapter": ch.title if ch else "", "chapter_id": cid, "item_id": iid,
                                 "count": len(atts), "title": _plain(item.get("title") or item.get("t") or ""),
                                 "type": TYPE_LABEL.get(item.get("type", ""), "kuis" if phase == "kuis" else "ulangan"),
                                 "same": len({repr(a.answer) for a in atts}) == 1, "diagnosis": item.get("diagnosis", "")}
        if phase == "perkuat" and item.get("type") == "parsons":
            lines = {str(l["id"]): l["code"] for l in item.get("lines", [])}
            entry["correct_lines"] = [lines.get(str(i), "") for i in item.get("answer", [])]
            last = atts[-1].answer or []
            entry["wrong_lines"] = [{"code": lines.get(str(i), ""), "bad": str(i) != str(item.get("answer", [])[k]) if k < len(item.get("answer", [])) else True}
                                    for k, i in enumerate(last)]
        elif phase == "perkuat" and item.get("type") == "bug":
            entry["correct_lines"] = item.get("lines", [])
            entry["picked_line"] = atts[-1].answer
            entry["answer_line"] = item.get("answer")
        elif item.get("o"):
            ans = atts[-1].answer
            entry["picked"] = item["o"][ans] if isinstance(ans, int) and 0 <= ans < len(item["o"]) else None
            key = item.get("a", item.get("answer"))
            entry["answer"] = item["o"][key] if isinstance(key, int) else None
        out.append(entry)
        if len(out) >= limit:
            break
    return out
