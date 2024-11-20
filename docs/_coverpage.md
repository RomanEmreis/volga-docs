![logo](_media/icon.svg)

# Volga <small>0.3.1</small>

Fast, Easy, and very flexible Web Framework for Rust based on [Tokio](https://tokio.rs/) runtime and [hyper](https://hyper.rs/) for fun and painless microservices crafting.

- Supports HTTP/1 and HTTP/2
- Robust routing
- Custom middlewares
- Full Tokio compatibility
- Runs on stable Rust 1.80+

```rust
use volga::{App, ok, AsyncEndpointsMapping, Params};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    // Start the server
    let mut app = App::build("127.0.0.1:7878").await?;

    // Example of asynchronous request handler
    app.map_get("/hello/{name}", |req| async {
        let name = req.param("name")?;
        ok!("Hello {}!", name)
    });
    
    app.run().await
}
```

[GitHub](https://github.com/RomanEmreis/volga)
[Get Started](/getting-started/quick-start.md)