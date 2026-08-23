# Agent Skill

A packaged [Agent Skill](https://agentskills.io/specification) that teaches a
coding assistant to write Volga correctly — the same material as this site,
reorganised for a model rather than a reader.

<SkillDownload href="/volga-skill.zip" label="Download volga-skill.zip" note="~31 KiB · MIT · tracks volga 0.9.8" />

Source: [`skill/volga`](https://github.com/RomanEmreis/volga-docs/tree/main/skill/volga).

## Why you might want it

Assistants are confidently wrong about Volga, and for a specific reason: the
0.9 line changed security defaults and removed a family of helper methods,
while most Volga code a model has seen predates it. So the failure mode is
not a forgotten method name. It is an assistant writing
`ok!("hi", [("x-key", "v")])` with a comma instead of a semicolon, reaching
for `with_default_cors()`, calling `use_cors()` on an app that never
configured CORS, or shipping a bearer-auth setup that answers `400` to every
request once it sits behind a TLS-terminating proxy.

The skill front-loads exactly those traps, then routes to detail on demand.

## What is in it

| File | Covers |
|---|---|
| `SKILL.md` | Establishing the version and features, the non-negotiables, a minimal app, routing |
| `references/routing.md` | Routes, groups, path/query params, JSON, forms, files, multipart, headers, cookies |
| `references/responses.md` | Response macros, `IntoResponse`, status codes, streaming, errors, Problem Details |
| `references/middleware.md` | `with` / `wrap` / `attach` / `filter` / `tap_req` / `map_ok`, CORS, compression, static files, rate limiting |
| `references/di-config.md` | DI lifetimes, `Inject`, factories, configuration files, hot reload |
| `references/security.md` | Basic auth, JWT, authorizers, OAuth 2.1 / OIDC, the client crate, TLS, HSTS |
| `references/realtime.md` | WebSockets, WebSocket-over-HTTP/2, Server-Sent Events |
| `references/operations.md` | Feature flags, graceful shutdown, cancellation, tracing, OpenAPI, `TestServer` |
| `references/migration.md` | Symptom → cause, and the 0.8.x → 0.9.x upgrade path |

`SKILL.md` stays short on purpose: an entrypoint an agent always reads, and
eight references it loads only when the task needs one.

## Install

The SKILL.md format is a shared standard, so installation is the same
everywhere: unzip and **copy the `volga/` directory into the tool's skills
folder**, keeping the folder name — it has to match the `name` in the
frontmatter.

| Tool | Personal | Per project |
|---|---|---|
| Claude Code | `~/.claude/skills/volga/` | `.claude/skills/volga/` |
| opencode | `~/.config/opencode/skills/volga/` | `.opencode/skills/volga/` |
| Codex CLI | `~/.codex/skills/volga/` | `.codex/skills/volga/` |

```bash
unzip volga-skill.zip
mkdir -p ~/.claude/skills && cp -r volga ~/.claude/skills/
```

Restart the assistant afterwards — skills are discovered at startup.

opencode also reads `.claude/skills/` and `.agents/skills/`, so a single copy
inside a project can serve more than one tool.

### Anything else

Any assistant that can read a file will do. Point it at `SKILL.md` and let it
follow the links, or add a line to the project's `AGENTS.md`:

```markdown
For Rust web work with the `volga` crate, read
`.agents/skills/volga/SKILL.md` and the reference file it routes you to.
```

## What it front-loads

The whole point of shipping a skill rather than a prose summary is the list
of things a model gets wrong on its own. A sample of what `SKILL.md` puts
before anything else:

* **Custom headers come after a semicolon.** `ok!("Hello"; [("x-key", "v")])`.
  A comma matches the `format!` arm and fails to compile.
* **`with_*` consumes the `App`, `map_*` borrows it.** Configuration is
  chained first; routing needs `let mut app`.
* **`require_https` and `strip_token_from_request` default to on** for bearer
  authentication — the reason a working local setup returns `400` behind a
  reverse proxy.
* **`with_aud` makes `aud` a required claim** unless `without_strict_aud()`
  says otherwise.
* **`with_default_cors()` and `with_default_tracing()` are gone**, and the
  on/off builders (`with_credentials`, `with_preload`, …) no longer take a
  `bool`.
* **`Path<T>` is a tuple, `NamedPath<T>` is the named struct**, and neither
  may be mixed with positional path parameters in one handler.
* **`full` is not everything** — `#[derive(Claims)]`, `#[http_header]`,
  development certificates and `TestServer` each need a feature `full` does
  not include.

## The code in it compiles

The Rust in the skill is compiled against the published `volga` crates in this
repository's CI, on the same job that checks the snippets on this site — so
what an assistant copies out of it builds. Blocks that show a shape rather
than a program (a signature, a trait impl with elided bodies) opt out
explicitly.

Run the same check yourself after editing:

```bash
python3 ci/check-snippets.py --docs-dir skill --default-mode compile-fragment --default-features "full auth-full macros dev-cert test"
```

## Version

The skill tracks volga **0.9.8** on MSRV **1.90**. The frontmatter records
both, so an assistant can tell whether the skill matches the crate in front
of it:

```yaml
metadata:
  volga-version: "0.9.8"
  msrv: "1.90"
```
