# Running, observing and testing a volga app

## Feature flags

`default = ["http1"]`. Adding no features means almost nothing below is
available.

| Feature | Enables | In `full`? |
|---|---|---|
| `http1` / `http2` | the HTTP transports (at least one is required) | yes |
| `middleware` | the middleware pipeline, CORS | yes |
| `di` | dependency injection | yes |
| `config` | TOML/JSON configuration files | yes |
| `tls` | HTTPS, HSTS, redirection | yes |
| `tracing` | the `tracing` integration | yes |
| `multipart` | `Multipart` in both directions | yes |
| `openapi` | OpenAPI registry, spec and UI | yes |
| `problem-details` | RFC 9457 responses | yes |
| `rate-limiting` | the four limiters | yes |
| `static-files` | static asset serving | yes |
| `compression-full` / `decompression-full` | brotli, gzip, deflate, zstd | yes |
| `ws` | WebSockets | yes |
| `cookie-full` | `cookie` + `signed-cookie` + `private-cookie` | yes |
| `validation-derive` | `#[derive(Validate)]` (the trait and `Valid<E>` need no feature) | yes |
| `auth` | `basic-auth` + `jwt-auth` | yes |
| `oauth-client` | issuer-based bearer validation | yes |
| `jwt-derive` / `jwt-auth-full` / `auth-full` | `#[derive(Claims)]` | **no** |
| `macros` | `#[http_header]` | **no** |
| `dev-cert` | self-signed development certificates | **no** |
| `test` | `TestServer`, `TempFile`, `TestWebSocket` | **no** — a dev-dependency |

Cargo features are additive, so `features = ["full", "auth-full", "macros"]`
is the right way to top up a `full` build.

HTTP/2 is negotiated when both `http1` and `http2` are on; an `http2`-only
build serves HTTP/2 exclusively.

## Starting the server

```rust
#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new().bind("0.0.0.0:8080");
    app.map_get("/health", || async { "ok" });
    app.run().await
}
```

`run_blocking()` builds its own runtime and must **not** be called from
inside one — it is for prototypes and small tools. `run_with_listener` /
`run_with_std_listener` take a listener you already own (socket activation,
tests, systemd).

`bind` accepts what `tokio::net::TcpListener::bind` accepts: `"127.0.0.1:8080"`,
`"localhost:8080"`, `"[::1]:8080"`, the unbracketed `"::1:8080"`,
zone-scoped IPv6, and `SocketAddr` values. Names resolve when the server
starts, without blocking the runtime; a name resolving to several addresses
is tried in order. An address that cannot be understood is an `io::Error`
from `run()` — never a silent fallback (that silent fallback was the 0.9.7
security fix).

### Server limits

<!-- snippet: skip -->
```rust
App::new()
    .with_body_limit(Limit::Limited(10 * 1024 * 1024))   // default 5 MB
    .without_body_limit()
    .with_max_connections(Limit::Limited(1_000))
    .with_max_header_count(Limit::Limited(64))
    .with_max_header_list_size(Limit::Limited(16 * 1024))   // Unlimited panics
    .with_http2_limits(|l| l /* ... */)
    .with_no_delay()
    .without_greeter()          // no startup banner
```

`without_implicit_head()` is **removed** in 0.10.0. A `GET` route answers
`HEAD` itself rather than through a second bare route, so there is nothing
left to switch off, and `HEAD` is required of a general-purpose server
(RFC 9110 §9.1). Map a `HEAD` route that says so if some path must fail.

## Graceful shutdown

Ctrl+C and `SIGTERM` are handled out of the box. To add your own trigger:

<!-- snippet: skip -->
```rust
// the framework owns the handle
let (app, shutdown) = App::with_shutdown();
tokio::spawn(async move {
    watch_for_drain().await;
    shutdown.shutdown();
});
app.run().await

// or register one you own
let handle = ShutdownHandle::new();
let app = App::new().with_shutdown_signal(handle.clone());

// or chain a future
let app = App::new().shutdown_on(async move { let _ = rx.await; });
```

All three compose with the OS signal handler and with each other — whichever
fires first wins. `shutdown_on` is safe to call before any runtime exists.
Observe with `handle.is_shutdown_requested()` and `handle.cancelled()`.

