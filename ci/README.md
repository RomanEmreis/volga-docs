# CI helpers

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

`VOLGA_VERSION` (default `0.9`) selects the version the snippets are compiled
against.
