# Responses, status codes and errors

## The shape of a response

A handler returns anything implementing `IntoResponse`. The workhorse is
`HttpResult` = `Result<HttpResponse, volga::error::Error>`, which every
response macro produces and which lets `?` short-circuit into the error
pipeline.

<!-- snippet: skip -->
```rust
use volga::{HttpResult, ok};

async fn handler() -> HttpResult {
    let user = load().await?;   // `?` converts any IntoError type
    ok!(user)
}
```

## Response macros

| Macro | Status |
|---|---|
| `ok!` | 200 |
| `created!` | 201 |
| `accepted!` | 202 |
| `no_content!` | 204 |
| `bad_request!` | 400 |
| `not_found!` | 404 |
| `status!(code, ...)` | any |
| `redirect!` (301) / `found!` (302) / `see_other!` (303) / `temp_redirect!` (307) / `permanent_redirect!` (308) | 3xx, sets `Location` |
| `html!` / `html_file!` | 200, `text/html` |
| `file!` | 200, a file download |
| `form!` | 200, `application/x-www-form-urlencoded` |
| `stream!` / `byte_stream!` | 200, a streaming body |
| `sse!` / `sse_stream!` | 200, `text/event-stream` |
| `response!` | the low-level builder the rest expand to |

### Bodies

`ok!` (and every macro that shares its grammar) has three modes:

<!-- snippet: skip -->
```rust
ok!();                                  // empty, no Content-Type
ok!("healthy");                         // text/plain; charset=utf-8
ok!("Hello {}!", name);                 // text/plain, formatted
ok!(text: 150);                         // text/plain from anything ToString
ok!(fmt: "Hello, {name}!");             // text/plain, inline captures
ok!(user);                              // application/json from a Serialize value
ok!(json: true);                        // application/json, explicit
ok!({ "status": "healthy", "n": 1 });   // application/json, untyped literal
```

The bare-literal form is meant for **string** literals. `ok!(150)` and
`ok!(true)` also match it; write `ok!(text: 150)` or `ok!(json: true)` to say
which you meant.

`ok!(fmt: ...)` exists because the plain form treats trailing arguments as
`format!` arguments, which collides with the header array. Prefer `fmt:`
whenever a formatted body and custom headers appear together.

### Custom headers — always after a semicolon

```rust
use volga::{headers::WWW_AUTHENTICATE, ok, status};

let (name, id, user) = ("world", "req-1", serde_json::json!({ "ok": true }));

ok!("Hello"; [("x-api-key", "k"), ("x-req-id", "1")]);
ok!([("x-req-id", "1")]);                        // empty body, headers only
ok!(user; [("cache-control", "no-store")]);
ok!(fmt: "Hello, {}", name; [("x-req-id", id)]);
status!(401, "Unauthorized"; [(WWW_AUTHENTICATE, "Basic realm=\"api\"")]);
```

A comma there is the number-one volga compile error. The semicolon is what
keeps the header array from being swallowed as a `format!` argument.

Typed header values work in the array as well:

<!-- snippet: skip -->
```rust
use volga::headers::ContentType;
ok!(body; [ContentType::json()]);
```

### Status codes

<!-- snippet: skip -->
```rust
status!(204);
status!(404; [("x-req-id", "1")]);
status!(422, "validation failed");
status!(422, json: errors);
status!(422, { "error": "validation failed" });
```

`status!` takes a `u16`; a value that is not a valid status silently becomes
`200`, so pass literals or checked values.

### Redirects, files, HTML

<!-- snippet: skip -->
```rust
see_other!("/me");                    // 303
permanent_redirect!("/v2/items");     // 308

use tokio::fs::File as TokioFile;
let name = "report.pdf";
let f = TokioFile::open(name).await?;
file!(name, f);                       // Content-Disposition attachment

html!("<h1>hi</h1>");

let index = "index.html";
html_file!(index, TokioFile::open(index).await?);
```

### Streaming

```rust
use volga::{HttpRequest, stream};

app.map_trace("/", |req: HttpRequest| async move {
    let body = req.into_body().into_data_stream();
    stream!(body; [("content-type", "message/http")])
});
```

## Typed responses without macros

Returning `Json<T>` or `Form<T>` works because they implement
`IntoResponse`:

<!-- snippet: skip -->
```rust
async fn get_user(name: String) -> Form<User> {
    User { name, age: 35 }.into()      // or Form(user)
}
```

## Errors

### A handler's `Err` is an error, never a response (0.12.0+)

A handler returning `Result<T, E>` answers `Ok` with `T`. `Err` is converted
into `volga::error::Error` through `IntoError` and handed to the error
handler — `map_err`, or the default one (status + message as text). `E`
must be `Error` or implement `IntoError`:

| `E` | Status | Default body |
|---|---|---|
| `Error` | its own | message |
| `StatusCode` | that status | canonical reason (`Not Found`) |
| `(StatusCode, E)` — `E` a message or any error | that status | `E`'s message |
| `std::io::Error` | by kind: `NotFound` 404, `PermissionDenied` 403, `AlreadyExists` 409, `InvalidInput`/`InvalidData` 400, else mostly 500 | message |
| `ValidationError`, `OAuthError`, `serde_json::Error`, other volga errors | their own | message |
| `Problem<E>` | the problem's | the problem itself |
| `String`, `&'static str`, `Cow<'static, str>`, `Box<str>` | **500** | message |
| `Box<dyn std::error::Error + Send + Sync>` | 500 | message |
| your type with `impl IntoError` | its choice | its choice |

Integers are not errors: `Err(404)` does not compile — write
`Err(StatusCode::NOT_FOUND)`.

