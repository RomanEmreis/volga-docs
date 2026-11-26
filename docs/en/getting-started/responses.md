# Responses

A handler returns anything that implements [`IntoResponse`](https://docs.rs/volga/latest/volga/http/response/into_response/trait.IntoResponse.html), and Volga turns it into the HTTP response. There are three ways to build one:

* **A plain value**: a string, a number, a `StatusCode`, an `Option`.
* **A typed wrapper**: [`Json<T>`](/volga-docs/en/requests-responses/json-payload.html) or [`Form<T>`](/volga-docs/en/requests-responses/form.html).
* **A response macro** such as `ok!`, `created!` or `not_found!`, when you need a specific status, headers, or a choice between several responses.

Every macro produces an [`HttpResult`](https://docs.rs/volga/latest/volga/http/response/type.HttpResult.html), which is `Result<HttpResponse, Error>`. That makes `HttpResult` the usual return type for a handler that answers in more than one way or uses `?`.

## Returning a Value

```rust compile
use serde::Serialize;
use volga::{App, Json, http::StatusCode};

#[derive(Serialize)]
struct User {
    name: String,
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // 200, text/plain
    app.map_get("/health", || "healthy");

    // 200, text/plain: numbers and bool are sent as text
    app.map_get("/sum/{x}/{y}", |x: i32, y: i32| x + y);

    // 200, application/json
    app.map_get("/me", || Json(User { name: "John".into() }));

    // 204 with an empty body
    app.map_delete("/users/{id}", |_id: u32| StatusCode::NO_CONTENT);

    // `Some` answers with the value, `None` with 404
    app.map_get("/users/{id}", |id: u32| {
        (id == 1).then(|| Json(User { name: "John".into() }))
    });

    app.run().await
}
```

A handler that returns nothing (`()`) answers `200` with an empty body.

## Response Macros

| Macro | Status |
|---|---|
| `ok!` | `200 OK` |
| `created!` | `201 Created` |
| `accepted!` | `202 Accepted` |
| `no_content!` | `204 No Content` |
| `bad_request!` | `400 Bad Request` |
| `not_found!` | `404 Not Found` |
| `status!(code, ...)` | any status |
| `redirect!`, `found!`, `see_other!`, `temp_redirect!`, `permanent_redirect!` | `301`, `302`, `303`, `307`, `308`, with `Location` set |
| `html!`, `html_file!` | `200`, `text/html` |
| `file!` | `200`, a [file download](/volga-docs/en/requests-responses/files.html) |
| `form!` | `200`, `application/x-www-form-urlencoded` |
| `stream!` | `200`, a [streamed body](/volga-docs/en/requests-responses/body.html) |
| `sse!`, `sse_stream!` | `200`, [Server-Sent Events](/volga-docs/en/protocols-realtime/sse.html) |

```rust compile
use serde::Serialize;
use volga::{App, HttpResult, created, not_found, ok};

#[derive(Serialize)]
struct User {
    id: u32,
    name: String,
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/users/{id}", get_user);
    app.map_post("/users/{name}", |name: String| {
        created!(User { id: 2, name })
    });

    app.run().await
}

async fn get_user(id: u32) -> HttpResult {
    match id {
        1 => ok!(User { id, name: "John".into() }),
        _ => not_found!("no user {id}"),
    }
}
```

### Text or JSON

`ok!`, `created!`, `accepted!`, `bad_request!`, `not_found!` and `status!` read their argument the same way:

```rust
ok!();                                // empty body, no Content-Type
ok!("healthy");                       // text/plain
ok!("Hello, {name}!");                // text/plain, formatted
ok!("Hello, {}!", name);              // text/plain, formatted
ok!(user);                            // application/json
ok!({ "status": "healthy" });         // application/json, written inline
ok!(text: name);                      // text/plain, anything that converts into a body
ok!(json: name);                      // application/json, said explicitly
```

The rule is the **form** of the argument, not its type. A string literal is text, and any other expression is serialized as JSON. So a `String` variable becomes a JSON string:

```rust
let name = String::from("John");
ok!(name);            // "John" (with quotes), application/json
ok!(text: name);      // John, text/plain
ok!("{name}");        // John, text/plain
```

::: tip
For numbers and `bool`, say what you mean with `text:` or `json:`: `ok!(text: 150)`, `ok!(json: true)`.
:::

### Headers

Headers go after a **semicolon**, as an array of pairs or typed headers:

```rust
ok!("Hello"; [("x-request-id", "42")]);
ok!([("x-request-id", "42")]);                      // headers, no body
ok!(user; [("cache-control", "no-store")]);
ok!(fmt: "Hello, {}!", name; [("x-request-id", id)]);
status!(401, "Unauthorized"; [(WWW_AUTHENTICATE, "Bearer")]);
```

With a comma instead of the semicolon, the array is read as a `format!` argument and the code does not compile. When a formatted body comes with headers, use the `fmt:` form, as in the fourth line.

### Any Status

`status!` takes the status as a number, then a body in the same forms as `ok!`:

```rust
status!(204);
status!(409, "already exists");
status!(422, { "error": "name is required" });
status!(503; [("retry-after", "30")]);
```

## Redirects and HTML

```rust compile
use volga::{App, html, see_other};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/", || html!("<h1>Hello</h1>"));
    app.map_post("/login", || see_other!("/me"));

    app.run().await
}
```

## Errors

A handler that can fail returns `Result<T, E>`. `Ok` is answered like any other response, and `Err` goes to the error handler, which decides what the client sees:

```rust compile
use volga::{App, Json, http::StatusCode};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/items/{id}", |id: u32| -> Result<Json<u32>, StatusCode> {
        if id > 100 {
            return Err(StatusCode::NOT_FOUND);
        }
        Ok(Json(id))
    });

    app.run().await
}
```

Which types can be an `Err`, how to define an error type of your own and how to shape every error in one place is covered in [Error Handling](/volga-docs/en/reliability-observability/errors.html).

::: warning
A bare string has no status: `Err("not found")` answers `500`. Give it one: `Err((StatusCode::NOT_FOUND, "not found"))`.
:::
