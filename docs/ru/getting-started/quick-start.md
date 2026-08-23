# Быстрый старт

Создание базового "Hello, World" HTTP API с использованием Волги.

## Предварительные требования

### Установка Rust

Если вы еще не установили Rust, рекомендуется использовать утилиту `rustup`. [Здесь](https://doc.rust-lang.ru/book/ch01-01-installation.html) — официальное руководство, где вы можете узнать, как это сделать.

В настоящее время минимальная поддерживаемая версия Rust (MSRV) для Волги — 1.90. Запуск команды `rustup update` обеспечит вам доступ к самой свежей версии Rust.

### Создание приложения
Создайте новое исполняемое (binary) приложение:
```bash
cargo new hello-world
cd hello-world
```

Добавьте в `Cargo.toml` следующие зависимости:

```toml
[dependencies]
volga = { version = "..." }
tokio = { version = "...", features = ["full"] }
```

## Настройка

Создайте стартовую точку приложения в файле `main.rs`:

```rust compile
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

Структура [`App`](https://docs.rs/volga/latest/volga/app/struct.App.html) представляет ваше API. Если не вызвать [`bind()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.bind), сервер слушает порт `7878` на **всех интерфейсах** (`0.0.0.0:7878`), а на Windows — на `127.0.0.1:7878`:

```rust compile-fragment
let mut app = App::new();
```

Если требуется привязать сервер к другому сокету, можно использовать метод [`bind()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.bind), например:

```rust compile-fragment
// Привязка сервера к http://localhost:5000
let mut app = App::new().bind("localhost:5000");
```
Начиная с **v0.9.7**, метод [`bind()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.bind) принимает полную грамматику адресов [`tokio::net::TcpListener::bind`](https://docs.rs/tokio/latest/tokio/net/struct.TcpListener.html#method.bind):
```rust compile-fragment
let app = App::new().bind("127.0.0.1:7878");      // литерал IPv4
let app = App::new().bind("[::1]:7878");          // литерал IPv6
let app = App::new().bind("::1:7878");            // литерал IPv6 без скобок
let app = App::new().bind("[fe80::1%eth0]:7878"); // литерал IPv6 с зоной
let app = App::new().bind("localhost:7878");      // имя хоста
let app = App::new().bind(([127, 0, 0, 1], 7878)); // всё, что преобразуется в SocketAddr
```
Имена хостов резолвятся при старте сервера — асинхронно, без блокировки рантайма. Если имя резолвится в несколько адресов, они перебираются в порядке резолва, и побеждает первый, к которому удалось привязаться.

:::warning
До **v0.9.7** адрес, который не разбирался как `SocketAddr`, на не-Windows платформах молча заменялся на `0.0.0.0:7878`. Под это попадали в том числе `localhost:3000` и `::1:3000` — то есть сервер, который должен был остаться на loopback, слушал **все** интерфейсы, без ошибки и без записи в лог.

Теперь непригодный адрес сообщается явно: [`run()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.run) возвращает `io::Error`, а [`run_blocking()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.run_blocking) логирует ошибку и не запускает сервер. Если вы полагаетесь на привязку к loopback как на меру безопасности — обновитесь.
:::

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

### Пример блокирующего старта
Волга также поддерживает создание HTTP API без явной зависимости от `tokio`, используя метод [`run_blocking()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.run_blocking).

Это позволяет упростить зависимости `Cargo.toml`:

```toml
[dependencies]
volga = { version = "..." }
```

Тогда `main.rs` может выглядеть так:

```rust compile
use volga::{App, ok};

fn main() {
    // Создаем сервер
    let mut app = App::new();

    // Пример обработчика простого GET-запроса
    app.map_get("/hello", || async {
        ok!("Hello, World!")
    });

    // Запускаем сервер
    app.run_blocking()
}
```

Хотя функция `main` выглядит синхронной, сервер по-прежнему работает асинхронно, используя среду выполнения `tokio`.

:::info
Подход с [`run_blocking()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.run_blocking) подходит для быстрого создания прототипов, простых инструментов или учебных сценариев, где вы хотите избежать работы с настройкой асинхронного рантайма.
Однако использование `#[tokio::main]` — рекомендуемый подход для **продакшена**, поскольку он обеспечивает полный контроль над асинхронной средой выполнения, допускает более расширенную настройку и лучше поддерживает интеграцию с другими асинхронными библиотеками и сервисами.
:::

Полный пример можно найти [здесь](https://github.com/RomanEmreis/volga/blob/main/examples/hello_world/src/main.rs).
