# Middleware

Middleware is code that runs for every request of a scope, before or after its handler: checking an API key, adding a header, logging, measuring time. It can be registered on the whole `App`, on a [route group](/volga-docs/en/getting-started/route-groups.html) or on a single route, and the same methods exist on all three. A request passes the application's middleware first, then its group's, then its route's, and the response goes back the same way.

## Enabling Middleware

If you're not using the `full` feature set, enable the `middleware` feature in your `Cargo.toml`:

```toml
[dependencies]
volga = { version = "0.15", features = ["middleware"] }
```

## Choosing a Method

| Method | Use it to | Runs |
|---|---|---|
| [`filter()`](#filters) | refuse a request before it reaches the handler | before the handler |
| [`tap_req()`](#handling-incoming-requests) | change the request: add a header, replace the body | before the handler |
| [`map_ok()`](#handling-successful-responses) | change a successful response | after the handler |
| [`map_err()`](#handling-errors) | turn errors into responses | after an error |
| [`with()`](#running-code-around-the-handler) | run code around the handler, or answer instead of it | around the handler |
| [`wrap()`](#with-or-wrap) | the same, with the whole request, body included | around the handler |
| [`attach()`](/volga-docs/en/middleware-infrastructure/parameterized-middleware.html) | register a reusable middleware type that carries its own settings | around the handler |

Start with the narrowest method that does the job. The first four take [extractors](/volga-docs/en/getting-started/extractors.html) as a handler does, and their signature says what they can change. If you come from ASP.NET Core or Go, `with()` and `wrap()` are the familiar middleware that calls `next`, and the other four are shortcuts for its most common uses.

## Filters

The [`filter()`](https://docs.rs/volga/latest/volga/app/router/struct.Route.html#method.filter) method allows you to define conditional logic (such as validation or access control) for a specific route or a group of routes.

```rust compile
use volga::{App, Path};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // Allow only positive numbers
    app.group("/positive", |g| {
        g.filter(|Path((x, y)): Path<(i32, i32)>| async move { x >= 0 && y >= 0 });
        g.map_get("/sum/{x}/{y}", sum);
    });
    
    // Allow only negative numbers
    app.map_get("/negative/sum/{x}/{y}", sum)
        .filter(|Path((x, y)): Path<(i32, i32)>| async move { x < 0 && y < 0 });

    app.run().await
}

async fn sum(x: i32, y: i32) -> i32 {
    x + y
}
```

### What a Filter Returns

A filter's verdict is a `bool`, `()`, a [`FilterResult`](https://docs.rs/volga/latest/volga/http/response/filter_result/struct.FilterResult.html) or a `Result<(), E>`. A request it stops goes to the [error handler](/volga-docs/en/reliability-observability/errors.html), with the status of what the filter returned:

| The filter returns | Answer |
|---|---|
| `false`, or `FilterResult::err()` | `400 Bad Request` with the message `Request rejected by filter` |
| `Err` of anything with a status — `Error`, `StatusCode`, `(StatusCode, E)`, `std::io::Error`, `ValidationError`, `OAuthError`, `Problem`, a type of your own implementing [`IntoError`](https://docs.rs/volga/latest/volga/error/trait.IntoError.html) | that status, as the same `Err` would get from a [handler](/volga-docs/en/reliability-observability/errors.html#returning-errors-from-a-handler) |
| `Err` of a string or a `Box<dyn std::error::Error + Send + Sync>` | `400 Bad Request` with that message |

A filter refuses a request for any reason — a missing API key as often as a bad parameter — so the message for `false` names none. A filter that wants a status or a message of its own returns `Err`.

The last row is the one difference from a handler, where a string is a `500`: an error without a status of its own, returned from a filter, is taken as the reason the request is refused. An error with a status keeps it — an `OAuthError` answers `401` for `invalid_token` and `403` for `insufficient_scope`, an `Error` keeps its instance and [attached response](/volga-docs/en/reliability-observability/errors.html#answering-with-a-body-of-its-own).

```rust compile
use volga::{App, headers::HttpHeaders, http::StatusCode};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // 401 Unauthorized without the header
    app.filter(|headers: HttpHeaders| match headers.get_raw("x-api-key") {
        Some(_) => Ok(()),
        None => Err((StatusCode::UNAUTHORIZED, "missing API key")),
    });

    app.map_get("/sum/{x}/{y}", |x: i32, y: i32| x + y);

    app.run().await
}
```

[`FilterResult::with_error()`](https://docs.rs/volga/latest/volga/http/response/filter_result/struct.FilterResult.html#method.with_error) takes the same types and answers as `Err` with that error does.

::: warning A std::error::Error is not enough
A filter's `Err` must be `Error` or implement `IntoError`. A type that only implements `std::error::Error` — `ParseIntError`, an error from another crate — does not compile there; give it a status with `.map_err(|err| (StatusCode::BAD_REQUEST, err))`, or wrap it into an error type of your own that implements `IntoError`.
:::

## Handling Incoming Requests

The [`tap_req()`](https://docs.rs/volga/latest/volga/app/router/struct.Route.html#method.tap_req) method gives you access to the [`HttpRequestMut`](https://docs.rs/volga/latest/volga/http/request/struct.HttpRequestMut.html), allowing you to inspect or mutate request before request processing.

```rust compile
use volga::{App, HttpRequestMut, headers};

headers! {
    (CustomHeader, "x-custom-header")
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app
        .map_get("/sum/{x}/{y}", |x: i32, y: i32| async move { x + y })
        .tap_req(|mut req: HttpRequestMut| async move { 
            req.try_insert_header::<CustomHeader>("Custom Value")?;
            Ok(req)
        });

    app.run().await
}
```

Like `with` and `filter`, `tap_req` takes extractors after its first argument: path and query parameters, headers, `Dc<T>`, an [extractor of your own](/volga-docs/en/advanced-patterns/custom-extractors.html). They are read before the closure runs, so they describe the request as it arrives at this middleware:

```rust compile
use serde::Deserialize;
use volga::{App, HttpRequestMut, Query, headers};

headers! {
    (Locale, "x-locale")
}

#[derive(Deserialize)]
struct Lang {
    lang: String,
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // GET /hello?lang=fr reaches the handler with `x-locale: fr`
    app.tap_req(|mut req: HttpRequestMut, q: Query<Lang>| {
        req.try_insert_header::<Locale>(q.lang.as_str())?;
        Ok(req)
    });

    app.map_get("/hello", || "hello");

    app.run().await
}
```

If an extractor fails, the closure does not run, and the request is answered with the extractor's error.

### Replacing the Body

[`map_body()`](https://docs.rs/volga/latest/volga/http/request/struct.HttpRequestMut.html#method.map_body) and [`try_map_body()`](https://docs.rs/volga/latest/volga/http/request/struct.HttpRequestMut.html#method.try_map_body) put a new body in place of the request's own, for example one decompressed with an algorithm Volga does not have:

```rust compile
use volga::{App, HttpBody, HttpRequestMut, Json, error::Error, ok};

fn decompress(body: HttpBody) -> Result<HttpBody, Error> {
    // e.g. wrap the stream into a decoder
    Ok(body)
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.tap_req(|req: HttpRequestMut| req.try_map_body(decompress));
    app.map_post("/items", |item: Json<serde_json::Value>| ok!("{}", item.0));

    app.run().await
}
```

[`try_map_body_async()`](https://docs.rs/volga/latest/volga/http/request/struct.HttpRequestMut.html#method.try_map_body_async) reads the body first, for example to check a signature over it, and puts the bytes back for the handler:

```rust compile
use http_body_util::BodyExt;
use volga::{App, HttpBody, HttpRequestMut, Json, error::Error, http::StatusCode, ok};

fn verify_signature(bytes: &[u8]) -> Result<(), Error> {
    if bytes.is_empty() {
        return Err((StatusCode::UNAUTHORIZED, "unsigned payload").into());
    }
    Ok(())
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.tap_req(|req: HttpRequestMut| async move {
        req.try_map_body_async(|body| async move {
            let bytes = body.collect().await?.to_bytes();
            verify_signature(&bytes)?;
            Ok(HttpBody::full(bytes))
        })
        .await
    });

    app.map_post("/webhook", |event: Json<serde_json::Value>| ok!("{}", event.0));

    app.run().await
}
```

* The new body is read under the request's [body limit](/volga-docs/en/requests-responses/body.html#limiting-the-body-size), as the old one was, so a body that grows on the way is answered `413` once it goes over the limit.
* The headers stay as they are. Remove one that no longer describes the body, such as `Content-Length` or `Content-Encoding`, with `remove_header()`.
* `HttpRequestMut::into_parts()` and `from_parts()` are deprecated: they handed out the request's extensions, which hold Volga's per-request state. Replace the body with these methods, and change the headers with `HttpRequestMut`'s own.

## Handling Successful Responses

Use the [`map_ok()`](https://docs.rs/volga/latest/volga/app/router/struct.Route.html#method.map_ok) method to transform or augment successful HTTP responses.

```rust compile
use volga::{App, HttpResponse, HttpResult, headers};

headers! {
    (CustomHeader, "x-custom-header")
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.group("/positive", |g| {
        g.map_ok(group_response);
        g.map_get("/sum/{x}/{y}", sum);
    });

    app.map_get("/negative/sum/{x}/{y}", sum)
        .map_ok(route_response);

    app.run().await
}

async fn group_response(mut resp: HttpResponse) -> HttpResult {
    resp.try_insert_header::<CustomHeader>("for-group")?;
    Ok(resp)
}

async fn route_response(mut resp: HttpResponse) -> HttpResult {
    resp.try_insert_header::<CustomHeader>("for-route")?;
    Ok(resp)
}

async fn sum(x: i32, y: i32) -> i32 {
    x + y
}
```

`map_ok` sees the success path only. An error, including a `401`, `404` or `429` that [Volga produces itself](/volga-docs/en/reliability-observability/errors.html#errors-volga-produces-itself), goes to `map_err`.

## Handling Errors

The [`map_err()`](https://docs.rs/volga/latest/volga/app/router/struct.Route.html#method.map_err) method lets you define custom error handlers - globally, per route, or for route groups.

```rust compile
use volga::{App, error::{Error, ProblemDetails}};
use std::io::Error as IoError;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();
    
    app
        .map_get("/error", produce_err)
        .map_err(handle_err);

    app.run().await
}

async fn handle_err(error: Error) -> ProblemDetails {
    ProblemDetails::from(error)
}

async fn produce_err() -> IoError {
    IoError::other("some error")
}
```

Whatever `Err` the handler returns reaches this `map_err` as an `Error` — `Err(StatusCode::NOT_FOUND)` and an `Err` of your own error type included.

A `map_err` on a route or a group covers the whole scope, its middleware included, whatever order it was registered in, and a second one replaces the first. See [Error Handlers of a Route or a Group](/volga-docs/en/reliability-observability/errors.html#error-handlers-of-a-route-or-a-group).

::: tip
By attaching [`map_err()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_err) to the [`App`](https://docs.rs/volga/latest/volga/app/struct.App.html), you configure a global error handler. You can read more about advanced error handling [here](/volga-docs/en/reliability-observability/errors.html).
:::

## Running Code Around the Handler

[`with()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.with) and [`wrap()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.wrap) receive the rest of the pipeline as `next`. Code before `next` runs on the way in, code after it on the way out. Middleware runs in the order it was registered, so the first one registered is the outermost:

```rust compile
use volga::{App, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // Middleware 1
    app.wrap(|context, next| async move {
        println!("Before Middleware 2");
        let response = next(context).await;
        println!("After Middleware 2");
        response
    });

    // Middleware 2
    app.with(|next| async move {
        println!("Before Request Handler");
        let response = next.await;
        println!("After Request Handler");
        response
    });

    app.map_get("/hello", || async {
        ok!("Hello World!")
    });

    app.run().await
}
```

A middleware that returns without calling `next` answers instead of everything after it, the handler included:

```rust compile
use volga::{App, ok, status};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.with(|_| async {
        // `next` is never called, so the handler never runs
        status!(400)
    });

    app.map_get("/hello", || async {
        ok!()
    });

    app.run().await
}
```

To refuse a request on a condition, a [filter](#filters) says the same in less code.

### `with()` or `wrap()`

`with()` takes extractors before `next`, as a handler does: headers, path and query parameters, `Dc<T>`. It covers most cases, but it does not see the request body:

```rust compile
use std::time::Instant;
use volga::{App, Path, middleware::Next};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/users/{id}", |id: u32| async move { id.to_string() })
        .with(|Path(id): Path<u32>, next: Next| async move {
            let started = Instant::now();
            let response = next.await;
            println!("user {id} answered in {:?}", started.elapsed());
            response
        });

    app.run().await
}
```

`wrap()` receives the whole request as an [`HttpContext`](https://docs.rs/volga/latest/volga/middleware/struct.HttpContext.html), body included, which is what compression, decoding and similar middleware need. Prefer `with()` unless you need the body.

## Synchronous Middleware

[`filter()`](https://docs.rs/volga/latest/volga/app/router/struct.Route.html#method.filter), [`map_ok()`](https://docs.rs/volga/latest/volga/app/router/struct.Route.html#method.map_ok), [`map_err()`](https://docs.rs/volga/latest/volga/app/router/struct.Route.html#method.map_err) and [`tap_req()`](https://docs.rs/volga/latest/volga/app/router/struct.Route.html#method.tap_req) also accept a plain `fn` or a closure that returns its verdict, response or request directly, when there is nothing to await — on [`App`](https://docs.rs/volga/latest/volga/app/struct.App.html), a route and a route group alike, just as [handlers](/volga-docs/en/getting-started/handlers.html#synchronous-handlers) do:

```rust compile
use volga::{App, HttpResponse, HttpResult, Path, headers, headers::HttpHeaders};

headers! {
    (CustomHeader, "x-custom-header")
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // Reject requests without an API key
    app.filter(|headers: HttpHeaders| headers.get_raw("x-api-key").is_some());

    app.map_get("/positive/sum/{x}/{y}", |x: i32, y: i32| x + y)
        .filter(|Path((x, y)): Path<(i32, i32)>| x >= 0 && y >= 0)
        .map_ok(tag_response);

    app.run().await
}

fn tag_response(mut resp: HttpResponse) -> HttpResult {
    resp.try_insert_header::<CustomHeader>("sync")?;
    Ok(resp)
}
```

[`wrap()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.wrap), [`with()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.with) and [`attach()`](/volga-docs/en/middleware-infrastructure/parameterized-middleware.html) stay asynchronous, since what they exist for is awaiting `next`.

## Requests That Match No Route

Routing runs first and decides *what* answers a request. All three of its outcomes — the matched route, the fallback handler, and a `405` carrying its `Allow` header — travel through the same global chain.

Three things follow from that:

* **A short-circuiting global middleware decides unmatched requests too.** `filter`, a `with` that returns early, and `authorize` run before routing's answer is known, so a global authorization middleware answers `401` for a path that does not exist rather than `404` — which leaks less about what the service has. Per-route and per-group middleware are unaffected: those belong to a route that by definition matched.
* **Rate limiting counts requests that match no route.** A limiter's budget is spent by traffic that never reaches a handler, so size it against real traffic rather than against the route count.
* **The per-request scope is built for those requests.** [`ClientIp`](https://docs.rs/volga/latest/volga/struct.ClientIp.html), `CancellationToken`, `Config<T>`, `HostEnv` and `Dc<T>` work inside a fallback handler, and the application's request body limit applies there too — no route or group claimed the request, so no [limit of theirs](/volga-docs/en/requests-responses/body.html#per-route-group-and-per-route) does.

### Telling the two apart

Middleware that should only do its work for a real endpoint reads [`matched_route()`](https://docs.rs/volga/latest/volga/middleware/struct.HttpContext.html#method.matched_route):

```rust compile
use volga::App;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.wrap(|ctx, next| async move {
        if !ctx.matched_route() {
            // nothing to meter for a request no route will answer
            return next(ctx).await;
        }

        next(ctx).await
    });

    app.run().await
}
```

It answers `true` when routing matched an endpoint for this request, and `false` for the requests answered by the fallback or by a `405`. It answers the same at every layer: a route's or a group's own middleware runs after the route pipeline has been taken and still sees `true`. The CORS middleware is the first caller — it gates the preflight short-circuit on it.

## Examples

* [Middleware example](https://github.com/RomanEmreis/volga/blob/main/examples/middleware/src/main.rs)
* [Request filter example](https://github.com/RomanEmreis/volga/blob/main/examples/request_validation/src/main.rs)
* [Response handler example](https://github.com/RomanEmreis/volga/blob/main/examples/response_handler/src/main.rs)
