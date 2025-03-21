# CORS (Cross-Origin Resource Sharing)

Volga provides an easily configurable [CORS](https://developer.mozilla.org/docs/Web/HTTP/CORS) middleware.

It is included in the `full` feature set. However, if you are not using it, you can enable the `middleware` feature in your `Cargo.toml` to make CORS functionality available:

```toml
[dependencies]
volga = { version = "0.5.5", features = ["middleware"] }
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

A complete example is available [here](https://github.com/RomanEmreis/volga/blob/main/examples/cors.rs).