Once the signal arrives, the accept loop stops and the open connections are
told to close after the response they are serving. `run()` waits for them up
to the **shutdown timeout** — 10 seconds by default — and then **closes**
whatever is still open: its request's `CancellationToken` is cancelled and
the response is dropped. `run()` returns once every connection is gone (the
HTTPS redirect listener's included), then releases the app's services. A TLS
handshake still in progress is dropped, not waited for.

Set the timeout (0.11.0+) in code or in the config file; `Duration::ZERO`
closes open connections immediately:

```rust
use std::time::Duration;

let app = App::new().with_shutdown_timeout(Duration::from_secs(30));
```

```toml
[server]
shutdown_timeout_secs = 30
```

`ShutdownHandle` is also an **extractor** (0.11.0+): a handler or middleware
taking one gets the running server's handle, whether or not the app was
built with `with_shutdown`. No DI registration is needed for an admin
endpoint:

```rust
use volga::{ShutdownHandle, ok};

app.map_post("/admin/shutdown", |handle: ShutdownHandle| {
    handle.shutdown();
    ok!("shutting down")
});
```

`handle.cancelled()` is a `'static` future resolving when the shutdown
starts — the signal for a response that never ends on its own (SSE, a
proxied stream) to end itself instead of being cut off at the timeout. See
`realtime.md`. It is **not** the same signal as the request's
`CancellationToken`, which is not cancelled when the shutdown starts, since
requests in flight are still answered.

## Request cancellation

<!-- snippet: skip -->
```rust
use volga::{App, CancellationToken, ok};

app.map_get("/long-task", |token: CancellationToken| async move {
    tokio::select! {
        _ = token.cancelled() => (),
        _ = long_running_task() => (),
    }
    ok!("done")
});
```

The token is cancelled when the connection fails (the client disconnected)
and when a graceful shutdown's timeout closes the connection — not when a
shutdown merely starts. This is Tokio's `CancellationToken`, so
`is_cancelled()` polling works too. The handler is dropped with its
connection, so the token matters most for work that outlives it: a spawned
task, or a `blocking` body, which is never cancelled for you:

```rust
use volga::{CancellationToken, blocking};

app.map_get("/crunch", blocking(|token: CancellationToken| {
    for _ in 0..5 {
        if token.is_cancelled() { break; }
        std::thread::sleep(std::time::Duration::from_secs(1));
    }
    "done"
}));
``` Requests that
finish in a few hundred milliseconds are unaffected — the win is on long
work the client walked away from.

## Tracing (feature `tracing`)

Needs `tracing` and `tracing-subscriber` as direct dependencies too.

```rust
use volga::{App, tracing::TracingConfig};
use tracing_subscriber::prelude::*;

tracing_subscriber::registry()
    .with(tracing_subscriber::fmt::layer())
    .init();

let mut app = App::new()
    .set_tracing(TracingConfig::new()
        .with_header()
        .with_header_name("x-correlation-id"));   // default: request-id
```

`with_header()` is what puts the span id on the response;
`without_header()` removes it. `with_tracing(|t| ...)` is the closure form.
`App::with_default_tracing()` was removed — use
`.set_tracing(TracingConfig::default())`.

## OpenAPI (feature `openapi`)

<!-- snippet: skip -->
```rust
let mut app = App::new().with_open_api(|api| api /* ... */);
app.use_open_api();      // serves the spec and UI

app.map_post("/upload", upload)
    .open_api(|route| route.produces_multipart(200));
```

Configuring without `use_open_api()` logs a warning and serves nothing.

## Testing (feature `test`, as a dev-dependency)

```toml
[dev-dependencies]
volga = { version = "0.9", features = ["test"] }
```

```rust
use volga::test::TestServer;

#[tokio::test]
async fn health_check() {
    let server = TestServer::builder()
        .setup(|app| {
            app.map_get("/health", || async { "ok" });
        })
        .build()
        .await;

    let response = server.client()
        .get(server.url("/health"))
        .send()
        .await
        .unwrap();

    assert!(response.status().is_success());
    server.shutdown().await;
}
```

Each `TestServer` binds a free port and shares no global state, so tests run
in parallel. Since 0.10.1 the builder returns only once that port is bound,
so a test's first request is no longer occasionally refused. `TestServer::spawn(setup)` is the one-liner form;
`.configure(..)` reaches the `App` builder (for TLS, auth, CORS),
`.with_https()` turns on TLS, `server.client()` is a preconfigured
`reqwest::Client`, `server.ws("/ws")` opens a `TestWebSocket`, and
`TempFile` helps with upload tests.

This is the right level for middleware ordering, headers, auth, CORS and
routing — the things a unit test cannot see.

## Deployment notes

* Behind a TLS-terminating proxy: `require_https(false)` on bearer auth, and
  `with_trusted_proxies([..])` so rate limiting and `ClientIp` see the real
  client.
* Multi-instance: the default rate-limit store is per-process. Implement the
  store trait against Redis, or accept per-instance limits.
* `App::new()` listens on **every interface** on non-Windows platforms.
  Bind explicitly for anything internal.
* Enable exactly the features you use — each one pulls dependencies and
  compile time.

## Rust conventions this project expects

* MSRV 1.90, edition 2024. The volga workspace itself sets
  `unsafe_code = "forbid"` and warns on `missing_docs`,
  `missing_debug_implementations` and `unreachable_pub`.
* No `.unwrap()` / `.expect()` in a handler — return `HttpResult` and use
  `?`. `expect` at startup, for configuration that must exist, is fine.
* Keep `std::sync` guards out of `.await` scopes; a handler future must be
  `Send`.
* `cargo clippy --all-targets` and `cargo fmt` clean before handing code
  back.
