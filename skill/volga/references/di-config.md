# Dependency injection and configuration

## Dependency injection (feature `di`)

Three lifetimes, resolved by type. Everything registered must be `Send +
Sync + 'static`.

| Lifetime | Registration | Instance per |
|---|---|---|
| Singleton | `add_singleton(value)` | the whole application |
| Scoped | `add_scoped::<T>()`, `add_scoped_factory(f)`, `add_scoped_default::<T>()` | HTTP request |
| Transient | `add_transient::<T>()`, `add_transient_factory(f)`, `add_transient_default::<T>()` | every resolution |

### Singleton

The common case: a handle that is cheap to clone and internally shared.

```rust
use volga::{App, di::Dc, ok, not_found};
use std::{collections::HashMap, sync::{Arc, Mutex}};

#[derive(Clone, Default)]
struct Cache {
    inner: Arc<Mutex<HashMap<String, String>>>,
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();
    app.add_singleton(Cache::default());

    app.map_get("/users/{id}", |id: String, cache: Dc<Cache>| async move {
        let found = cache.inner.lock().unwrap().get(&id).cloned();
        match found {
            Some(name) => ok!(name),
            None => not_found!("user not found"),
        }
    });

    app.run().await
}
```

Hold a `std::sync::Mutex` across an `.await` and the future stops being
`Send` — the handler will not compile. Either drop the guard before
awaiting (as above, by cloning out of the map) or use
`tokio::sync::Mutex`.

### Scoped and transient

`add_scoped::<T>()` needs `T: Inject`, which is where a service declares its
own dependencies:

<!-- snippet: skip -->
```rust
use volga::di::{Container, Inject, error::Error};

impl Inject for Repo {
    // note: `&Container`, and `Error` lives at `volga::di::error::Error`
    fn inject(container: &Container) -> Result<Self, Error> {
        Ok(Self { cache: container.resolve::<Cache>()? })
    }
}

app.add_scoped::<Repo>();
```

Without dependencies, skip the trait:

<!-- snippet: skip -->
```rust
app.add_scoped_factory(|| Repo::new());     // any closure returning T
app.add_scoped_default::<Repo>();           // T: Default
```

A factory may itself take `Dc<T>` or `Container` arguments when it needs to
resolve something.

Transient works identically; the only difference is that a new instance is
built for **every** injection, not once per request.

### DI in middleware

<!-- snippet: skip -->
```rust
// `with` — extractor style, same as a handler
app.with(|cache: Dc<Cache>, next: Next| async move { next.await });

// `wrap` — resolve from the context
app.wrap(|ctx: HttpContext, next: NextFn| async move {
    let cache = ctx.resolve::<Cache>()?;          // needs T: Clone
    let shared = ctx.resolve_shared::<Cache>()?;  // gives Arc<T>
    next(ctx).await
});
```

`Dc<T>` also works in WebSocket handlers at every layer — see
`realtime.md`.

## Configuration files (feature `config`)

TOML or JSON, chosen by extension. Needs `serde` with `derive`.

```toml
# app_config.toml
[server]
host = "0.0.0.0"
port = 8080

[handler]
msg = "World"
```

```rust
use volga::{App, Config, ok};
use serde::Deserialize;

#[derive(Deserialize)]
struct HandlerConfig { msg: String }

let mut app = App::new().with_config(|cfg| cfg
    .with_file("app_config.toml")
    .bind_section::<HandlerConfig>("handler")
    .reload_on_change());

app.map_get("/hello", |cfg: Config<HandlerConfig>| async move {
    ok!(fmt: "Hello, {}!", cfg.msg)
});
```

Three ways to load:

* `with_default_config()` — discovers `app_config.toml` or
  `app_config.json` in the working directory. **Panics** if neither exists.
* `with_config(|cfg| ...)` — a builder; omitting `with_file` falls back to
  the same discovery.
* `set_config(ConfigBuilder::from_file("config/prod.toml") ...)` — build the
  builder separately.

`bind_section::<T>("key")` is required — a missing or malformed section
panics at startup. `bind_section_optional::<T>("key")` makes `Config<T>`
simply unavailable instead.

`Config<T>` costs one atomic load plus an `Arc::clone` per request; nothing
is deserialized at request time.

### Built-in sections

These are applied automatically and need no `bind_section`:

| Section | Feature | Fields |
|---|---|---|
| `[server]` | always | `host`, `port`, `body_limit_bytes`, `max_header_count`, `max_connections` |
| `[tls]` | `tls` | certificate and key paths, redirection, HSTS |
| `[tracing]` | `tracing` | tracing / header settings |
| `[openapi]` | `openapi` | specification settings |
| `[cors]` | `middleware` | CORS policy |
| `[oauth.client]` / `[oauth.server]` / `[oauth.resource]` | `oauth*` | issuer and metadata documents |

Built-in sections are **startup-only** — hot reload does not touch them.
`[server] host` accepts host names, resolved at startup like `App::bind`.

For the OAuth sections the file **overrides** the builder calls, unknown
keys fail startup, and activation still requires the explicit
`app.use_oauth()` in code.

### Hot reload

`reload_on_change()` polls the file every 5 seconds. A required section
that disappears or becomes malformed keeps its previous value; an optional
one becomes unavailable.
