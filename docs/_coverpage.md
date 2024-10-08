![logo](_media/icon.svg)

# Volga <small>0.1.5</small>

> Fast & Easy Web Framework for Rust based on Tokio runtime for fun and painless microservices crafting.

- Supports HTTP/1.x
- Robust routing
- Custom middlewares
- Full Tokio compatibility
- Runs on stable Rust 1.80+

```rust
use volga::{App, Results, AsyncEndpointsMapping};

#[tokio::main]
async fn main() -> tokio::io::Result<()> {
    // Start the server
    let mut server = App::build("127.0.0.1:7878").await?;

    // Example of asynchronous request handler
    server.map_get("/hello", |request| async {
        Results::text("Hello World!")
    }).await;
    
    server.run().await
}
```

[GitHub](https://github.com/RomanEmreis/volga)
[Get Started](/getting-started/quick-start.md)