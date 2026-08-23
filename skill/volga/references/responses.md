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
    let user = load().await?;   // errors become responses
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

Any `std::error::Error` returned from a handler becomes a response. The
default handler maps it onto `Error::status()` with the message as the body.

```rust
app.map_get("/error", || async { std::io::Error::other("boom") });
```

### A custom global handler

<!-- snippet: skip -->
```rust
use volga::{App, error::Error, status};

app.map_err(|error: Error| async move {
    tracing::error!(?error, "request failed");
    status!(error.status().as_u16(), "{error:?}")
});
```

`status` and `instance` are **methods**, not fields, since 0.9.0.

`map_err` is also available per route and per group; the innermost one wins.

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

To turn every unhandled error into Problem Details globally:

```rust
app.use_problem_details();
```

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
| `Result<T, volga::error::Error>` | `Ok` rendered, `Err` through the pipeline |
