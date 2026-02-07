# CORS (Cross-Origin Resource Sharing)

Volga provides an easily configurable [CORS](https://developer.mozilla.org/docs/Web/HTTP/CORS) middleware.

It is included in the `full` feature set. However, if you are not using it, you can enable the `middleware` feature in your `Cargo.toml` to make CORS functionality available:

```toml
[dependencies]
volga = { version = "...", features = ["middleware"] }
```

## Basic Setup

The following example demonstrates a permissive CORS configuration:

```rust
use volga::App;

#[tokio::main]
async fn main() -> std::io::Result<()> {   
    let mut app = App::new()
        .with_cors(|cors| cors
            .with_any_origin()
            .with_any_header()
            .with_any_method());

    // Enable CORS middleware
    app.use_cors();

    app.map_post("/", || async {});

    app.run().await
}
```

By default, CORS is disabled. To avoid a runtime panic, you must call [`with_cors()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.with_cors) before [`use_cors()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.use_cors). 

If you need a stricter configuration, you can specify allowed origins, headers, and methods:

```rust
use volga::{App, http::Method};

#[tokio::main]
async fn main() -> std::io::Result<()> {   
    let mut app = App::new()
        .with_cors(|cors| cors
            .with_origins(["http://example.com", "http://example.net"])
            .with_headers(["Cache-Control", "Content-Language"])
            .with_methods([Method::GET, Method::POST]));

    // Enable CORS middleware
    app.use_cors();

    app.map_post("/", || async {});

    app.run().await
}
```

:::warning
If you need to enable credentials using [`with_credentials(true)`](https://docs.rs/volga/latest/volga/http/cors/struct.CorsConfig.html#method.with_credentials), note that it **cannot** be used with wildcard origins, headers, or methods for security reasons. These constraints are validated in [`use_cors()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.use_cors), which will panic if misconfigured.
:::

## CORS Policies and Scoping

Volga separates **CORS configuration** from **where it is applied**:

* [`with_cors()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.with_cors) defines one or more CORS policies.
* [`use_cors()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.use_cors) enables the CORS middleware (required).
* CORS is applied based on:

  * a **default policy** (applies to all routes unless overridden), or
  * a **named policy** (applies only where explicitly specified).

### Named Policy for a Route Group

If you configure only a named policy, routes will **not** get CORS unless you explicitly attach that policy via [`cors_with(...)`](https://docs.rs/volga/latest/volga/app/router/struct.Route.html#method.cors_with).

```rust
use volga::App;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new()
        .with_cors(|cors| cors
            .with_name("policy")
            .with_origins(["https://example.com"])
            .with_any_header()
            .with_any_method());

    // Enable the middleware (required)
    app.use_cors();

    app.group("/api", |api| {
        // Apply CORS only for `/api/*`
        api.cors_with("policy");

        api.map_get("/users", || async {});
        api.map_post("/posts", || async {});
    });

    // No CORS here (policy not applied)
    app.map_get("/internal", || async {});

    app.run().await
}
```

### Named Policy for an Individual Route

You can attach a policy to a single endpoint:

```rust
use volga::App;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new()
        .with_cors(|cors| cors
            .with_name("permissive")
            .with_any_origin()
            .with_any_method()
            .with_any_header());

    app.use_cors();

    app.map_get("/public", || async {})
        .cors_with("permissive");

    app.map_get("/private", || async {})
        .disable_cors();

    app.run().await
}
```

:::warning
When using only named policies, endpoints without an explicitly attached policy will not emit CORS headers.
:::

### Overriding and Disabling

CORS can be explicitly disabled on a route (or group) using [`disable_cors()`](https://docs.rs/volga/latest/volga/app/router/struct.Route.html#method.disable_cors).
This is especially useful when you have a **default** policy enabled globally, but need to opt out for specific endpoints.

A complete example is available [here](https://github.com/RomanEmreis/volga/blob/main/examples/cors/src/main.rs).