```rust
use volga::{Json, http::StatusCode};

app.map_get("/items/{id}", |id: u32| -> Result<Json<u32>, StatusCode> {
    if id > 100 {
        return Err(StatusCode::NOT_FOUND);
    }
    Ok(Json(id))
});

app.map_get("/users/{name}", |name: String| -> Result<String, (StatusCode, &'static str)> {
    if name.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "name is required"));
    }
    Ok(name)
});
```

**`Err("...")` / `Err(format!(..))` is a `500`.** A message has no status.
For a client error, pair it: `Err((StatusCode::BAD_REQUEST, "..."))`.

The same rule covers the `Err` of `map_err`, `map_fallback`, `with`,
`map_ok` and — with a `400` for strings — a filter (see
`references/middleware.md`).

### An error type of your own

One impl: `IntoError`. It also provides `From<T> for Error`, so `?`
converts the type in any `HttpResult` handler or middleware. **Do not also
write `From<T> for Error`** — it conflicts with the blanket impl (E0119).
A type that has only its own `From<T> for Error` still works with `?` but
cannot be a handler's `Err`: move the body into `into_error`.

```rust
use serde::Serialize;
use volga::{Json, error::{Error, IntoError}, http::StatusCode};

#[derive(Serialize)]
struct ErrorBody { code: &'static str }

enum ApiError { NotFound(u32), Conflict }

impl IntoError for ApiError {
    fn into_error(self) -> Error {
        match self {
            ApiError::NotFound(id) => Error::from_parts(StatusCode::NOT_FOUND, None, format!("no item {id}"))
                .with_response(Json(ErrorBody { code: "not_found" })),
            ApiError::Conflict => Error::from_parts(StatusCode::CONFLICT, None, "taken"),
        }
    }
}

fn find(id: u32) -> Result<Json<u32>, ApiError> {
    if id == 0 { return Err(ApiError::NotFound(id)); }
    if id == 1 { return Err(ApiError::Conflict); }
    Ok(Json(id))
}

app.map_get("/items/{id}", find);
```

### An error that answers with a body of its own

`Error::with_response(resp)` attaches the response the error answers with
(a `Json(..)`, a `Problem`) while it stays an `Error`: `map_err` still sees
its status, message and instance. The attached response takes the error's
status, whatever it was built with. The default handler and
`use_problem_details()` send it unchanged; `has_response()` /
`take_response()` inspect it in a `map_err`. A response that fails to build
is dropped.

### A custom global handler

<!-- snippet: skip -->
```rust
use volga::{App, HttpResult, error::Error, status};

app.map_err(|error: Error| async move {
    tracing::error!(?error, "request failed");
    status!(error.status().as_u16(), "{error:?}")
});

// Log only: returning the error answers as the default handler would,
// attached response included
app.map_err(|error: Error| {
    tracing::warn!(status = %error.status(), "{error}");
    error
});

// Shaping every error — let an attached body through
app.map_err(|error: Error| -> HttpResult {
    if error.has_response() {
        return Err(error);
    }
    status!(error.status().as_u16(), { "error": error.to_string() })
});
```

`status` and `instance` are **methods**, not fields, since 0.9.0.

`map_err` is also available per route and per group; the innermost one wins.

### Errors in OpenAPI

With `openapi`, `Result<T, E>` describes the responses of `T` **and** `E`.
An error type describes itself by overriding `IntoError::describe_openapi`
(default: nothing). The method exists only with volga's `openapi` feature —
gate it with `#[cfg(...)]` if your crate makes that feature optional.

<!-- snippet: skip -->
```rust
fn describe_openapi(config: OpenApiRouteConfig) -> OpenApiRouteConfig {
    config.produces_text(404)
}
```

### Problem Details (feature `problem-details`)

RFC 9457, served as `application/problem+json`:

```rust
use volga::error::Problem;

app.map_get("/problem", || async {
    Problem::new(400)
        .with_detail("Missing parameter")
        .with_instance("/problem")
        .add_param("reason", "id is required")
});
```

`type` and `title` are inferred from the status and can be overridden with
`with_type` / `with_title`; `with_extensions(value)` merges a whole
`Serialize` value into the document.

A `Problem` can also be a handler's `Err`: it goes through `map_err` as an
error (status, `detail`/`title` as the message, `instance`) and answers with
itself. A named `fn` returning `Result<T, Problem>` trips Clippy's
`result_large_err` — return `Result<T, Error>` with `Err(problem.into())`.

```rust
use volga::{Json, error::Problem};

app.map_get("/p/{id}", |id: u64| -> Result<Json<u64>, Problem> {
    if id == 0 {
        return Err(Problem::new(404).with_detail("no item 0"));
    }
    Ok(Json(id))
});
```

To turn every unhandled error into Problem Details globally:

```rust
app.use_problem_details();
```

An error carrying a response of its own (`with_response`, a `Problem` as
`Err`) is sent as it is.

`Problem` is `#[non_exhaustive]` — build it with `Problem::new(..)` and the
builders, never a struct literal. The old `problem!` macro was removed in
0.9.2.

## Handler return-type cheat sheet

| Return type | Result |
|---|---|
| `HttpResult` | the macros' output; `?` works |
| `impl IntoResponse` | fine for infallible handlers |
| `&'static str`, `String` | 200 `text/plain` |
| `i32`, `bool`, … | 200 `text/plain` |
| `Json<T>`, `Form<T>`, `Multipart` | the matching content type |
| `std::io::Error` | mapped through the error pipeline |
| `Result<T, E>`, `E: IntoError` or `Error` | `Ok` rendered, `Err` through the error handler |
| `Result<T, String>` | compiles, but every `Err` is a **500** |
| `Result<T, HttpResponse>` / `Result<T, Json<_>>` | does not compile since 0.12.0 — use `with_response` |
