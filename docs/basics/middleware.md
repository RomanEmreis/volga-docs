# Basic Middleware

Volga provides several tools to help you build middleware pipelines, whether for individual routes, route groups, or the entire application.

## Enabling Middleware

If you're not using the `full` feature set, make sure to explicitly enable the `middleware` feature in your `Cargo.toml`:

```toml
[dependencies]
volga = { version = "0.6.0", features = ["middleware"] }
```

## Filters

The [`filter()`](https://docs.rs/volga/latest/volga/app/router/struct.Route.html#method.filter) method allows you to define conditional logic (such as validation or access control) for a specific route or a group of routes.

```rust
use volga::App;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // Allow only positive numbers
    app
        .map_group("/positive")
        .filter(|x: i32, y: i32| async move { x >= 0 && y >= 0 })
        .map_get("/sum/{x}/{y}", sum);
    
    // Allow only negative numbers
    app
        .map_get("/negative/sum/{x}/{y}", sum)
        .filter(|x: i32, y: i32| async move { x < 0 && y < 0 });

    app.run().await
}

async fn sum(x: i32, y: i32) -> i32 {
    x + y
}
```

## Handling Incoming Requests

The [`tap_req()`](https://docs.rs/volga/latest/volga/app/router/struct.Route.html#method.tap_req) method gives you access to the [`HttpRequest`](https://docs.rs/volga/latest/volga/http/request/struct.HttpRequest.html), allowing you to inspect or mutate it before request processing.

```rust
use volga::{App, HttpRequest, headers::HeaderValue};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app
        .map_get("/sum", |x: i32, y: i32| async move { x + y })
        .tap_req(|mut req: HttpRequest| async move { 
            req.headers_mut()
                .insert("X-Custom-Header", HeaderValue::from_static("Custom Value"));
            req
        });

    app.run().await
}
```

## Handling Successful Responses

Use the [`map_ok()`](https://docs.rs/volga/latest/volga/app/router/struct.Route.html#method.map_ok) method to transform or augment successful HTTP responses.

```rust
use volga::{App, HttpResponse, headers::HeaderValue};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app
        .map_group("/positive")
        .map_ok(group_response)
        .map_get("/sum/{x}/{y}", sum);

    app
        .map_get("/negative/sum/{x}/{y}", sum)
        .map_ok(route_response);

    app.run().await
}

async fn group_response(mut resp: HttpResponse) -> HttpResponse {
    resp.headers_mut()
        .insert("x-custom-header", HeaderValue::from_static("for-group"));
    resp
}

async fn route_response(mut resp: HttpResponse) -> HttpResponse {
    resp.headers_mut()
        .insert("x-custom-header", HeaderValue::from_static("for-route"));
    resp
}

async fn sum(x: i32, y: i32) -> i32 {
    x + y
}
```

## Handling Errors

The [`map_err()`](https://docs.rs/volga/latest/volga/app/router/struct.Route.html#method.map_err) method lets you define custom error handlers - globally, per route, or for route groups.

```rust
use volga::{App, HttpResult, error::Error, problem};
use std::io::Error as IoError;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();
    
    app
        .map_get("/error", produce_err)
        .map_err(handle_err);

    app.run().await
}

async fn handle_err(error: Error) -> HttpResult {
    let (status, instance, err) = error.into_parts();
    problem! {
        "status": status.as_u16(),
        "detail": err.to_string(),
        "instance": instance,
    }
}

async fn produce_err() -> IoError {
    IoError::other("some error")
}
```

::: tip
By attaching [`map_err()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_err) to the [`App`](https://docs.rs/volga/latest/volga/app/struct.App.html), you configure a global error handler. You can read more about advanced error handling [here](/volga-docs/advanced/errors).
:::

## Examples
* [Request filter example](https://github.com/RomanEmreis/volga/blob/main/examples/request_validation.rs)
* [Response handler example](https://github.com/RomanEmreis/volga/blob/main/examples/response_handler.rs)
