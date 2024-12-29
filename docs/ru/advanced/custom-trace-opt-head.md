# Пользовательская обработка методов HEAD, OPTIONS и TRACE

В данном руководстве представлены различные способы обработки таких методов HTTP как `HEAD`, `OPTIONS` и `TRACE`.

## Метод HEAD
По умолчанию, когда вы сопоставляете обработчик с методом `GET`, Вола также сопоставляет его с методом `HEAD`.
Метод `HEAD` возвращает заголовки без тела.

Чтобы настроить поведение метода `HEAD`, явно определите его с помощью метода [`map_head`](https://docs.rs/volga/latest/volga/app/router/trait.Router.html#tymethod.map_head):
```rust
use volga::{App, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // HEAD /resource
    app.map_head("/resource", || async {
        ok!([
            ("x-custom-header", "some-value-get")
        ])
    });

    // GET /resource
    app.map_get("/resource", || async {
        ok!("Hello World!", [
            ("x-custom-header", "some-value-get")
        ])
    });

    app.run().await
}
```
Здесь метод `HEAD` возвращает заголовки без тела, часто зеркально отражая те заголовки, которые вернул бы запрос `GET`.

## Метод OPTIONS

Для специальной обработки запросов `OPTIONS` используйте метод [`map_options`](https://docs.rs/volga/latest/volga/app/router/trait.Router.html#tymethod.map_options) для сопоставления этого метода HTTP:
```rust
use volga::{App, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // OPTIONS /resource
    app.map_options("/resource", || async {
        ok!([
            ("Allow", "GET, OPTIONS")
        ])
    });

    // GET /resource
    app.map_get("/resource", || async {
        ok!("Hello World!")
    });

    app.run().await
}
```
Пример выше включает заголовок `Allow` для указания поддерживаемых HTTP-методов для ресурса. Тело ответа необязательно и зависит от конкретных потребностей вашего API.

## Метод TRACE

Метод `TRACE` полезен для отладки, так как он позволяет отслеживать путь запроса к серверу и возвращает сообщение запроса для диагностических целей:

```rust
use volga::{App, HttpRequest, stream};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // TRACE /
    app.map_trace("/", |req: HttpRequest| async move {
        let boxed_body = req.into_boxed_body();
        stream!(boxed_body, [
            ("content-type", "message/http")
        ])
    });

    app.run().await
}
```
Этот обработчик захватывает входящий запрос и отправляет его обратно в ответе с соответствующим типом содержимого.

Вы можете посмотреть примеры здесь:
* [HEAD](https://github.com/RomanEmreis/volga/blob/main/examples/head_request.rs)
* [OPTIONS](https://github.com/RomanEmreis/volga/blob/main/examples/options_request.rs)
* [TRACE](https://github.com/RomanEmreis/volga/blob/main/examples/trace_request.rs)
