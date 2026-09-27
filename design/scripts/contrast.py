#!/usr/bin/env python3
"""WCAG contrast check for GNOSIA token pairs. Run: python3 scripts/contrast.py"""
import re, sys, pathlib

css = (pathlib.Path(__file__).parent.parent / "tokens.css").read_text()

def block(selector):
    m = re.search(r"(?m)^" + re.escape(selector) + r"[^{]*\{(.*?)\n\}", css, re.S)
    return dict(re.findall(r"--([\w-]+):\s*(#[0-9A-Fa-f]{6})", m.group(1)))

def lum(h):
    c = [int(h[i:i+2], 16) / 255 for i in (1, 3, 5)]
    c = [x / 12.92 if x <= 0.03928 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]

def ratio(a, b):
    la, lb = sorted([lum(a), lum(b)], reverse=True)
    return (la + 0.05) / (lb + 0.05)

TEXT = 4.5
UI = 3.0
PAIRS = [
    ("text", "bg", TEXT), ("text", "surface", TEXT), ("text", "surface-sunken", TEXT),
    ("text-muted", "bg", TEXT), ("text-muted", "surface", TEXT), ("text-muted", "surface-sunken", TEXT),
    ("text-faint", "surface", UI), ("text-faint", "bg", UI),
    ("accent", "surface", TEXT), ("accent", "bg", TEXT), ("accent", "accent-soft", TEXT),
    ("on-accent", "accent", TEXT),
    ("success", "surface", TEXT), ("success", "success-soft", TEXT),
    ("warning", "surface", TEXT), ("warning", "warning-soft", TEXT),
    ("danger", "surface", TEXT), ("danger", "danger-soft", TEXT),
    ("border-strong", "surface", 1.4),
    ("syn-keyword", "editor-bg", TEXT), ("syn-string", "editor-bg", TEXT), ("syn-number", "editor-bg", TEXT),
    ("syn-function", "editor-bg", TEXT), ("syn-comment", "editor-bg", UI), ("syn-text", "editor-bg", TEXT),
    ("syn-property", "editor-bg", TEXT), ("text-faint", "editor-bg", UI),
]
for ph in ("pahami", "perkuat", "kuis", "uji"):
    PAIRS += [(f"{ph}-ink", "surface", TEXT), (f"{ph}-ink", f"{ph}-soft", TEXT), (f"{ph}-ink", "bg", TEXT),
              (f"{ph}-fill", "surface", UI), (f"{ph}-fill", "bg", UI)]

fail = 0
for name, sel in [("Paper", ":root"), ("Ink", ':root[data-theme="ink"]')]:
    t = block(sel)
    print(f"\n{name}")
    for fg, bg, need in PAIRS:
        r = ratio(t[fg], t[bg])
        ok = r >= need
        fail += not ok
        print(f"  {'ok ' if ok else 'FAIL'} {fg:14} on {bg:15} {r:5.2f}  (need {need})")
sys.exit(1 if fail else 0)
