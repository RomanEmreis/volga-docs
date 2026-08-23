# CI helpers

## `build-skill.py`

Packages `skill/volga/` as `docs/.vuepress/public/volga-skill.zip`, the archive
the [Agent Skill](../docs/en/agent-skill.md) page hands out. It runs from npm's
`predocs:build` / `predocs:dev` hooks, so any docs build ships an archive
matching the tree in git; the zip itself is generated, not committed.

```bash
python3 ci/build-skill.py
```

Entries are written in sorted order with a fixed timestamp, so rebuilding an
unchanged tree produces a byte-identical archive. The `volga/` prefix is kept
deliberately — the directory name has to match the skill's `name`, so
unzipping must produce `volga/` rather than loose files.

## `check-snippets.py`

Compiles the Rust snippets on the site against the published `volga` crates, so
an example that drifted out of the API is caught here rather than by a reader.
Run it the way CI does:

```bash
python3 ci/check-snippets.py
```

It scans both locales — the code in `docs/en` and `docs/ru` is meant to be
identical, and a translation that drifted is exactly what this catches.

### Marking a snippet

Only marked blocks are checked, because plenty of snippets on the site lean on
illustrative helpers that do not exist. Mark a block once it is self-contained,
by adding a word to the fence's info string (VuePress ignores it and renders
nothing):

````markdown
```rust compile
use volga::{App, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();
    app.map_get("/hello", || async { ok!("Hello, World!") });
    app.run().await
}
```
````

| Marker | For |
|---|---|
| `compile` | a complete set of items; `fn main() {}` is appended when the block has none |
| `compile-fragment` | statements meant to sit in a `main`; wrapped in an async fn that opens with `let mut app = App::new();`, with `use volga::*;` injected |
| `features="..."` | the `volga` features to compile against — default `full`, so name this only for what sits outside it (`features="full jwt-derive"`) |
| `skip` | opt a block out |

The same words work in an HTML comment on the line above the fence, which wins
over the info string:

```markdown
<!-- snippet: compile-fragment -->
```

### Adding a snippet that will not compile

Leave it unmarked. That is the honest signal for a block showing a shape rather
than a program — a trait impl with elided bodies, a call into a handler the
page never defines. Keep the fence plain and the checker skips it.

### Options

```
--docs-dir DIR            tree to scan (default: docs)
--default-mode MODE       mode for unmarked blocks: none | compile | compile-fragment
--default-features FEAT   features for blocks naming none
--keep                    keep the scratch crates for inspection
```

`--default-mode compile` is how the current markers were chosen: run it, and
every block that compiles unmarked is a candidate for a marker.

### The Agent Skill

`skill/` is read by a model rather than rendered, so its markdown carries no
info-string markers and the default is inverted instead — most of its blocks
are statement fragments:

```bash
python3 ci/check-snippets.py \
  --docs-dir skill \
  --default-mode compile-fragment \
  --default-features "full auth-full macros dev-cert test"
```

CI runs exactly that. A block that cannot be self-contained — one showing a
shape rather than a program — opts out with the HTML comment on the line
above it:

```markdown
<!-- snippet: skip -->
```

The extra features are the ones `full` leaves out but the skill documents:
`auth-full` for `#[derive(Claims)]`, `macros` for `#[http_header]`,
`dev-cert` for the development certificate helper, and `test` for
`TestServer`.

`VOLGA_VERSION` (default `0.9`) selects the version the snippets are compiled
against.
