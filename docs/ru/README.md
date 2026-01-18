# Волга

Гибкий, простой и быстрый веб-фреймворк для Rust на базе [Tokio](https://tokio.rs/) и [hyper](https://hyper.rs/) для разработки HTTP API и микросервисов.

## Начало работы
```toml
[dependencies]
volga = { version = "..." }
tokio = { version = "...", features = ["full"] }
```
```rust
use volga::*;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    // Создаем HTTP-сервер
    let mut app = App::new().bind("localhost:7878");

    // Настраиваем обработчик GET-запросов
    app.map_get("/hello/{name}", async |name: String| {
        ok!("Hello {}!", name)
    });
    
    // Запускаем сервер
    app.run().await
}
```


<div align="center">

<a href="https://romanemreis.github.io/volga-docs/ru/basics/quick-start.html" style="display: inline-block; padding: 10px 20px; background-color: #299764; color: #fff; text-decoration: none; border-radius: 25px; font-family: Arial, sans-serif; font-size: 16px; text-align: center;">
  <span>Подробнее</span>
</a>

</div>
