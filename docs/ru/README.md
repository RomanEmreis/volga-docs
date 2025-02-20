# Волга

Очень гибкий, простой и быстрый веб-фреймворк для Rust на основе сред [Tokio](https://tokio.rs/) и [hyper](https://hyper.rs/) для безболезненной и увлекательной разработки микросервисов.

## Начало работы
```toml
[dependencies]
volga = "0.5.3"
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


<div align="center">

<a href="https://romanemreis.github.io/volga-docs/ru/basics/quick-start.html" style="display: inline-block; padding: 10px 20px; background-color: #299764; color: #fff; text-decoration: none; border-radius: 25px; font-family: Arial, sans-serif; font-size: 16px; text-align: center;">
  <p3>Подробнее</p3>
</a>

</div>
