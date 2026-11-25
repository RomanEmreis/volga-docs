# HTTP Versions and Methods

## HTTP/1 and HTTP/2
Starting with **v0.3.1**, you can configure the HTTP version.
If you add Volga like this, HTTP/1 is used by default:
```toml
[dependencies]
volga = { version = "..." }
```
To enable HTTP/2, add the `http2` feature or use `full`:
```toml
[dependencies]
volga = { version = "...", features = ["full"] }
```
With `full`, HTTP/2 is used when possible, and it falls back to HTTP/1 automatically.

## Header Read Timeout

A client that sends the head of a request a byte at a time holds its connection for as long as it likes, and so does one that connects and sends nothing, or never finishes a TLS handshake. A few of them are enough to take every permit of [`with_max_connections()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.with_max_connections). Since **0.15.1**, [`with_header_read_timeout()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.with_header_read_timeout) sets how long a client has to send the request line and the headers before its connection is closed:

```rust compile
use std::time::Duration;
use volga::{App, Limit};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let app = App::new()
        .with_header_read_timeout(Limit::Limited(Duration::from_secs(10)));

    app.run().await
}
```

or with the `header_read_timeout_secs` key of the `[server]` section in a [configuration file](/volga-docs/en/middleware-infrastructure/config-files.html#built-in-sections), where `0` means no timeout:

```toml
[server]
header_read_timeout_secs = 10
```

* The same timeout bounds what comes before the head: the [TLS handshake](/volga-docs/en/protocols-realtime/https.html), and the first bytes by which a server with both HTTP/1 and HTTP/2, or with [WebSockets](/volga-docs/en/protocols-realtime/ws.html), tells the protocol. Each of these steps has the whole timeout.
* The timer runs whenever the server waits for a request, so it also closes an HTTP/1 keep-alive connection left idle that long between requests. It does not run while a handler works or a body is read. A connection it closes is logged at `debug`, not `error`.
* Past its preface an HTTP/2 connection is not timed: its requests are frames on a connection that is already set up. The method exists with the `http1` or the `tls` feature.
* `Limit::Default` and `Limit::Unlimited` mean no timeout. `Limit::Limited(Duration::ZERO)` panics.

::: warning
The timeout is **off by default**, because it has a price on every request. hyper creates a new timer for each request head and registers it with the timer wheel of the runtime, which every worker locks. In a plain-text HTTP/1 benchmark at about a million requests a second that halved the throughput (hyper 1.12, tokio 1.54); a server that does more work per request loses a smaller share. Set it if clients reach the server directly; a server behind a proxy that bounds slow clients itself does not need it.
:::

## HTTP Methods
Volga has a named `map_*` method for every standard verb, registered on an [`App`](https://docs.rs/volga/latest/volga/app/struct.App.html) or on a [`RouteGroup`](https://docs.rs/volga/latest/volga/routing/struct.RouteGroup.html):

```rust compile-fragment
app.map_get("/items", || async { ok!("list") });
app.map_post("/items", || async { ok!("created") });
app.map_put("/items/{id}", || async { ok!("updated") });
app.map_patch("/items/{id}", || async { ok!("patched") });
app.map_delete("/items/{id}", || async { ok!("deleted") });
app.map_head("/items", || async { ok!() });
app.map_options("/items", || async { ok!() });
app.map_trace("/items", || async { ok!() });
```

::: tip
A `HEAD` request with no route of its own is answered by the `GET` route for the same path, through that route's middleware and CORS policy, so you only need [`map_head`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_head) for a custom implementation. See [Custom Handling of HEAD, OPTIONS, and TRACE](/volga-docs/en/advanced-patterns/custom-trace-opt-head.html).
:::

### The `QUERY` method
Starting with **v0.9.4**, Volga supports the HTTP `QUERY` method — a safe, idempotent verb that carries a request body, for searches too large or too structured to express in a URI query string.

Register a handler with [`map_query()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_query):

```rust compile
use volga::{App, Json, ok};
use serde::Deserialize;

#[derive(Deserialize)]
struct SearchQuery {
    criteria: String
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_query("/search", |query: Json<SearchQuery>| async move {
        // run the search by query.criteria...
        ok!("search results...")
    });

    app.run().await
}
```

Test it with `curl`:
```bash
> curl -X QUERY "http://localhost:7878/search" -H "Content-Type: application/json" -d '{"criteria":"volga"}'
```

::: warning
Don't confuse [`map_query()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_query) with the [`Query<T>`](/volga-docs/en/getting-started/query-params.html) extractor: the former registers a route for the `QUERY` **verb**, the latter reads the URI **query string** of any request.
:::

::: tip
Prefer putting complex selection criteria in the request body of a `QUERY` request. Use URI query parameters only for routing or cache-affecting metadata — tenant, locale, version, flags, pagination compatibility.
:::

### Any method
Also since **v0.9.4**, [`map()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.map) registers a route for any HTTP method. It is useful when the verb is only known at runtime, when the same handler serves several methods, or for non-standard verbs:

```rust compile
use volga::{App, ok};
use volga::http::Method;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map(Method::GET, "/hello", || async {
        ok!("Hello, World!")
    });

    // a string verb and a runtime-built pattern work as well
    app.map("QUERY", format!("/search/{}", "v1"), || async {
        ok!("search results...")
    });

    app.run().await
}
```

The `method` argument accepts anything that converts into a [`Method`](https://docs.rs/http/latest/http/method/struct.Method.html) — including string verbs — and the pattern accepts both a borrowed `&str` (no allocation) and an owned `String` built at runtime.

::: warning
[`map()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.map) **panics** if the method cannot be converted into a valid [`Method`](https://docs.rs/http/latest/http/method/struct.Method.html). Routes are registered at startup, so an invalid verb is a programming error rather than a runtime condition.
:::
