# Основы Middleware

Volga предоставляет инструменты для построения цепочек промежуточной обработки (middleware) — как для отдельных маршрутов, так и для групп маршрутов или всего приложения.

## Включение поддержки middleware

Если вы не используете полный набор функций `full`, необходимо явно включить фичу `middleware` в `Cargo.toml`:

```toml
[dependencies]
volga = { version = "0.6.0", features = ["middleware"] }
```

## Фильтры

Метод [`filter()`](https://docs.rs/volga/latest/volga/app/router/struct.Route.html#method.filter) позволяет задать условную логику (например, проверку прав или валидацию) для конкретного маршрута или группы маршрутов.

```rust
use volga::App;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // Разрешаем только положительные числа
    app
        .map_group("/positive")
        .filter(|x: i32, y: i32| async move { x >= 0 && y >= 0 })
        .map_get("/sum/{x}/{y}", sum);
    
    // Разрешаем только отрицательные числа
    app
        .map_get("/negative/sum/{x}/{y}", sum)
        .filter(|x: i32, y: i32| async move { x < 0 && y < 0 });

    app.run().await
}

async fn sum(x: i32, y: i32) -> i32 {
    x + y
}
```

## Обработка входящего запроса

Метод [`tap_req()`](https://docs.rs/volga/latest/volga/app/router/struct.Route.html#method.tap_req) позволяет получить доступ к [`HttpRequest`](https://docs.rs/volga/latest/volga/http/request/struct.HttpRequest.html), чтобы модифицировать или исследовать его до обработки.

```rust
use volga::{App, HttpRequest, headers::HeaderValue};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app
        .map_get("/sum", |x: i32, y: i32| async move { x + y })
        .tap_req(|mut req: HttpRequest| async move { 
            req.headers_mut()
                .insert("X-Custom-Header", HeaderValue::from_static("Custom Value"));
            req
        });

    app.run().await
}
```

## Обработка успешного ответа

Метод [`map_ok()`](https://docs.rs/volga/latest/volga/app/router/struct.Route.html#method.map_ok) позволяет изменить или дополнить HTTP-ответ после успешной обработки.

```rust
use volga::{App, HttpResponse, headers::HeaderValue};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app
        .map_group("/positive")
        .map_ok(group_response)
        .map_get("/sum/{x}/{y}", sum);

    app
        .map_get("/negative/sum/{x}/{y}", sum)
        .map_ok(route_response);

    app.run().await
}

async fn group_response(mut resp: HttpResponse) -> HttpResponse {
    resp.headers_mut()
        .insert("x-custom-header", HeaderValue::from_static("for-group"));
    resp
}

async fn route_response(mut resp: HttpResponse) -> HttpResponse {
    resp.headers_mut()
        .insert("x-custom-header", HeaderValue::from_static("for-route"));
    resp
}

async fn sum(x: i32, y: i32) -> i32 {
    x + y
}
```

## Обработка ошибок

Метод [`map_err()`](https://docs.rs/volga/latest/volga/app/router/struct.Route.html#method.map_err) позволяет определить кастомную логику обработки ошибок — глобально, для отдельного маршрута или для группы.

```rust
use volga::{App, HttpResult, error::Error, problem};
use std::io::Error as IoError;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();
    
    app
        .map_get("/error", produce_err)
        .map_err(handle_err);

    app.run().await
}

async fn handle_err(error: Error) -> HttpResult {
    let (status, instance, err) = error.into_parts();
    problem! {
        "status": status.as_u16(),
        "detail": err.to_string(),
        "instance": instance,
    }
}

async fn produce_err() -> IoError {
    IoError::other("some error")
}
```

::: tip
Если вызвать [`map_err()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_err) у [`App`](https://docs.rs/volga/latest/volga/app/struct.App.html), вы настроите глобальный обработчик ошибок. Подробнее о глобальной обработке ошибок читайте [здесь](/volga-docs/ru/advanced/errors).
:::

## Примеры
* [Пример фильтрации запроса](https://github.com/RomanEmreis/volga/blob/main/examples/request_validation/src/main.rs)
* [Пример обработки ответа](https://github.com/RomanEmreis/volga/blob/main/examples/response_handler/src/main.rs)
