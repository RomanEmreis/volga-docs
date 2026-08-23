# volga — Agent Skill

A model-neutral [Agent Skill](https://agentskills.io/specification) for
building HTTP services in Rust with the
[volga](https://github.com/RomanEmreis/volga) web framework.

Covers volga **0.9.8** (MSRV 1.90, edition 2024).

```
volga/
├── SKILL.md                    the entrypoint the agent loads
└── references/
    ├── routing.md              routes, groups, extractors, bodies, raw body, headers, cookies
    ├── responses.md            response macros, IntoResponse, errors, Problem Details
    ├── middleware.md           with/wrap/attach/filter, CORS, compression, static files, rate limiting
    ├── di-config.md            dependency injection lifetimes, configuration files, hot reload
    ├── security.md             Basic auth, JWT, authorizers, OAuth 2.1/OIDC, DPoP, m2m grants, TLS
    ├── realtime.md             WebSockets, WebSocket-over-HTTP/2, Server-Sent Events
    ├── operations.md           feature flags, shutdown, cancellation, tracing, OpenAPI, testing
    └── migration.md            symptom → cause, and the 0.8.x → 0.9.x upgrade
```

`SKILL.md` is deliberately short: it establishes the version and feature
set, lists the traps that make pre-0.9 volga code fail, and routes to one
reference file. The agent loads the rest only when the task calls for it.

## Install

The format is the open SKILL.md standard, so installation is the same
everywhere: **copy the `volga/` directory into the tool's skills folder**,
keeping the folder name `volga` — it has to match the `name` in the
frontmatter.

| Tool | Personal | Per project |
|---|---|---|
| Claude Code | `~/.claude/skills/volga/` | `.claude/skills/volga/` |
| opencode | `~/.config/opencode/skills/volga/` | `.opencode/skills/volga/` |
| Codex CLI | `~/.codex/skills/volga/` | `.codex/skills/volga/` |

```bash
# example: install for Claude Code, for the current project
mkdir -p .claude/skills
cp -r volga .claude/skills/
```

Restart the agent afterwards — skills are discovered at startup.

opencode also reads `.claude/skills/` and `.agents/skills/`, so one copy in
a project can serve several tools.

### Anything else

Any assistant that can read a file will use this: point it at `SKILL.md`
and let it follow the links, or add a line to the project's `AGENTS.md`:

```markdown
For Rust web work with the `volga` crate, read
`.agents/skills/volga/SKILL.md` and the reference file it routes you to.
```

## Licence

MIT, same as volga. Documentation:
<https://romanemreis.github.io/volga-docs/>
