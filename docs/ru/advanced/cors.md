# CORS (Cross-Origin Resource Sharing)

Волга поддерживает легко настраиваемый middleware для [CORS](https://developer.mozilla.org/docs/Web/HTTP/CORS).

Он входит в состав набора функций `full`. Однако, если вы его не используете, вы можете включить функцию `middleware` в `Cargo.toml`, чтобы добавить поддержку CORS:  

```toml
[dependencies]
volga = { version = "0.5.5", features = ["middleware"] }
```

## Базовая настройка  

Следующий пример демонстрирует максимально разрешительную конфигурацию CORS:  

```rust
use volga::App;

#[tokio::main]
async fn main() -> std::io::Result<()> {   
    let mut app = App::new()
        .with_cors(|cors| cors
            .with_any_origin()
            .with_any_header()
            .with_any_method());

    // Включение CORS middleware
    app.use_cors();

    app.map_post("/", || async {});

    app.run().await
}
```

По умолчанию CORS отключен. Чтобы избежать паники во время выполнения, необходимо вызвать метод [`with_cors()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.with_cors) **до** [`use_cors()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.use_cors).  

Если требуется более строгая конфигурация, можно указать конкретные разрешённые источники, заголовки и методы:  

```rust
use volga::{App, http::Method};

#[tokio::main]
async fn main() -> std::io::Result<()> {   
    let mut app = App::new()
        .with_cors(|cors| cors
            .with_origins(["http://example.com", "http://example.net"])
            .with_headers(["Cache-Control", "Content-Language"])
            .with_methods([Method::GET, Method::POST]));

    // Включение CORS middleware
    app.use_cors();

    app.map_post("/", || async {});

    app.run().await
}
```

:::warning  
Если вам нужно включить передачу учётных данных с помощью [`with_credentials(true)`](https://docs.rs/volga/latest/volga/http/cors/struct.CorsConfig.html#method.with_credentials), учтите, что **нельзя** использовать эту настройку совместно с wildcard-значениями для источников, заголовков или методов по соображениям безопасности. Эти ограничения проверяются в [`use_cors()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.use_cors), и в случае некорректной конфигурации произойдёт паника.
:::

Полный пример доступен [здесь](https://github.com/RomanEmreis/volga/blob/main/examples/cors/src/main.rs).  