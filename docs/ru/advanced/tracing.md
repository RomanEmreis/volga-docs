# Логгирование и Трассировка

Функции трассировки и логгирования в Волге основаны на [фреймворке tracing](https://docs.rs/tracing/latest/tracing/index.html) и поддерживают его для сбора структурированной диагностической информации на основе событий из коробки.
В дополнение к этому, вы можете настроить включение span/request/correction id в заголовки ответов, чтобы улучшить метрику observability вашего приложения.

Если вы не используете набор функций `full`, убедитесь, что вы включили функцию `tracing` в `Cargo.toml`, кроме того, вам необходимо установить библиотеки [`tracing`](https://crates.io/crates/tracing) и [`tracing-subscriber`](https://crates.io/crates/tracing-subscriber):

```toml
[dependencies]
volga = { version = "...", features = ["tracing"] }
tracing = "0.1"
tracing-subscriber = "0.3"
```

## Базовая конфигурация
```rust
use volga::{App, tracing::TracingConfig};
use tracing::trace;
use tracing_subscriber::prelude::*;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    // Настраиваем вывод логов в stdout
    tracing_subscriber::registry()
        .with(tracing_subscriber::fmt::layer())
        .init();
    
    let mut app = App::new();

    app.map_get("/tracing", || async {
        trace!("handling the request!");
        "Done!"
    });

    app.run().await
}
```
Приведенный выше код подразумевает базовую конфигурацию трассировки с выводом на stdout. После запуска этого кода в терминале вы должны увидеть следующее:
```bash
2025-01-23T13:09:30.616257Z  INFO volga::app: listening on: http://127.0.0.1:7878
```
Затем, если вы несколько раз вызовете конечную точку `GET http://127.0.0.1:7878/tracing`, и потом выключите сервер, вы должны увидеть в своем терминале что-то вроде этого:
```bash
2025-01-23T13:09:30.616257Z  INFO volga::app: listening on: http://127.0.0.1:7878
2025-01-23T13:09:37.633319Z TRACE request: tracing: handling the request!
2025-01-23T13:09:38.405932Z TRACE request: tracing: handling the request!
2025-01-23T13:09:39.084540Z TRACE request: tracing: handling the request!
2025-01-23T13:09:49.117861Z TRACE volga::app: shutdown signal received, not accepting new requests
2025-01-23T13:09:49.119618Z  INFO volga::app: shutting down the server...
```

## Подключение трассировочного middleware
Однако в приведенном выше примере, если вы проверите заголовки ответа, вы не найдете ничего, связанного со span id. Чтобы исправить это, вы можете использовать методы [`with_tracing()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.with_tracing) или [`set_tracing`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.set_tracing), которые включают низкоуровневое middleware, добавляющее этот заголовок.

```rust
use volga::{App, tracing::TracingConfig};
use tracing::trace;
use tracing_subscriber::prelude::*;

#[tokio::main]
async fn main() -> std::io::Result<()> {v
    // Настраиваем вывод логов в stdout
    tracing_subscriber::registry()
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Настраиваем параметры трассировки
    let tracing = TracingConfig::new()
        .with_header();
    
    let mut app = App::new()
        .set_tracing(tracing);

    app.map_get("/tracing", || async {
        trace!("handling the request!");
        "Done!"
    });

    app.run().await
}
```
По умолчанию middleware добавляет заголовок HTTP-ответа `request-id`, но если вы хотите использовать свой собственный заголовок, вы можете настроить его с помощью метода [`with_header_name()`](https://docs.rs/volga/latest/volga/tracing/struct.TracingConfig.html#method.with_header_name) для [`TracingConfig`](https://docs.rs/volga/latest/volga/tracing/struct.TracingConfig.html):
```rust
let tracing = TracingConfig::new()
    .with_header()
    .with_header_name("x-correlation-id");
```
Затем, вы можете протестировать данный код, при помощи `curl`:
```bash
> curl -v --location "http://127.0.0.1:7878/tracing"
```
```bash
*   Trying 127.0.0.1:7878...
* Connected to 127.0.0.1 (127.0.0.1) port 7878
> GET /tracing HTTP/1.1
> Host: 127.0.0.1:7878
> User-Agent: curl/8.9.1
> Accept: */*
>
* Request completely sent off
< HTTP/1.1 200 OK
< server: Volga
< content-type: text/plain
< x-correlation-id: 2252074691592193
< content-length: 5
< date: Fri, 10 Jan 2025 14:14:37 GMT
<
Done!
```

Полный пример можно найти [здесь](https://github.com/RomanEmreis/volga/blob/main/examples/tracing_example/src/main.rs)
