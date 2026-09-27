#!/usr/bin/env python3
"""Regenerate tokens.json from tokens.css (single source of truth). Run: python3 scripts/build-tokens-json.py"""
import re, json, pathlib
root = pathlib.Path(__file__).parent.parent
css = (root / "tokens.css").read_text()

def block(sel):
    m = re.search(r"(?m)^" + re.escape(sel) + r"[^{]*\{(.*?)\n\}", css, re.S)
    return dict(re.findall(r"--([\w-]+):\s*([^;]+);", m.group(1)))

paper, ink = block(":root"), block(':root[data-theme="ink"]')
colorish = lambda k, v: v.strip().startswith(("#", "var(", "rgba", "0 ")) or k.startswith(("shadow",))
scale_prefix = ("font-", "fs-", "lh-", "fw-", "tracking-", "measure", "space-", "radius-", "control-", "rail-", "sidebar-", "topbar-", "contextbar-", "tabs-", "statusbar-", "panel-", "dur-", "ease-", "spring-", "z-")
out = {
    "$schema": "GNOSIA design tokens v2 — generated from tokens.css; do not edit by hand",
    "theme": {
        "paper": {k: v.strip() for k, v in paper.items() if not k.startswith(scale_prefix)},
        "ink": {k: v.strip() for k, v in ink.items() if not k.startswith(scale_prefix)},
    },
    "scale": {k: v.strip() for k, v in paper.items() if k.startswith(scale_prefix)},
    "phases": {
        ph: {t: {"paper": paper[f"{ph}-{t}"], "ink": ink[f"{ph}-{t}"]} for t in ("ink", "fill", "soft", "line")}
        for ph in ("pahami", "perkuat", "kuis", "uji")
    },
    "component": {
        "button.press.lip": "3px (color-mix of button bg 62% with black)",
        "choice.radius": "14px", "choice.border-bottom": "4px",
        "scene.radius": "var(--radius-2xl)", "scene.padding": "40px 44px (24px 20px on mobile)",
        "codecard.radius": "var(--radius-xl)", "codecard.font": "JetBrains Mono 14–15 / 1.75, ligatures off",
        "phase-ring.gap": "3.5% of circumference between arcs", "phase-ring.linecap": "round",
        "player-foot.min-height": "88px (76px mobile)",
        "nosi.sizes": {"sm": "40px", "md": "64px", "lg": "120px", "xl": "180px"},
    },
}
(root / "tokens.json").write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n")
print("tokens.json:", len(out["theme"]["paper"]), "paper,", len(out["theme"]["ink"]), "ink,", len(out["scale"]), "scale tokens")
