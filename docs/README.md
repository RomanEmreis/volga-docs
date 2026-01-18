# Volga

Fast, easy, and flexible web framework for Rust, built on the [Tokio](https://tokio.rs/) runtime and [hyper](https://hyper.rs/) for building HTTP APIs and microservices.

## Getting Started
```toml
[dependencies]
volga = { version = "..." }
tokio = { version = "...", features = ["full"] }
```
```rust
use volga::*;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    // Configure the HTTP server
    let mut app = App::new().bind("localhost:7878");

    // Configure the GET request handler
    app.map_get("/hello/{name}", async |name: String| {
        ok!("Hello {}!", name)
    });
    
    // Run the server
    app.run().await
}
```


<div align="center">

<a href="https://romanemreis.github.io/volga-docs/basics/quick-start.html" style="display: inline-block; padding: 10px 20px; background-color: #299764; color: #fff; text-decoration: none; border-radius: 25px; font-family: Arial, sans-serif; font-size: 16px; text-align: center;">
  <span>Learn More</span>
</a>

</div>
