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
`HEAD` is mapped implicitly for every `GET` route, so you only need [`map_head`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_head) for a custom implementation. See [Custom Handling of HEAD, OPTIONS, and TRACE](/volga-docs/en/advanced-patterns/custom-trace-opt-head.html).
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
