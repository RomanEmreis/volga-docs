# Handlers

A request handler is a function or a closure mapped to a route. Its arguments are [extractors](/volga-docs/en/getting-started/extractors.html) — route and query parameters, headers, a JSON body, services from [DI](/volga-docs/en/advanced-patterns/di.html), [types of your own](/volga-docs/en/advanced-patterns/custom-extractors.html) — and whatever it returns is turned into the response. Volga accepts a handler in two shapes, and reads which one it is off the signature.

## Asynchronous Handlers

An `async fn`, or a closure returning a future. This is the shape for a handler that awaits something: a database query, an HTTP call, a file read through `tokio::fs`.

```rust compile
use volga::{App, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/hello/{name}", |name: String| async move {
        ok!("Hello, {name}!")
    });

    app.map_get("/users/{id}", get_user);

    app.run().await
}

async fn get_user(id: u32) -> String {
    // e.g. `db.find_user(id).await`
    format!("user #{id}")
}
```

## Synchronous Handlers

A handler with nothing to await — formatting, arithmetic, a lookup in memory, a check of a header — can be a plain `fn` or a closure that returns its response directly:

```rust compile
use volga::{App, HttpResult, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/sum/{x}/{y}", |x: i32, y: i32| x + y);
    app.map_get("/hello/{name}", |name: String| ok!("Hello, {name}!"));
    app.map_get("/health", health);

    app.run().await
}

fn health() -> HttpResult {
    ok!("healthy")
}
```

Everything else is the same as for the asynchronous shape: the extractors run before the handler, so `Json<T>`, `Form<T>`, `Query<T>` and `Dc<T>` arrive with the body already read; the return value is anything implementing [`IntoResponse`](https://docs.rs/volga/latest/volga/http/response/into_response/trait.IntoResponse.html), `HttpResult` and [`Result<T, E>`](#returning-errors) included; and the route is described in OpenAPI the same way.

```rust compile
use volga::{App, Json, ok};
use serde::Deserialize;

#[derive(Deserialize)]
struct User {
    name: String,
    age: u32,
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_post("/users", |user: Json<User>| {
        ok!("{} is {} years old", user.name, user.age)
    });

    app.run().await
}
```

A synchronous handler runs on the runtime worker that polls the request, exactly as an `async` one with no `.await` inside does, and costs the same. It is the right shape for short, CPU-light work.

### Where both shapes are accepted

* `map_get`, `map_post`, `map_put`, `map_patch`, `map_delete`, `map_head`, `map_options`, `map_trace`, `map_query` and `map`, on [`App`](https://docs.rs/volga/latest/volga/app/struct.App.html) and on a [`RouteGroup`](https://docs.rs/volga/latest/volga/app/router/struct.RouteGroup.html);
* [`map_fallback`](/volga-docs/en/reliability-observability/errors.html#the-fallback-handler) and [`map_err`](/volga-docs/en/reliability-observability/errors.html);
* the WebSocket [`map_conn`](/volga-docs/en/protocols-realtime/ws.html) and [`map_msg`](/volga-docs/en/protocols-realtime/ws.html#simple-server);
* the middleware [`filter`, `map_ok`, `map_err` and `tap_req`](/volga-docs/en/middleware-infrastructure/middleware.html#synchronous-middleware).

`wrap`, `with` and `attach` take asynchronous middleware only, since what they exist for is awaiting `next`.

## Extractors That Go Together

A handler reads its extractors in the order they stand. Extractors of the head (path and query parameters, headers, cookies, `Dc<T>`, [types of your own](/volga-docs/en/advanced-patterns/custom-extractors.html)) combine freely, with each other and with one extractor of the body:

```rust compile
use serde::Deserialize;
use volga::{App, HttpRequest, Json, Query, ok};

#[derive(Deserialize)]
struct Paging {
    page: u32,
}

#[derive(Deserialize)]
struct Item {
    name: String,
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // Extractors of the head, then one of the body
    app.map_put("/lists/{id}", |id: u64, paging: Query<Paging>, item: Json<Item>| {
        ok!("list {id}, page {}: {}", paging.page, item.name)
    });

    // `HttpRequest` takes the whole request, so it stands last
    app.map_post("/raw/{id}", |id: u64, req: HttpRequest| {
        ok!("{id}: {}", req.uri())
    });

    app.run().await
}
```

Three combinations cannot read one request, and a handler taking one of them fails to build:

* **Two extractors of the body.** The body is a stream that is read once, so a handler takes one of `Json<T>`, `Form<T>`, `HttpBody`, `ByteStream`, `File`, `Multipart` and `HttpRequest`.
* **Anything after `HttpRequest`.** It takes the whole request, head included, so it stands last: `|id: u64, req: HttpRequest|`, not `|req: HttpRequest, id: u64|`.
* **Positional parameters next to `Path<T>` or `NamedPath<T>`.** A handler reads its path parameters one way or the other.

The error names the rule:

```text
`HttpRequest` takes the whole request, so it stands last among the arguments of a handler
```

The check runs when the handler is instantiated, so `cargo build` and `cargo test` report it, and `cargo check` does not.

## Returning Errors

A handler that can fail returns `Result<T, E>`: `Ok` is the response, and `Err` is an error handed to the [error handler](/volga-docs/en/reliability-observability/errors.html#returning-errors-from-a-handler), never a response of its own. `E` is volga's `Error`, a `StatusCode`, a `(StatusCode, message)` pair, a `std::io::Error`, or any type implementing [`IntoError`](https://docs.rs/volga/latest/volga/error/trait.IntoError.html) — and `?` converts all of them.

```rust compile
use volga::{App, HttpResult, http::StatusCode, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/users/{id}", |id: u32| -> Result<String, StatusCode> {
        match id {
            1 => Ok("admin".into()),
            _ => Err(StatusCode::NOT_FOUND),
        }
    });

    app.map_get("/config", read_config);

    app.run().await
}

async fn read_config() -> HttpResult {
    // A missing file is a 404, an unreadable one a 403
    let text = tokio::fs::read_to_string("app_config.toml").await?;
    ok!(text)
}
```

::: warning
A bare message — `Err("not found")`, `Err(format!(..))` — has no status of its own and answers `500`. Pair it with one: `Err((StatusCode::NOT_FOUND, "not found"))`.
:::

## Blocking Work

A synchronous handler that genuinely blocks, such as `std::fs` or a synchronous database driver, should not run on a runtime worker. Wrap it in `blocking` to move its body to Tokio's blocking pool, as described in [Blocking Work](/volga-docs/en/advanced-patterns/blocking.html).

Check out the full example [here](https://github.com/RomanEmreis/volga/blob/main/examples/hello_world/src/main.rs).
