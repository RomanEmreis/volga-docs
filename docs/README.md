# Volga

> Fast & Easy Web Framework for Rust based on [Tokio](https://tokio.rs/) runtime for fun and painless microservices crafting.

[![latest](https://img.shields.io/badge/crates.io-0.2.1-blue)](https://crates.io/crates/volga)
[![latest](https://img.shields.io/badge/rustc-1.80+-964B00)](https://www.rust-lang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-violet.svg)](https://github.com/RomanEmreis/volga/blob/main/LICENSE)
[![Build](https://github.com/RomanEmreis/volga/actions/workflows/rust.yml/badge.svg)](https://github.com/RomanEmreis/volga/actions/workflows/rust.yml)

```toml
[dependencies]
volga = "0.2.1"
tokio = "1.40.0"
```
```rust
use volga::{App, AsyncEndpointsMapping, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    // Start the server
    let mut app = App::build("localhost:7878").await?;

    // Example of asynchronous GET request handler
    app.map_get("/hello", |request| async {
        ok!("Hello World!")
    });
    
    app.run().await
}
```
