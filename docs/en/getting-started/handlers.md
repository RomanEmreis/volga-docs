# Handlers

A request handler is a function or a closure mapped to a route. Its arguments are [extractors](/volga-docs/en/getting-started/route-params.html) — route and query parameters, headers, a JSON body, services from [DI](/volga-docs/en/advanced-patterns/di.html) — and whatever it returns is turned into the response. Volga accepts a handler in two shapes, and reads which one it is off the signature.

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

Since **v0.11.0** a handler with nothing to await — formatting, arithmetic, a lookup in memory, a check of a header — can be a plain `fn` or a closure that returns its response directly:

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

## Returning Errors

A handler that can fail returns `Result<T, E>`: `Ok` is the response, and since **0.12.0** `Err` is an error handed to the [error handler](/volga-docs/en/reliability-observability/errors.html#returning-errors-from-a-handler), never a response of its own. `E` is volga's `Error`, a `StatusCode`, a `(StatusCode, message)` pair, a `std::io::Error`, or any type implementing [`IntoError`](https://docs.rs/volga/latest/volga/error/trait.IntoError.html) — and `?` converts all of them.

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

A synchronous handler that genuinely **blocks** — `std::fs`, a synchronous database driver, a long computation — should not run on a runtime worker: while it does, that worker polls nothing else. Wrap it in [`blocking`](https://docs.rs/volga/latest/volga/fn.blocking.html), and its body runs on Tokio's blocking pool instead:

```rust compile
use volga::{App, HttpResult, blocking, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/reports/{id}", blocking(|id: u32| -> HttpResult {
        let report = std::fs::read_to_string(format!("reports/{id}.txt"))?;
        ok!(report)
    }));

    app.run().await
}
```

* The extractors still run on the worker; only the body is moved to [`spawn_blocking`](https://docs.rs/tokio/latest/tokio/task/fn.spawn_blocking.html) and awaited.
* `blocking` takes a synchronous handler. An asynchronous one already yields, has nothing to offload, and is rejected at compile time.
* The handler is shared between requests rather than cloned for each one, so what it captures does not have to be `Clone`.
* A panic in the body is resumed on the task awaiting it, just as if the handler had run inline.
* A hand-off to another thread costs far more than a short body does, so use `blocking` only when the body actually blocks.

### Cancellation

The offloaded call is **not** cancelled together with the request: once started, it runs to completion, and its result is discarded if the client has gone. A long body that should stop early takes a [`CancellationToken`](/volga-docs/en/reliability-observability/cancellation.html) and checks it as it goes:

```rust compile
use std::time::Duration;
use volga::{App, CancellationToken, blocking};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/blocking-task", blocking(|token: CancellationToken| {
        for _ in 0..5 {
            if token.is_cancelled() {
                break;
            }
            std::thread::sleep(Duration::from_secs(1));
        }
        "done"
    }));

    app.run().await
}
```

## Naming the Generics

Handler code never names the shape: it is carried by a marker type, [`marker::Async`](https://docs.rs/volga/latest/volga/marker/struct.Async.html) or [`marker::Immediate`](https://docs.rs/volga/latest/volga/marker/struct.Immediate.html), which the compiler infers. It is the last generic parameter of every method registering a handler, so a call site that spells the generics out leaves a `_` for it:

```rust compile-fragment
app.map_get::<_, _, (i32, i32), _>("/sum/{x}/{y}", |x: i32, y: i32| x + y);
```

In a bound of your own, `F: GenericHandler<Args>` means the asynchronous shape, as the marker defaults to `marker::Async`; `F: GenericHandler<Args, M>` with a generic `M` accepts both.

A type that is both a `Future` and `IntoResponse` fits both shapes and does not compile as a handler's return type. Nothing in volga is such a type.

Check out the full examples [here](https://github.com/RomanEmreis/volga/blob/main/examples/hello_world/src/main.rs) and [here](https://github.com/RomanEmreis/volga/blob/main/examples/long_running_task/src/main.rs).
