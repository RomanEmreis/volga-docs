# Global Error Handling

Volga provides a global error handling mechanism that catches all [`Error`](https://doc.rust-lang.org/std/error/trait.Error.html) values that may occur in request handlers and middleware. This can be easily achieved using the [`map_err`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_err) method of the [`App`](https://docs.rs/volga/latest/volga/app/struct.App.html) to register a function that handles errors.  

The function receives an [`Error`](https://docs.rs/volga/latest/volga/error/struct.Error.html) object and should return a response that implements the [`IntoResponse`](https://docs.rs/volga/latest/volga/http/response/into_response/trait.IntoResponse.html) trait. Like a request handler, it can be [asynchronous or synchronous](/volga-docs/en/getting-started/handlers.html).

### Example:
```rust compile
use volga::{App, error::Error, status};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();
    
    app.map_get("/error", || async {
        std::io::Error::other("some error")
    });

    // Enabling global error handler
    app.map_err(|error: Error| async move {
        status!(error.status().as_u16(), "{:?}", error)
    });

    app.run().await
}
```
In this example, we intentionally create a request handler that produces an error, and define an error handler that answers with the error's status and message. [`status()`](https://docs.rs/volga/latest/volga/error/struct.Error.html#method.status) is the status the error carries: `500` for this one, `404` for a path no route answers, `401` for a refused token.

::: warning Answer with the error's own status
The error handler answers every error, including the [requests Volga refuses itself](#errors-volga-produces-itself). One that answers with a fixed status, such as `status!(500, ..)`, turns every `401`, `404`, `405` and `429` into a `500`.
:::

In fact, this is how the default error handler is implemented — except that an error [carrying a response of its own](#answering-with-a-body-of-its-own) answers with that response. If we remove the [`map_err`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_err) method, the response remains unchanged. However, defining a custom error handler offers greater flexibility for advanced logging and tracing.  

A handler that only needs to look at an error can return it as it came: the error is then answered exactly as the default handler would answer it.

```rust compile-fragment
use volga::error::Error;

app.map_err(|error: Error| {
    eprintln!("{} {error}", error.status());
    error
});
```

## Returning Errors from a Handler

A handler that can fail returns `Result<T, E>`. `Ok` answers with `T`, as any other response does. An `Err` is an error, not a second kind of response: it is turned into an [`Error`](https://docs.rs/volga/latest/volga/error/struct.Error.html) through the [`IntoError`](https://docs.rs/volga/latest/volga/error/trait.IntoError.html) trait and handed to the error handler — the one registered with `map_err`, or the default one — exactly like an error from anywhere else.

```rust compile
use volga::{App, Json, http::StatusCode};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // GET /items/7   -> 200 7
    // GET /items/500 -> 404 Not Found
    app.map_get("/items/{id}", |id: u32| -> Result<Json<u32>, StatusCode> {
        if id > 100 {
            return Err(StatusCode::NOT_FOUND);
        }
        Ok(Json(id))
    });

    // GET /users/<a name longer than 32 characters> -> 400 name is too long
    app.map_get("/users/{name}", |name: String| -> Result<String, (StatusCode, &'static str)> {
        if name.len() > 32 {
            return Err((StatusCode::BAD_REQUEST, "name is too long"));
        }
        Ok(format!("Hello, {name}!"))
    });

    app.run().await
}
```

What the `Err` can be, and what the default error handler answers with:

| `E` | Status | Body |
|---|---|---|
| `Error` | its own | its message |
| `StatusCode` | that status | its canonical reason, e.g. `Not Found` |
| `(StatusCode, E)`, where `E` is a message or any error | that status | `E`'s message |
| `std::io::Error` | by its kind: `NotFound` → `404`, `PermissionDenied` → `403`, `AlreadyExists` → `409`, `InvalidInput` → `400`, most others → `500` | its message |
| volga's own errors — `ValidationError`, `OAuthError`, `serde_json::Error` and the rest | their own | their message |
| `Problem<E>` (feature `problem-details`) | the problem's | the [problem itself](#returning-a-problem-as-the-error) |
| `String`, `&'static str`, `Cow<'static, str>`, `Box<str>` | `500` | the message |
| `Box<dyn std::error::Error + Send + Sync>` | `500` | its message |
| a type of your own implementing `IntoError` | whatever it decides | see [below](#error-types-of-your-own) |

Integers are left out on purpose: `Err(404)` reads as a status and as an application's error code alike, so it does not compile. `Err(StatusCode::NOT_FOUND)` says the same thing and is checked by the compiler.

::: warning A message on its own is a 500
A string carries no status, so `Err("name is required")` or `Err(format!(..))` answers `500 Internal Server Error`. Give a client error its status: `Err((StatusCode::BAD_REQUEST, "name is required"))`.
:::

Since the error goes through the error handler, everything `map_err` does — logging, [Problem Details](#global-error-handling-with-problem-details), a JSON envelope of your own — applies to it as well. The same goes for the `Err` returned from `map_fallback`, `map_err` itself, the [`with`](/volga-docs/en/middleware-infrastructure/middlewares.html) and [`map_ok`](/volga-docs/en/middleware-infrastructure/middleware.html#handling-successful-responses) middleware, and — with one difference — from a [filter](/volga-docs/en/middleware-infrastructure/middleware.html#what-a-filter-returns).

### Error Types of Your Own

An application's error type becomes a handler's `Err` with a single impl — [`IntoError`](https://docs.rs/volga/latest/volga/error/trait.IntoError.html). It decides the status and the message, and it also gives `From<T> for Error`, so `?` converts the type wherever an `Error` is expected: in a handler returning `HttpResult`, in middleware.

```rust compile
use serde::Serialize;
use std::num::ParseIntError;
use volga::{App, Json, error::{Error, IntoError}, http::StatusCode};

enum ApiError {
    NotFound(u32),
    BadId(ParseIntError),
}

// Lets `?` turn a parse failure into an `ApiError`
impl From<ParseIntError> for ApiError {
    fn from(err: ParseIntError) -> Self {
        Self::BadId(err)
    }
}

#[derive(Serialize)]
struct ErrorBody {
    code: &'static str,
    message: String,
}

impl IntoError for ApiError {
    fn into_error(self) -> Error {
        let (status, code, message) = match self {
            ApiError::NotFound(id) => (StatusCode::NOT_FOUND, "not_found", format!("no item {id}")),
            ApiError::BadId(err) => (StatusCode::BAD_REQUEST, "bad_id", err.to_string()),
        };
        let body = Json(ErrorBody { code, message: message.clone() });

        // The status and the message are what `map_err` reads; the body is what the client gets
        Error::from_parts(status, None, message).with_response(body)
    }
}

fn get_item(id: String) -> Result<Json<u32>, ApiError> {
    let id: u32 = id.parse()?;
    if id > 100 {
        return Err(ApiError::NotFound(id));
    }
    Ok(Json(id))
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // GET /items/7   -> 200 7
    // GET /items/abc -> 400 {"code":"bad_id","message":"invalid digit found in string"}
    // GET /items/500 -> 404 {"code":"not_found","message":"no item 500"}
    app.map_get("/items/{id}", get_item);

    app.run().await
}
```

::: tip Implement `IntoError`, not `From`
`From<T> for Error` comes with `IntoError` through a blanket impl, so a type implementing both is a conflict (`E0119`). A type that has only a `From<T> for Error` of its own still converts with `?`, but it cannot be a handler's `Err` — move the body of its `from` into `into_error`.
:::

### Answering With a Body of Its Own

[`Error::with_response()`](https://docs.rs/volga/latest/volga/error/struct.Error.html#method.with_response) attaches the response an error answers with — a JSON body, a `Problem` — and the error stays an error: `map_err` still receives it, with its status, message and instance as they were.

* The attached response takes the error's status, whatever status it was built with, so passing a body alone — a `Json(..)` value — is enough.
* The default error handler and [`map_problem()`](#global-error-handling-with-problem-details) send it unchanged.
* A response that fails to build is dropped, and the error answers as it would have without it.

In a `map_err` of your own, [`has_response()`](https://docs.rs/volga/latest/volga/error/struct.Error.html#method.has_response) tells whether an error carries a response, and [`take_response()`](https://docs.rs/volga/latest/volga/error/struct.Error.html#method.take_response) takes it out. A handler that shapes every error its own way should decide what to do with one — here, it lets the attached body through and wraps everything else:

```rust compile-fragment
use volga::{HttpResult, error::Error, status};

app.map_err(|error: Error| -> HttpResult {
    if error.has_response() {
        // Answered as the default handler would: with the attached response
        return Err(error);
    }
    status!(error.status().as_u16(), { "error": error.to_string() })
});
```

### Describing Errors in OpenAPI

With the `openapi` feature a route whose handler returns `Result<T, E>` is described with the responses of `T` and of `E`. An error type says what it answers with by overriding [`IntoError::describe_openapi()`](https://docs.rs/volga/latest/volga/error/trait.IntoError.html#method.describe_openapi). The default describes nothing, which suits most errors: the error handler decides how they look, and the status of one is known only when it happens.

```rust compile
use volga::{error::{Error, IntoError}, http::StatusCode, openapi::OpenApiRouteConfig};

struct NotFound;

impl IntoError for NotFound {
    fn into_error(self) -> Error {
        Error::from_parts(StatusCode::NOT_FOUND, None, "not found")
    }

    fn describe_openapi(config: OpenApiRouteConfig) -> OpenApiRouteConfig {
        config.produces_text(404)
    }
}
```

`describe_openapi` exists only while Volga's `openapi` feature is on. If your crate enables that feature through a feature of its own, put the same `#[cfg(feature = "..")]` on the method. See [OpenAPI](/volga-docs/en/middleware-infrastructure/openapi.html) for the rest.

## Errors Volga Produces Itself

A request Volga refuses on its own reaches the error handler too, as an error with its status. Some of these errors carry headers, which stay on whatever response the handler answers with:

| Refused by | Status | Error headers |
|---|---|---|
| An extractor that cannot read the request: a body or a parameter that does not parse, a missing header | `400` | |
| A body over the [limit](/volga-docs/en/requests-responses/body.html#limiting-the-body-size) | `413` | |
| The router: a path nothing answers | `404` | |
| The router: a method the path does not have | `405` | `Allow` |
| [`authorize`](/volga-docs/en/security-access/auth.html#how-a-rejected-request-is-answered) | `400`, `401`, `403`, `503` | `WWW-Authenticate`, `Cache-Control: no-store` |
| [Rate limiting](/volga-docs/en/middleware-infrastructure/rate-limiting.html) | `429` | |
| [Static files](/volga-docs/en/middleware-infrastructure/static-files.html): a directory without listing, a path outside the content root | `403` | |
| Static files: no fallback file configured | `404` | |
| [Compression](/volga-docs/en/middleware-infrastructure/compression.html): nothing in `Accept-Encoding` the server can produce | `406` | `Vary`, `Accept-Encoding` |

So `map_err` and `map_problem` shape all of them, and a client of an API that answers with problem details gets them on a `401`, a `404` or a `429` too. The default handler answers with the error's message as a text body: the reason phrase for the router's `404` and `405`, and the challenge's description for `authorize`.

```rust compile
use volga::{App, HttpResult, error::Error, status};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/items/{id}", |id: u32| id);

    // GET /nope      -> 404 {"error":"Not Found"}
    // POST /items/1  -> 405 {"error":"Method Not Allowed"}, with `Allow: GET`
    app.map_err(|error: Error| -> HttpResult {
        status!(error.status().as_u16(), { "error": error.to_string() })
    });

    app.run().await
}
```

What is not a refusal stays a response: a CORS preflight's `204`, a static file's `304`, the HTTPS redirect and the answer to an implicit `HEAD`. [`map_ok()`](/volga-docs/en/middleware-infrastructure/middleware.html#handling-successful-responses) sees successful responses only, so a change to how a `404` looks goes into `map_err`, or into [`map_fallback`](#the-fallback-handler) for a path nothing answers.

## Headers on an Error

[`Error::with_header()`](https://docs.rs/volga/latest/volga/error/struct.Error.html#method.with_header) adds a header to whatever response the error is answered with: by the default handler, by `map_problem`, or by a handler of your own. A protocol header, such as a challenge or an `Allow`, then reaches the client even through `map_err(|e: Error| status!(..))`:

```rust compile
use volga::{App, error::Error, headers::WWW_AUTHENTICATE, http::StatusCode, status};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // 401 with `WWW-Authenticate: Basic realm="admin"`, whatever `map_err` answers with
    app.map_get("/admin", || {
        Err::<(), _>(
            Error::from(StatusCode::UNAUTHORIZED)
                .with_header((WWW_AUTHENTICATE, r#"Basic realm="admin""#)),
        )
    });

    app.map_err(|error: Error| status!(error.status().as_u16(), "{error}"));

    app.run().await
}
```

* A header the response sets itself wins.
* [`headers()`](https://docs.rs/volga/latest/volga/error/struct.Error.html#method.headers) reads them in a handler of your own.
* A handler that answers with the error itself passes it on with its headers, and they are added once, where the error is answered in the end.
* They are added to a response [attached with `with_response()`](#answering-with-a-body-of-its-own) as well.

Volga's own errors use the same mechanism: the challenge of `authorize`, the `Allow` of a `405`, and the [CORS headers](/volga-docs/en/middleware-infrastructure/cors.html) of an error response.

## Error Handlers of a Route or a Group

`map_err()` and `map_problem()` on a [route](https://docs.rs/volga/latest/volga/app/router/struct.Route.html#method.map_err) or a [group](/volga-docs/en/getting-started/route-groups.html) handle the errors of that scope: its handlers, its middleware, its filters, `authorize`. They do so whatever order they were registered in:

```rust compile
use volga::{App, error::Error, headers::HttpHeaders, status};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.group("/api", |api| {
        // Problem details for everything under /api, the filter's 400 included
        api.map_problem();
        api.filter(|headers: HttpHeaders| headers.get_raw("x-api-key").is_some());
        api.map_get("/items", || "items");
    });

    // Plain text for the rest of the application
    app.map_err(|error: Error| status!(error.status().as_u16(), "{error}"));

    app.run().await
}
```

* **A scope has one error handler.** A second `map_err` or `map_problem` replaces the first, as on `App`.
* **An error passes outwards.** A scoped handler that answers with the error itself hands it to the group around it, and then to `App::map_err`.
* **What runs outside every scope** — the global middleware and the application's fallback — reaches `App::map_err` alone.

## The Fallback Handler

[`map_fallback()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_fallback) registers the handler that answers a request no route matched. It takes the same arguments [`map_err()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_err) does — extractors of the head: headers, the URI, cookies, [`ClientIp`](https://docs.rs/volga/latest/volga/struct.ClientIp.html), [`Dc<T>`](https://docs.rs/volga/latest/volga/di/dc/struct.Dc.html), an [extractor of your own](/volga-docs/en/advanced-patterns/custom-extractors.html). Not the body: nothing matched, so there is no route to say how a body should be read, and path parameters are out for the same reason.

```rust compile
use volga::{App, ClientIp, http::Uri, error::Error, not_found, status};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_fallback(|uri: Uri, ip: ClientIp| async move {
        not_found!("no route for {uri} (from {ip})")
    });

    // An error out of the fallback lands here, like any other
    app.map_err(|error: Error| async move {
        status!(error.status().as_u16(), "{:?}", error)
    });

    app.run().await
}
```

A fallback runs inside a full per-request scope, so it takes the same extractors any other handler takes — `ClientIp`, `CancellationToken`, `Config<T>`, `HostEnv`, `Dc<T>` — and the application's request body limit applies to it. A [group's fallback](/volga-docs/en/getting-started/route-groups.html#a-fallback-for-the-group) takes the group's limit instead. An error it returns is answered by the application's `map_err` handler, as an error from any other handler is, so a service that shapes its errors shapes them here too.

### One Fallback per Part of the API

One handler for every unknown path in the application is often one too few: an API wants JSON and a browser-facing SPA wants its shell. A [route group](/volga-docs/en/getting-started/route-groups.html#a-fallback-for-the-group) carries a fallback of its own, and the router picks the deepest prefix that has one:

```rust compile
use volga::{App, http::Uri, error::Problem, not_found};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.group("/api", |api| {
        // Everything unknown under /api answers in the API's own shape
        api.map_fallback(|uri: Uri| async move {
            let problem: Problem = Problem::new(404)
                .with_detail("No endpoint at this path")
                .with_instance(uri.path());
            problem
        });
    });

    // Everything else
    app.map_fallback(|| async { not_found!("not found") });

    app.run().await
}
```

The group's middleware — `authorize`, a rate limiter, a request-id `tap_req` — runs around its fallback as it runs around its routes, so an unknown path behind authentication is refused rather than listed.

`Problem` carries its extensions as a type parameter, so the annotation is what picks the default map up — one built with [`with_extensions()`](https://docs.rs/volga/latest/volga/error/problem/struct.Problem.html#method.with_extensions) needs none.

## Problem Details

Volga fully supports the [Problem Details](https://www.rfc-editor.org/rfc/rfc9457) format, which provides machine-readable error details in HTTP responses. This eliminates the need to define custom error formats for HTTP APIs.  

To enable this functionality, ensure that the `problem-details` feature is activated in your app's `Cargo.toml`:
```toml
[dependencies]
volga = { version = "0.15", features = ["problem-details"] }
```
Then, you may return the [`Problem`](https://docs.rs/volga/latest/volga/error/problem/struct.Problem.html) from request handler:
```rust compile
use volga::{App, error::Problem};
use serde::Serialize;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/problem", || async {
        // Always producing the problem

        Problem::new(400)
            .with_detail("Missing Parameter")
            .with_instance("/problem")
            .with_extensions(ValidationError {
                invalid_params: vec![InvalidParam { 
                    name: "id".into(), 
                    reason: "The ID must be provided".into()
                }]
            })
    }); 

    app.run().await
}

#[derive(Default, Serialize)]
struct ValidationError {
    #[serde(rename = "invalid-params")]
    invalid_params: Vec<InvalidParam>,
}

#[derive(Default, Serialize)]
struct InvalidParam {
    name: String,
    reason: String,
}
```
### Example Response:
```json
HTTP/1.1 400 Bad Request
Content-Type: application/problem+json

{
    "type": "https://tools.ietf.org/html/rfc9110#section-15.5.1",
    "title": "Bad Request",
    "status": 400,
    "detail": "Missing Parameter",
    "instance": "/problem",
    "invalid-params": [
        { "name": "id", "reason": "The ID must be provided" }
    ]
}
```

### Returning a Problem as the Error

A `Problem` can also be the `Err` of a handler's `Result`. It answers with itself, as it would as the `Ok` value, but it travels as an error first: the error carries the problem's status, its `detail` (or `title`) as the message and its `instance`, and a `map_err` handler can answer with something else.

```rust compile
use volga::{App, Json, error::Problem};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/items/{id}", |id: u64| -> Result<Json<u64>, Problem> {
        if id == 0 {
            return Err(Problem::new(404).with_detail("no item 0"));
        }
        Ok(Json(id))
    });

    app.run().await
}
```

::: tip Keep the Err small
`Problem` is a large value, so a named function returning `Result<T, Problem>` trips Clippy's [`result_large_err`](https://rust-lang.github.io/rust-clippy/master/index.html#result_large_err). Return `Result<T, Error>` and write `Err(problem.into())` instead — the client gets the same answer, and an `Error` takes 32 bytes on a 64-bit target.
:::

## Global Error Handling With Problem Details

Moreover, you can combine the [`Problem`](https://docs.rs/volga/latest/volga/error/problem/struct.Problem.html) with [`map_err`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_err) by using the [`map_problem()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_problem) method:
```rust compile
use volga::{App, error::Error};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();
    
    app.map_get("/error", || async {
        // Always producing the error 
        // that will be converted into Problem Details

        std::io::Error::other("some error")
    });

    // Enabling global error handler that produces
    // error responses in Problem details format
    app.map_problem();

    app.run().await
}
```

`map_problem()` is `map_err` with a handler of volga's own, so whichever of the two is called last handles the errors: `app.map_err(h); app.map_problem();` replaces `h`. A `Route` and a `RouteGroup` have a `map_problem()` of their own, for the [errors of their scope](#error-handlers-of-a-route-or-a-group).

### Example Response:
```json
HTTP/1.1 500 Internal Server Error
Content-Type: application/problem+json

{
    "type": "https://tools.ietf.org/html/rfc9110#section-15.6.1",
    "title": "Internal Server Error",
    "status": 500,
    "detail": "some error",
    "instance": "/error"
}
```

An error that [carries a response of its own](#answering-with-a-body-of-its-own) — a `Problem` returned as `Err` among them — is sent as it is rather than described again.

The `type` and `title` fields are inferred from the status code but can be overridden:  
```rust
Problem::new(400)
    .with_type("https://tools.ietf.org/html/rfc9110#section-15.6.1")
    .with_title("Server Error");
```
Additionally, you can include extra details if needed:  
```rust
Problem::new(400)
    .with_detail("Missing Parameter")
    .with_instance("/problem")
    .with_extensions(ValidationError {
        invalid_params: vec![InvalidParam { 
            name: "id".into(), 
            reason: "The ID must be provided".into()
        }]
    })
```
or
```rust
Problem::new(400)
    .with_detail("Missing Parameter")
    .with_instance("/problem")
    .add_param("reason", "The ID must be provided");
```

For a complete example, see the full implementation:
- [Global Error Handling](https://github.com/RomanEmreis/volga/blob/main/examples/global_error_handler/src/main.rs).
- [Problem Details](https://github.com/RomanEmreis/volga/blob/main/examples/problem_details/src/main.rs)
