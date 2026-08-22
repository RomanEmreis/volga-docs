#!/usr/bin/env python3
"""Compile the Rust snippets in docs/ that are marked for checking.

VuePress ignores unknown words in a code fence's info string and does not
render them, so the marker lives there:

    ```rust compile
    ```rust compile-fragment
    ```rust compile features="full jwt-derive"

An HTML comment on the line above a fence does the same and wins over the
info string - useful where the fence already carries VuePress attributes:

    <!-- snippet: compile -->
    <!-- snippet: compile-fragment -->
    <!-- snippet: features="full dev-cert" -->
    <!-- snippet: skip -->

Only marked blocks are checked. This is deliberate: plenty of snippets on the
site reference illustrative helpers that do not exist (`long_running_task()`,
`my_handler`, a `MyStore` with elided bodies, ...), and stubbing those
generically would cost more than it catches. Mark a block once you have made
it self-contained.

Both locales are scanned, so a snippet is checked in `docs/en` and in
`docs/ru` alike - the code in the two is meant to be identical, and a
translation that drifted is exactly what this catches.

Modes
-----
compile
    The block is a complete set of items. Compiled as-is; `fn main() {}` is
    appended when the block has no `fn main` of its own.

compile-fragment
    The block is a run of statements meant to sit in a `main`. The `use`
    lines are hoisted to file scope and the rest is wrapped in

        async fn __snippet() -> Result<(), Box<dyn std::error::Error>>

    which opens with `let mut app = App::new();` and closes with `Ok(())`,
    so fragments may use `app`, `?` and `await`. `use volga::*;` is injected,
    since a fragment inherits the imports of the page around it.

Features
--------
The feature set is `volga`'s. The default is `full`, which is what most of
the site is written against; a page needing something outside it - the
derive macros, the development certificate helper - names it per block:

    ```rust compile features="full jwt-derive"

Snippets that need different feature sets are compiled in separate crates,
since Cargo unifies features across a workspace.

Usage: python3 ci/check-snippets.py [--docs-dir docs] [--keep]
                                    [--default-mode {none,compile,compile-fragment}]
                                    [--default-features FEATURES]
Env:   VOLGA_VERSION (default "0.9")
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

FENCE = re.compile(r"^```rust([^\n]*)\n(.*?)^```", re.S | re.M)
# An optional directive on the line immediately above a fence. Wins over the
# info string, and is how a block opts out of a tree checked by default.
DIRECTIVE = re.compile(r"<!--\s*snippet:([^>]*?)-->\s*\n\Z", re.S)
VOLGA_VERSION = os.environ.get("VOLGA_VERSION", "0.9")
DEFAULT_FEATURES = "full"

FRAGMENT_HEAD = (
    "#[allow(unused, unused_imports)]\n"
    "use volga::*;\n\n"
    "#[allow(unused, deprecated)]\n"
    "async fn __snippet() -> Result<(), Box<dyn std::error::Error>> {\n"
    "    let mut app = App::new();\n"
)
FRAGMENT_TAIL = "    Ok(())\n}\nfn main() {}\n"


def parse_meta(meta: str) -> tuple[str | None, str | None]:
    """Return (mode, features) from a fence info string or a directive body."""
    mode = None
    for candidate in ("compile-fragment", "compile", "skip"):
        if re.search(rf"(^|\s){re.escape(candidate)}(\s|$)", meta):
            mode = candidate
            break
    features = None
    m = re.search(r'features="([^"]+)"', meta)
    if m:
        features = m.group(1)
    return mode, features


def directive_before(text: str, start: int) -> tuple[str | None, str | None]:
    """Read a `<!-- snippet: ... -->` sitting directly above the fence."""
    m = DIRECTIVE.search(text, 0, start)
    return parse_meta(m.group(1)) if m else (None, None)


def render(mode: str, body: str) -> str:
    if mode == "compile":
        if re.search(r"^\s*(async\s+)?fn main\s*\(", body, re.M):
            return body
        return body + "\nfn main() {}\n"
    uses, rest = [], []
    for line in body.splitlines():
        (uses if line.startswith("use ") else rest).append(line)
    indented = "\n".join(("    " + l) if l.strip() else l for l in rest)
    return "\n".join(uses) + "\n" + FRAGMENT_HEAD + indented + "\n" + FRAGMENT_TAIL


def collect(
    docs_dir: Path,
    fallback_mode: str = "none",
    fallback_features: str | None = None,
) -> list[dict]:
    snippets = []
    for md in sorted(docs_dir.rglob("*.md")):
        text = md.read_text(encoding="utf-8")
        for idx, m in enumerate(FENCE.finditer(text)):
            mode, features = parse_meta(m.group(1))
            d_mode, d_features = directive_before(text, m.start())
            mode = d_mode or mode or (fallback_mode if fallback_mode != "none" else None)
            if mode is None or mode == "skip":
                continue
            line = text.count("\n", 0, m.start()) + 1
            # the whole relative path, not just the stem: two pages sharing a
            # file name in different sections would otherwise write the same
            # bin and one of them would go unchecked without a word
            page = md.relative_to(docs_dir).with_suffix("").as_posix()
            slug = re.sub(r"[^a-z0-9]+", "_", page.lower())
            snippets.append(
                {
                    "name": f"{slug}_{idx}",
                    "origin": f"{md}:{line}",
                    "features": d_features
                    or features
                    or fallback_features
                    or DEFAULT_FEATURES,
                    "source": render(mode, m.group(2)),
                }
            )
    return snippets


def write_crate(crate: Path, features: str, group: list[dict]) -> None:
    (crate / "src" / "bin").mkdir(parents=True)
    feature_list = ", ".join(f'"{f}"' for f in features.split())
    (crate / "Cargo.toml").write_text(
        "[package]\n"
        'name = "snippets"\n'
        'version = "0.0.0"\n'
        'edition = "2024"\n\n'
        "[dependencies]\n"
        f'volga = {{ version = "{VOLGA_VERSION}", features = [{feature_list}] }}\n'
        f'volga-oauth-client = {{ version = "{VOLGA_VERSION}", '
        'features = ["http1", "dpop", "private-key-jwt"] }\n'
        f'volga-oauth-core = "{VOLGA_VERSION}"\n'
        'tokio = { version = "1", features = ["full"] }\n'
        'serde = { version = "1", features = ["derive"] }\n'
        'serde_json = "1"\n'
        'bytes = "1"\n'
        'cookie = "0.18"\n'
        'futures-util = "0.3"\n'
        'http = "1"\n'
        'http-body-util = "0.1"\n'
        'tracing = "0.1"\n'
        'tracing-subscriber = "0.3"\n\n'
        # detach from any enclosing workspace
        "[workspace]\n",
        encoding="utf-8",
    )
    for s in group:
        (crate / "src" / "bin" / f"{s['name']}.rs").write_text(
            f"// from {s['origin']}\n{s['source']}", encoding="utf-8"
        )

    # a snippet that never reached the crate is a snippet nobody checked, and
    # a silent pass is worse than no check at all
    written = len(list((crate / "src" / "bin").glob("*.rs")))
    if written != len(group):
        raise SystemExit(
            f"internal error: {len(group)} snippet(s) collected but {written} "
            f"file(s) written for features = {features}"
        )


def build(crate: Path) -> tuple[bool, set[str], str]:
    """Compile every snippet in `crate`, reporting the files that failed.

    `--keep-going` is what makes a run report *all* the broken snippets
    rather than whichever one the scheduler reached first.
    """
    proc = subprocess.run(
        [
            "cargo",
            "build",
            "--keep-going",
            "--message-format=json",
            "--manifest-path",
            str(crate / "Cargo.toml"),
        ],
        capture_output=True,
        text=True,
    )

    broken: set[str] = set()
    for line in proc.stdout.splitlines():
        try:
            message = json.loads(line)
        except json.JSONDecodeError:
            continue
        if message.get("reason") != "compiler-message":
            continue
        diagnostic = message.get("message", {})
        if diagnostic.get("level") != "error":
            continue
        for span in diagnostic.get("spans", []):
            name = Path(span.get("file_name", "")).name
            if name.endswith(".rs"):
                broken.add(name[: -len(".rs")])

    return proc.returncode == 0, broken, proc.stderr


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--docs-dir", default="docs", type=Path)
    ap.add_argument("--keep", action="store_true", help="keep the scratch crates")
    ap.add_argument(
        "--default-mode",
        default="none",
        choices=("none", "compile", "compile-fragment"),
        help="mode for blocks carrying no marker (default: skip them)",
    )
    ap.add_argument(
        "--default-features",
        default=None,
        help=f"features for blocks naming none (default: {DEFAULT_FEATURES})",
    )
    args = ap.parse_args()

    snippets = collect(args.docs_dir, args.default_mode, args.default_features)
    if not snippets:
        print("no snippets marked for compilation - nothing to check")
        return 0

    by_features: dict[str, list[dict]] = {}
    for s in snippets:
        by_features.setdefault(s["features"], []).append(s)

    print(f"checking {len(snippets)} snippet(s) in {len(by_features)} crate(s)\n")
    root = Path(tempfile.mkdtemp(prefix="volga-snippets-"))
    failed: list[dict] = []

    try:
        for features, group in sorted(by_features.items()):
            crate = root / re.sub(r"[^a-z0-9]+", "_", features)
            write_crate(crate, features, group)
            print(f"  [{features}] {len(group)} snippet(s)")

            ok, broken, stderr = build(crate)
            if ok:
                continue

            named = [s for s in group if s["name"] in broken]
            # an error carrying no usable span (a link failure, a bad
            # manifest) belongs to the crate rather than to one snippet
            failed.extend(named or group)
            print(f"\n--- FAILED: features = {features} ---")
            for s in named:
                print(f"  {s['origin']}")
            print(stderr)
    finally:
        if args.keep:
            print(f"\nscratch crates kept at {root}")
        else:
            shutil.rmtree(root, ignore_errors=True)

    if failed:
        print(f"\nFAIL - {len(failed)} snippet(s) did not compile:")
        for s in failed:
            print(f"  {s['origin']}")
        return 1
    print(f"\nOK - all {len(snippets)} snippet(s) compiled")
    return 0


if __name__ == "__main__":
    sys.exit(main())
