# Contributing to the Volga docs

These rules keep the site in a shape that survives new Volga releases without a rewrite. Most of them come from the November 2026 review that restructured it. `ci/check-docs.py` and `ci/check-snippets.py` check the ones a script can check; the rest are on you and your reviewer.

The Russian locale has its own glossary and style rules in [TRANSLATING.md](TRANSLATING.md).

## Who the docs are for

A reader who has built HTTP services in C#, Java, Go or another stack, and may be new to Rust.

* **Do not teach Rust.** Where an example needs a language feature (a trait, `Result`, a pattern, `Option`), name it in a sentence and link the [Rust Book](https://doc.rust-lang.org/book/).
* **Map to what they know** when there is a clear counterpart: `add_singleton` is `AddSingleton`, `map_problem()` is `AddProblemDetails()`, `TestServer` is `WebApplicationFactory`. A new concept with a counterpart also gets a row in the table on [Coming from ASP.NET Core, Spring or Go](docs/en/getting-started/coming-from.md).
* **Lead with code that runs.** A page opens with what the feature does and a minimal complete example, then the details.

## Where a change goes

| Section | What it holds | Shape |
|---|---|---|
| Getting Started | The path a newcomer reads in order: first app, features, handlers, responses, extractors, routing, DI | Guide |
| Tutorial | One service built over four chapters | One growing `src/main.rs`, see [The tutorial](#the-tutorial) |
| Requests & Responses, Middleware & Infrastructure, Security & Access, Reliability & Observability, Protocols & Realtime | One feature per page | Guide |
| Advanced Patterns | What most apps never need: custom extractors, blocking work, tracing internals | Guide |
| Reference | Exact rules: routing precedence, handler generics | Reference |
| Reference / Migration | What changes on upgrade, newest release first | Migration |
| Agent Skill (`skill/volga`) | The same material, written for a coding agent | See [The Agent Skill](#the-agent-skill) |

**A guide** follows this order:

1. One paragraph: what the feature does and when you need it.
2. The Cargo feature it needs, if it is not in the default build.
3. A minimal complete example, marked `rust compile`.
4. Details, one `##` section per question a reader will ask.
5. Pitfalls, as `::: warning` blocks next to the detail they belong to.
6. Links to the reference page, docs.rs and the full example in the volga repo.

**A reference page** states rules, each with the smallest example that shows it. A guide links to it instead of repeating it.

## Versions

The guides describe the current release only. A reader should never need to know which version introduced something.

* **No version history in guides.** Do not write "Since 0.13", "Upgrading from", "Before 0.15" or their Russian equivalents ("Начиная с 0.13", "до версии 0.15"). `check-docs.py` fails on them. Describe how it works now.
* **Every change a user has to act on goes to [Migration](docs/en/reference/migration.md)**, in a `## 0.x.y` section at the top, under one of two headings:
  * **Does not compile:** the compiler finds every place. Name the fix.
  * **Compiles, answers differently:** nothing flags these, so say what to search for.
* **One version everywhere.** Every `volga*` dependency in a `Cargo.toml` snippet names the current minor release (`"0.15"`, not `"0.15.1"`), and so do CI and the Migration intro. `check-docs.py` fails on any other.
* **Deprecated APIs leave the guides** in the release that deprecates them. The old name appears only on the Migration page.

The Migration page and the Agent Skill page are about versions, so these rules do not apply to them. Neither do the skill's reference files, whose "Since 0.x" notes help an agent upgrade old code.

## Code snippets

* **Mark every Rust block that can compile.** `rust compile` for a complete program, `rust compile-fragment` for statements that run inside `main` after `let mut app = App::new();`. A block needing more than `full` names its features: `rust compile features="full test"`. See [ci/README.md](ci/README.md#marking-a-snippet).
* **Leave a block unmarked only when it shows a shape, not a program**, such as a trait impl with elided bodies.
* **The code is the same in both locales**, character for character. Translate comments only if the English comment would confuse; usually leave them.
* **Prefer a complete program over a fragment** on a page a reader may copy from.
* **The home page examples are not checked.** They live as strings in `docs/{en,ru}/README.md` for the `CodeShowcase` component. Compile each one in a scratch project before changing it, and keep them identical in both locales.
* **A `#[cfg(test)]` module or a `#[tokio::test]` function is not compiled** by `check-snippets.py`, which runs `cargo build`. Run such code with `cargo test` in a scratch project before you publish it.

## Both locales

* **Every page exists in `docs/en` and `docs/ru`.** `check-docs.py` fails on a page without its pair.
* **A new page is translated line for line**, so that the two files have the same number of lines and a later edit can be mirrored by line.
* **Terms and style** come from [TRANSLATING.md](TRANSLATING.md). In prose the framework is «Волга», a trait is «типаж», a Cargo feature is «фича», and established English terms (Problem Details, Rate Limiting, middleware) stay in English.

## Links, headings and the sidebar

* **Link with absolute paths:** `/volga-docs/en/getting-started/handlers.html`, with the locale in the path.
* **A new page goes into the sidebar** in `docs/.vuepress/config.js`, in both locales.
* **Renaming a heading breaks its anchor.** Search for links to the old anchor. Russian anchors are built from the heading text, with `й` and `ё` turned into `и` and `е`.
* **Do not move a published page** without a reason. If you must, keep the URL: a page can appear in another sidebar section through an absolute link, as Dependency Injection does in Getting Started.

## The tutorial

The [tutorial](docs/en/tutorial/overview.md) builds one bookmarks service. Each chapter shows its new code in pieces and ends with the whole `src/main.rs` in a `::: details` block.

* **The full listings are the source of truth.** The pieces in the text are copied from them, line for line.
* **Each chapter's listing must compile** (`check-snippets.py` checks it), and the last chapter's listing must pass `cargo test`. Copy it into a scratch project with the dev-dependencies from the Testing chapter and run the tests.
* **Outputs shown in the text** (curl responses, test output) are captured from the running service, not written by hand. If an API change alters them, capture them again.

## The Agent Skill

`skill/volga` is a second, denser form of the same material. When an API changes, update it in the same pull request as the guide.

* `SKILL.md` names the release it describes in `volga-version`, and the Agent Skill page says the same in its download note. `check-docs.py` checks that they agree.
* Its snippets are checked as fragments with extra features: see the command in [Checks before a pull request](#checks-before-a-pull-request).
* Its `references/migration.md` gets the same upgrade notes as the site's Migration page.

## Checks before a pull request

```bash
npm run docs:build                 # the site builds
python3 ci/check-docs.py           # versions, version history, both locales
python3 ci/check-snippets.py       # Rust snippets on the site
python3 ci/check-snippets.py --docs-dir skill --default-mode compile-fragment \
    --default-features "full auth-full macros dev-cert test"   # the skill's snippets
```

CI runs all four on every pull request.

## When Volga releases

Do this for every release, in one pull request per release.

**Every release (0.x.y):**

1. Read the release's entry in the [CHANGELOG](https://github.com/RomanEmreis/volga/blob/main/CHANGELOG.md) and the merged pull requests behind it. Each volga pull request has a **Docs impact** section that says what the docs need.
2. For each user-visible change, find the pages it touches in `docs/` and `skill/` (search for the API names) and update them to describe the new behaviour, with no "since".
3. Add a `## 0.x.y` section to the top of the Migration page in both locales, and to `skill/volga/references/migration.md`, if anything needs a user's action.
4. A new feature goes to the page of its section, or to a new page if it is big enough; see [Where a change goes](#where-a-change-goes). A new Cargo feature also goes to [Feature Flags](docs/en/getting-started/features.md).
5. Set `volga-version` in `skill/volga/SKILL.md` and the version in the Agent Skill page's download note, in both locales.
6. Run the [checks](#checks-before-a-pull-request) and the tutorial's tests.

**A new minor release (0.x.0) also moves the version everywhere:**

```bash
OLD=0.15 NEW=0.16
grep -rlE "version = \"$OLD\"|volga[a-z-]* = \"$OLD\"" docs skill \
  | xargs sed -i -E "s/(version = |volga[a-z-]* = )\"$OLD\"/\1\"$NEW\"/g"
sed -i "s/VOLGA_VERSION: \"$OLD\"/VOLGA_VERSION: \"$NEW\"/" .github/workflows/ci.yml
sed -i "s/\"VOLGA_VERSION\", \"$OLD\"/\"VOLGA_VERSION\", \"$NEW\"/; s/default \"$OLD\"/default \"$NEW\"/" ci/check-snippets.py
sed -i "s/default \`$OLD\`/default \`$NEW\`/" ci/README.md
```

Then set the current release in the first paragraph of the Migration page (`**0.16**`) in both locales, and run `check-docs.py`: it lists any place the commands missed. Expect `check-snippets.py` to fail where the release broke an example; fixing those is the main work of a minor release.
