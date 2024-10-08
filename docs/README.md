# Volga

> Fast & Easy Web Framework for Rust based on [Tokio](https://tokio.rs/) runtime for fun and painless microservices crafting.

[![crates.io](https://img.shields.io/badge/crates.io-0.1.7-blue)](https://crates.io/crates/volga)
[![License: MIT](https://img.shields.io/badge/License-MIT-violet.svg)](https://github.com/RomanEmreis/volga/blob/main/LICENSE)
[![Build](https://github.com/RomanEmreis/volga/actions/workflows/rust.yml/badge.svg)](https://github.com/RomanEmreis/volga/actions/workflows/rust.yml)

```toml
[dependencies]
volga = "0.1.7"
tokio = "1.40.0"
```
```rust
use volga::{App, Results, AsyncEndpointsMapping};

#[tokio::main]
async fn main() -> tokio::io::Result<()> {
    // Start the server
    let mut server = App::build("localhost:7878").await?;

    // Example of asynchronous GET request handler
    server.map_get("/hello", |request| async {
        Results::text("Hello World!")
    }).await;
    
    server.run().await
}
```
