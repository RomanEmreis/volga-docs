# Volga

Fast, Easy, and very flexible Web Framework for Rust based on [Tokio](https://tokio.rs/) runtime and [hyper](https://hyper.rs/) for fun and painless microservices crafting.

[<img src="https://gist.github.com/cxmeel/0dbc95191f239b631c3874f4ccf114e2/raw/github_source.svg" alt="GitHub Source" />]([https://crates.io/crates/volga](https://github.com/RomanEmreis/volga))
[<img src="https://gist.github.com/cxmeel/0dbc95191f239b631c3874f4ccf114e2/raw/crates_io.svg" alt="Get it on crates.io" />](https://crates.io/crates/volga)


[Get Started](https://romanemreis.github.io/volga-docs/getting-started/quick-start.html){: .button }

<Button>Get Started</Button>



```toml
[dependencies]
volga = "0.4.5"
tokio = { version = "1", features = ["full"] }
```
```rust
use volga::*;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    // Configure the HTTP server
    let mut app = App::new().bind("localhost:7878");

    // Configure the GET request handler
    app.map_get("/hello/{name}", |name: String| async move {
        ok!("Hello {}!", name)
    });
    
    // Run it
    app.run().await
}
```
