# Configuration Files

Volga supports file-based application configuration. You can define settings in a TOML or JSON file, bind sections to strongly-typed Rust structs, and access them in request handlers via the [`Config<T>`](https://docs.rs/volga/latest/volga/struct.Config.html) extractor. Hot-reload is also supported.

## Prerequisites

### Dependencies

If you're not using the `full` feature set, you need to enable the `config` feature in your `Cargo.toml`:

```toml
[dependencies]
volga = { version = "...", features = ["config"] }
serde = { version = "1", features = ["derive"] }
```

[`serde`](https://crates.io/crates/serde) with the `derive` feature is required for deserializing config sections into your structs.

### Supported Formats

Volga supports two configuration file formats (detected by file extension):
- **TOML** (`.toml`) — recommended
- **JSON** (`.json`)

## Quick Start

Create a config file `app_config.toml` in your project root:

```toml
[server]
host = "0.0.0.0"
port = 3000

[handler]
msg = "World"
```

Define a struct for your custom section and bind it during app setup:

```rust
use volga::{App, Config, ok};
use serde::Deserialize;

#[derive(Deserialize)]
struct HandlerConfig {
    msg: String,
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new().with_config(|cfg| {
        cfg.with_file("app_config.toml")
            .bind_section::<HandlerConfig>("handler")
    });

    app.map_get("/hello", |cfg: Config<HandlerConfig>| async move {
        ok!(fmt: "Hello, {}!", cfg.msg)
    });

    app.run().await
}
```

Now a `GET /hello` request returns `Hello, World!`.

## Loading Configuration

Volga provides three ways to load a config file:

### Default Config

The simplest option — [`with_default_config()`](https://docs.rs/volga/latest/volga/struct.App.html#method.with_default_config) automatically discovers `app_config.toml` or `app_config.json` in the current working directory:

```rust
let app = App::new().with_default_config();
```

::: warning
[`with_default_config()`](https://docs.rs/volga/latest/volga/struct.App.html#method.with_default_config) panics at startup if neither `app_config.toml` nor `app_config.json` is found.
:::

### Builder Closure

For full control, use [`with_config()`](https://docs.rs/volga/latest/volga/struct.App.html#method.with_config) which gives you a [`ConfigBuilder`](https://docs.rs/volga/latest/volga/struct.ConfigBuilder.html):

```rust
let app = App::new().with_config(|cfg| {
    cfg.with_file("config/prod.toml")
        .bind_section::<Database>("database")
        .bind_section::<Cache>("cache")
        .reload_on_change()
});
```

If you omit [`with_file()`](https://docs.rs/volga/latest/volga/struct.ConfigBuilder.html#method.with_file), the builder falls back to the same default file discovery as [`with_default_config()`](https://docs.rs/volga/latest/volga/struct.App.html#method.with_default_config) — it looks for `app_config.toml` or `app_config.json` in the current working directory. This is useful when you want the default file but also need to bind custom sections or enable hot-reload:

```rust
let app = App::new().with_config(|cfg| {
    cfg.bind_section::<Database>("database")
        .reload_on_change()
});
```

### Standalone Builder

You can also create a [`ConfigBuilder`](https://docs.rs/volga/latest/volga/struct.ConfigBuilder.html) separately and pass it via [`set_config()`](https://docs.rs/volga/latest/volga/struct.App.html#method.set_config):

```rust
use volga::{App, ConfigBuilder};

let config = ConfigBuilder::from_file("config/prod.toml")
    .bind_section::<Database>("database")
    .reload_on_change();

let app = App::new().set_config(config);
```

## Binding Sections

### Required Sections

Use [`bind_section::<T>(key)`](https://docs.rs/volga/latest/volga/struct.ConfigBuilder.html#method.bind_section) to register a required section. If the section is missing or malformed, the application panics at startup:

```rust
#[derive(Deserialize)]
struct Database {
    url: String,
}

let app = App::new().with_config(|cfg| {
    cfg.with_file("app_config.toml")
        .bind_section::<Database>("database")
});
```

Corresponding `app_config.toml`:

```toml
[database]
url = "postgres://localhost/mydb"
```

### Optional Sections

Use [`bind_section_optional::<T>(key)`](https://docs.rs/volga/latest/volga/struct.ConfigBuilder.html#method.bind_section_optional) for sections that may be absent. If the section is missing, [`Config<T>`](https://docs.rs/volga/latest/volga/struct.Config.html) will not be available, but the app won't panic:

```rust
#[derive(Deserialize)]
struct Cache {
    ttl: u64,
}

let app = App::new().with_config(|cfg| {
    cfg.with_file("app_config.toml")
        .bind_section_optional::<Cache>("cache")
});
```

## Accessing Config in Handlers

Use the [`Config<T>`](https://docs.rs/volga/latest/volga/struct.Config.html) extractor to access a bound section in any request handler. It performs one atomic load + `Arc::clone` per request — no deserialization at runtime:

```rust
use volga::{App, Config, ok};
use serde::Deserialize;

#[derive(Deserialize)]
struct Database {
    url: String,
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new().with_config(|cfg| {
        cfg.with_file("app_config.toml")
            .bind_section::<Database>("database")
    });

    app.map_get("/db-url", |db: Config<Database>| async move {
        ok!(db.url.as_str())
    });

    app.run().await
}
```

## Built-in Sections

Volga automatically recognizes and applies certain reserved sections from the config file. These sections configure framework internals and do **not** require [`bind_section()`](https://docs.rs/volga/latest/volga/struct.ConfigBuilder.html#method.bind_section):

| Section      | Feature Flag   | Fields                                                        |
|--------------|----------------|---------------------------------------------------------------|
| `[server]`   | *(always)*     | `host`, `port`, `body_limit_bytes`, `max_header_count`, `max_connections` |
| `[tls]`      | `tls`          | TLS certificate configuration                                |
| `[tracing]`  | `tracing`      | Tracing/logging configuration                                |
| `[openapi]`  | `openapi`      | OpenAPI specification settings                                |
| `[cors]`     | `middleware`   | CORS policy configuration                                     |

For example, the `[server]` section lets you configure the host and port directly in the config file:

```toml
[server]
host = "0.0.0.0"
port = 8080
body_limit_bytes = 1048576
max_connections = 1000
```

::: tip
Built-in sections are applied at startup only. They are **not** affected by hot-reload.
:::

## Hot Reload

Enable automatic config reloading with [`reload_on_change()`](https://docs.rs/volga/latest/volga/struct.ConfigBuilder.html#method.reload_on_change). Volga will poll the config file every 5 seconds and update all bound sections:

```rust
let app = App::new().with_config(|cfg| {
    cfg.with_file("app_config.toml")
        .bind_section::<HandlerConfig>("handler")
        .reload_on_change()
});
```

Reload behavior:
- **Required sections** — if a required section disappears from the file or becomes malformed during reload, the previous value is retained.
- **Optional sections** — if an optional section disappears, [`Config<T>`](https://docs.rs/volga/latest/volga/struct.Config.html) becomes unavailable.
- **Built-in sections** (server, tls, etc.) are **not** reloaded — they are startup-only.

::: warning
[`reload_on_change()`](https://docs.rs/volga/latest/volga/struct.ConfigBuilder.html#method.reload_on_change) requires [`with_file()`](https://docs.rs/volga/latest/volga/struct.ConfigBuilder.html#method.with_file) to be called. The app will panic at startup if no file path is configured.
:::

## JSON Format Example

You can use JSON instead of TOML. Create `app_config.json`:

```json
{
  "server": {
    "host": "0.0.0.0",
    "port": 3000
  },
  "database": {
    "url": "postgres://localhost/mydb"
  }
}
```

```rust
let app = App::new().with_config(|cfg| {
    cfg.with_file("app_config.json")
        .bind_section::<Database>("database")
});
```

## Full Example

For a complete working example, see the [config example](https://github.com/RomanEmreis/volga/tree/main/examples/config) in the Volga repository.
