"""Rule-based diagnostics: turns a deterministic error (L1) into a plain-language
explanation (L2) and, where it is safe, a one-click fix. Never a chatbot
(CONCEPT §4). Unknown errors return `available: False` so the UI shows
"Penjelasan belum tersedia" while the raw error (L1) stays visible.
"""
from __future__ import annotations

import html
import re
from typing import Any

KEYWORDS = {"let", "const", "var", "function", "return", "if", "else", "for", "while", "of", "in", "new", "typeof",
            "true", "false", "null", "undefined", "class", "console", "Math", "JSON", "log"}
CONSOLE_METHODS = ["log", "error", "warn"]


def _m(s: str) -> str:
    return f'<span class="t-mono">{html.escape(s)}</span>'


def levenshtein(a: str, b: str) -> int:
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def declared_names(code: str) -> list[str]:
    names = re.findall(r"\b(?:let|const|var|function)\s+([A-Za-z_$][\w$]*)", code)
    names += re.findall(r"\bfor\s*\(\s*(?:let|const|var)\s+([A-Za-z_$][\w$]*)", code)
    seen: list[str] = []
    for n in names:
        if n not in seen:
            seen.append(n)
    return seen


def nearest(name: str, candidates: list[str], max_dist: int = 2) -> str | None:
    best, best_d = None, max_dist + 1
    for c in candidates:
        d = levenshtein(name.lower(), c.lower())
        if d < best_d and c != name:
            best, best_d = c, d
    return best


def diagnose(code: str, error: dict[str, Any], scope_code: str = "", assist_cap: int = 6) -> dict[str, Any]:
    if assist_cap < 2:
        return {"available": False, "reason": "capped"}
    name, msg = error.get("name", ""), error.get("message", "")
    line = error.get("line")
    lines = code.split("\n")

    m = re.match(r"(\w[\w$]*) is not defined", msg)
    if name == "ReferenceError" and m:
        missing = m.group(1)
        guess = nearest(missing, declared_names(scope_code + "\n" + code))
        if guess:
            fixed = re.sub(rf"\b{re.escape(missing)}\b", guess, code)
            return {
                "available": True, "level": 2,
                "text": f"Variabel {_m(missing)} belum pernah dibuat, jadi JavaScript tidak tahu isinya. Mungkin maksudmu {_m(guess)}?",
                "fix": {"label": f"Perbaiki jadi {guess}", "code": fixed},
                "line": _find_line(lines, missing, line),
            }
        return {
            "available": True, "level": 2,
            "text": f"Variabel {_m(missing)} belum pernah dibuat. Buat dulu dengan {_m('let')} atau {_m('const')} sebelum dipakai.",
            "line": _find_line(lines, missing, line),
        }

    if name == "TypeError" and "constant variable" in msg:
        target = None
        consts = re.findall(r"\bconst\s+([A-Za-z_$][\w$]*)", code)
        bad = line
        if bad and 1 <= bad <= len(lines):
            mm = re.match(r"\s*([A-Za-z_$][\w$]*)\s*(?:[+\-*/]?=)(?!=)", lines[bad - 1])
            target = mm.group(1) if mm and mm.group(1) in consts else None
        target = target or (consts[0] if consts else None)
        out: dict[str, Any] = {
            "available": True, "level": 2,
            "text": f"Baris {bad or '?'} mengganti isi {_m(target or 'const')}, padahal kotak itu dibuat dengan {_m('const')} (digembok). "
                    f"Kalau nilainya memang perlu berubah, buat dengan {_m('let')}.",
            "line": bad,
        }
        if target:
            out["fix"] = {"label": f"Ubah jadi let {target}", "code": re.sub(rf"\bconst(\s+{re.escape(target)}\b)", r"let\1", code, count=1)}
        return out

    m = re.match(r"(.+?) is not a function", msg)
    if name == "TypeError" and m:
        what = m.group(1)
        method = what.split(".")[-1]
        guess = nearest(method, CONSOLE_METHODS) if what.startswith("console.") else None
        text = f"{_m(what)} bukan fungsi, jadi tidak bisa dipanggil dengan tanda kurung."
        out = {"available": True, "level": 2, "text": text + (f" Mungkin maksudmu {_m('console.' + guess)}?" if guess else " Cek lagi ejaannya."), "line": line}
        if guess:
            out["fix"] = {"label": f"Perbaiki jadi console.{guess}", "code": re.sub(rf"console\.{re.escape(method)}\b", f"console.{guess}", code)}
        return out

    if name == "TypeError" and "Cannot read properties of undefined" in msg:
        return {"available": True, "level": 2, "line": line,
                "text": f"Kamu mengambil isi dari sesuatu yang masih {_m('undefined')}. Pastikan variabelnya sudah diberi nilai sebelum dipakai."}

    if name == "SyntaxError":
        if "missing ) after argument list" in msg:
            text = f"Ada kurung {_m('(')} yang belum ditutup, atau tanda koma/kutip yang hilang di dalamnya."
        elif "Invalid or unexpected token" in msg:
            text = f"Ada teks yang tidak dikenali. Biasanya tanda kutip {_m(chr(34))} yang belum ditutup."
        elif "Unexpected end of input" in msg:
            text = f"Program berhenti di tengah jalan. Mungkin ada {_m('{')} atau {_m('(')} yang belum ditutup."
        elif "Unexpected identifier" in msg or "Unexpected token" in msg:
            text = "JavaScript menemukan sesuatu di tempat yang tidak ia duga. Cek urutan kata di baris itu, misalnya kata kunci, nama, lalu tanda =."
        elif "has already been declared" in msg:
            nm = re.match(r"Identifier '(.+)' has already been declared", msg)
            text = f"Variabel {_m(nm.group(1) if nm else '?')} dibuat dua kali. Untuk mengganti isinya, tulis tanpa {_m('let')}/{_m('const')}."
        else:
            return {"available": False, "reason": "unknown"}
        return {"available": True, "level": 2, "text": text, "line": line}

    if name == "TimeoutError":
        return {"available": True, "level": 2, "line": None,
                "text": "Programmu tidak berhenti. Biasanya karena perulangan yang syaratnya selalu benar. Cek variabel yang seharusnya berubah di dalam loop."}

    return {"available": False, "reason": "unknown"}


def _find_line(lines: list[str], token: str, fallback: int | None) -> int | None:
    for i, l in enumerate(lines, 1):
        if re.search(rf"\b{re.escape(token)}\b", l) and not l.strip().startswith("//"):
            return i
    return fallback
