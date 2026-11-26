#!/usr/bin/env python3
"""Check the rules in CONTRIBUTING.md that a script can check.

1. One Volga version. Every `volga*` dependency written on the site or in the
   skill, the version CI compiles the snippets against, the default of
   `check-snippets.py`, the skill's `volga-version`, the version the Agent
   Skill page says it tracks and the current release named on the Migration
   page agree with `VOLGA_VERSION` in `.github/workflows/ci.yml`. A release
   bump that missed a file fails here.

2. No version history on the site outside its pages. Guides describe the
   current release; what changed and when lives on the Migration page and the
   Agent Skill page. A "Since 0.13" or "Upgrading from" in a guide fails here.
   The skill in `skill/` is exempt: its notes help an agent upgrade old code.

3. Both locales have the same pages. A page added to `docs/en` without its
   `docs/ru` translation (or the other way round) fails here.

Usage: python3 ci/check-docs.py
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
SKILL = ROOT / "skill"
CI_YML = ROOT / ".github" / "workflows" / "ci.yml"
SNIPPETS = ROOT / "ci" / "check-snippets.py"

# Pages whose subject is version history. Rule 2 skips them, and rule 1 skips
# them too, since an upgrade note may quote the version being left behind.
HISTORY_PAGES = {
    DOCS / "en" / "reference" / "migration.md",
    DOCS / "ru" / "reference" / "migration.md",
    DOCS / "en" / "agent-skill.md",
    DOCS / "ru" / "agent-skill.md",
    SKILL / "volga" / "references" / "migration.md",
}

# `volga = { version = "0.15", ... }`, `volga-oauth-client = "0.15"` and so on
DEPENDENCY = re.compile(r'^\s*(volga[\w-]*)\s*=\s*(?:\{[^}\n]*?version\s*=\s*)?"([^"]+)"', re.M)

HISTORY = [
    re.compile(p, re.I)
    for p in (
        r"\bsince (?:v|version )?0\.\d+",
        r"\bupgrading from\b",
        r"\b(?:before|prior to|as of|until|starting (?:with|from)) (?:v|version )?0\.\d+",
        r"\b(?:added|changed|removed|deprecated|introduced) in (?:v|version )?0\.\d+",
        r"(?:начиная )?с версии 0\.\d+",
        r"\bначиная с 0\.\d+",
        r"\bдо версии 0\.\d+",
        r"\b(?:добавлен[аоы]?|изменен[аоы]?|изменён|удален[аоы]?|удалён|появил(?:ся|ась|ось|ись)) в (?:версии )?0\.\d+",
    )
]


def minor(version: str) -> str:
    """`0.15.1` and `0.15` are both release line `0.15`."""
    return ".".join(version.split(".")[:2])


def expected_version() -> str:
    m = re.search(r'VOLGA_VERSION:\s*"([^"]+)"', CI_YML.read_text(encoding="utf-8"))
    if not m:
        raise SystemExit(f"{CI_YML.relative_to(ROOT)}: VOLGA_VERSION not found")
    return minor(m.group(1))


def markdown_files() -> list[Path]:
    return sorted([*DOCS.rglob("*.md"), *SKILL.rglob("*.md")])


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def check_versions(expected: str) -> list[str]:
    problems = []
    m = re.search(r'VOLGA_VERSION", "([^"]+)"', SNIPPETS.read_text(encoding="utf-8"))
    if not m or minor(m.group(1)) != expected:
        problems.append(
            f"{rel(SNIPPETS)}: default VOLGA_VERSION is "
            f"{m.group(1) if m else 'missing'}, expected {expected}"
        )
    skill_md = SKILL / "volga" / "SKILL.md"
    m = re.search(r'volga-version:\s*"([^"]+)"', skill_md.read_text(encoding="utf-8"))
    skill_version = m.group(1) if m else None
    if not skill_version or minor(skill_version) != expected:
        problems.append(f"{rel(skill_md)}: volga-version is {skill_version}, expected {expected}.x")
    for loc in ("en", "ru"):
        page = DOCS / loc / "agent-skill.md"
        m = re.search(r"(?:tracks|для) volga ([0-9.]+)", page.read_text(encoding="utf-8"))
        if not m or m.group(1) != skill_version:
            problems.append(
                f"{rel(page)}: tracks volga {m.group(1) if m else '(missing)'}, "
                f"SKILL.md says {skill_version}"
            )
        page = DOCS / loc / "reference" / "migration.md"
        m = re.search(r"\*\*([0-9]+\.[0-9]+)\*\*", page.read_text(encoding="utf-8"))
        if not m or m.group(1) != expected:
            problems.append(
                f"{rel(page)}: current release is {m.group(1) if m else '(missing)'}, expected {expected}"
            )
    for md in markdown_files():
        if md in HISTORY_PAGES:
            continue
        text = md.read_text(encoding="utf-8")
        for dep in DEPENDENCY.finditer(text):
            name, version = dep.groups()
            if minor(version) != expected:
                line = text.count("\n", 0, dep.start()) + 1
                problems.append(f"{rel(md)}:{line}: {name} = \"{version}\", expected {expected}")
    return problems


def check_history() -> list[str]:
    problems = []
    for md in sorted(DOCS.rglob("*.md")):
        if md in HISTORY_PAGES:
            continue
        in_code = False
        for n, line in enumerate(md.read_text(encoding="utf-8").splitlines(), 1):
            if line.lstrip().startswith(("```", "~~~")):
                in_code = not in_code
                continue
            if in_code:
                continue
            for pattern in HISTORY:
                m = pattern.search(line)
                if m:
                    problems.append(f"{rel(md)}:{n}: version history \"{m.group(0)}\"")
                    break
    return problems


def check_locales() -> list[str]:
    en = {p.relative_to(DOCS / "en") for p in (DOCS / "en").rglob("*.md")}
    ru = {p.relative_to(DOCS / "ru") for p in (DOCS / "ru").rglob("*.md")}
    return [f"docs/ru/{p.as_posix()}: missing (docs/en has it)" for p in sorted(en - ru)] + [
        f"docs/en/{p.as_posix()}: missing (docs/ru has it)" for p in sorted(ru - en)
    ]


def main() -> int:
    expected = expected_version()
    sections = [
        (f"One Volga version ({expected})", check_versions(expected)),
        ("No version history outside Migration", check_history()),
        ("Same pages in en and ru", check_locales()),
    ]
    failed = False
    for title, problems in sections:
        print(f"{'FAIL' if problems else 'ok  '}  {title}")
        for p in problems:
            print(f"      {p}")
        failed |= bool(problems)
    if failed:
        print("\nSee CONTRIBUTING.md for the rules behind these checks.")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
