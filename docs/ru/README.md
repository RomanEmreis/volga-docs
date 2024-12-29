# Волга

Очень гибкий, простой и быстрый веб-фреймворк для Rust на основе сред [Tokio](https://tokio.rs/) и [hyper](https://hyper.rs/) для безболезненной и увлекательной разработки микросервисов.

[![latest](https://img.shields.io/badge/crates.io-0.4.5-blue)](https://crates.io/crates/volga)
[![latest](https://img.shields.io/badge/rustc-1.80+-964B00)](https://www.rust-lang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-violet.svg)](https://github.com/RomanEmreis/volga/blob/main/LICENSE)
[![Build](https://github.com/RomanEmreis/volga/actions/workflows/rust.yml/badge.svg)](https://github.com/RomanEmreis/volga/actions/workflows/rust.yml)
[![Release](https://github.com/RomanEmreis/volga/actions/workflows/release.yml/badge.svg)](https://github.com/RomanEmreis/volga/actions/workflows/release.yml)

```toml
[dependencies]
volga = "0.4.5"
tokio = { version = "1", features = ["full"] }
```
```rust
use volga::*;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    // Создаем HTTP server
    let mut app = App::new().bind("localhost:7878");

    // Настраиваем обработчик GET запросов
    app.map_get("/hello/{name}", |name: String| async move {
        ok!("Hello {}!", name)
    });
    
    // Стартуем!
    app.run().await
}
```
