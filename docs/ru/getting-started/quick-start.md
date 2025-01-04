# Быстрый старт

Создание базового "Hello, World" Web API с использованием Волги.

## Предварительные требования

### Установка Rust

Если вы еще не установили Rust, рекомендуется использовать утилиту `rustup`. [Здесь](https://doc.rust-lang.org/book/ch01-01-installation.html) — официальное руководство, где вы можете узнать, как это сделать.

В настоящее время, минимальная поддерживаемая версия Rust (MSRV) для Волги - 1.80. Запуск команды `rustup update` обеспечит вам доступ к самой свежей версии Rust.

### Создание приложения
Создайте новое исполняемое приложение:
```bash
cargo new hello-world
cd hello-world
```

Добавьте в `Cargo.toml` следующие зависимости:

```toml
[dependencies]
volga = "0.4.5"
tokio = { version = "1", features = ["full"] }
```

## Настройка

Создайте стартовую точку приложения в файле `main.rs`:

```rust
use volga::{App, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    // Создаем сервер
    let mut app = App::new();

    // Пример обработчика простого GET-запроса
    app.map_get("/hello", || async {
        ok!("Hello World!")
    });
    
    // Запускаем сервер
    app.run().await
}
```

## Подробное руководство

Структура [`App`](https://docs.rs/volga/latest/volga/app/struct.App.html), представляет ваше API и по-умолчанию привязывается к адресу `http://localhost:7878`:

```rust
let mut app = App::new();
```

Если требуется привязать сервер к другому сокету, то, можно использовать метод [`bind()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.bind), например:

```rust
// Привязка сервера к http://localhost:5000
let mut app = App::new().bind("localhost:5000");
```

Далее, обработчик запроса `GET /hello` привязывается к маршруту:

```rust
app.map_get("/hello", || {
    ok!("Hello World!")
});
```

Убедитесь, что все маршруты привязаны перед запуском сервера:

```rust
app.run().await
```

## Тестирование API

Вы можете протестировать своё API при помощи команды `curl`:

```bash
> curl -v "http://localhost:7878/hello"
```

Ожидаемый ответ:

```bash
* Host localhost:7878 was resolved.
* IPv6: ::1
* IPv4: 127.0.0.1
*   Trying [::1]:7878...
* Connected to localhost (::1) port 7878
> GET /hello HTTP/1.1
> Host: localhost:7878
> User-Agent: curl/8.9.1
> Accept: */*
>
* Request completely sent off
< HTTP/1.1 200 OK
< date: Sun, 6 Oct 2024 08:22:17 +0000
< server: Volga
< content-length: 12
< content-type: text/plain
<
* Connection #0 to host localhost left intact
Hello World!
```

Полный пример можно найти [здесь](https://github.com/RomanEmreis/volga/blob/main/examples/hello_world.rs).
