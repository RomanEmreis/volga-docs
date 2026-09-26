# Основы Middleware

Volga предоставляет инструменты для построения цепочек промежуточной обработки (middleware) — как для отдельных маршрутов, так и для групп маршрутов или всего приложения.

## Включение поддержки middleware

Если вы не используете полный набор функций `full`, необходимо явно включить фичу `middleware` в `Cargo.toml`:

```toml
[dependencies]
volga = { version = "...", features = ["middleware"] }
```

## Фильтры

Метод [`filter()`](https://docs.rs/volga/latest/volga/app/router/struct.Route.html#method.filter) позволяет задать условную логику (например, проверку прав или валидацию) для конкретного маршрута или группы маршрутов.

```rust compile
use volga::{App, Path};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // Разрешаем только положительные числа
    app.group("/positive", |g| {
        g.filter(|Path((x, y)): Path<(i32, i32)>| async move { x >= 0 && y >= 0 });
        g.map_get("/sum/{x}/{y}", sum);
    });
    
    // Разрешаем только отрицательные числа
    app.map_get("/negative/sum/{x}/{y}", sum)
        .filter(|Path((x, y)): Path<(i32, i32)>| async move { x < 0 && y < 0 });

    app.run().await
}

async fn sum(x: i32, y: i32) -> i32 {
    x + y
}
```

### Что возвращает фильтр

Вердикт фильтра — это `bool`, `()`, [`FilterResult`](https://docs.rs/volga/latest/volga/http/response/filter_result/struct.FilterResult.html) или `Result<(), E>`. Остановленный фильтром запрос уходит в [обработчик ошибок](/volga-docs/ru/reliability-observability/errors.html) со статусом того, что вернул фильтр:

| Фильтр возвращает | Ответ |
|---|---|
| `false` или `FilterResult::err()` | `400 Bad Request` с общим сообщением |
| `Err` чего угодно со статусом — `Error`, `StatusCode`, `(StatusCode, E)`, `std::io::Error`, `ValidationError`, `OAuthError`, `Problem`, ваш тип, реализующий [`IntoError`](https://docs.rs/volga/latest/volga/error/trait.IntoError.html) | этот статус — тот же, что получил бы такой `Err` из [обработчика](/volga-docs/ru/reliability-observability/errors.html#возврат-ошибок-из-обработчика) |
| `Err` строки или `Box<dyn std::error::Error + Send + Sync>` | `400 Bad Request` с этим сообщением |

Последняя строка — единственное отличие от обработчика, где строка даёт `500`: ошибка без собственного статуса, возвращённая фильтром, считается причиной отказа в запросе. Начиная с **0.12.0** ошибка со статусом его сохраняет — `OAuthError` отвечает `401` для `invalid_token` и `403` для `insufficient_scope`, а `Error` сохраняет свой instance и [прикреплённый ответ](/volga-docs/ru/reliability-observability/errors.html#ответ-с-собственным-телом).

```rust compile
use volga::{App, headers::HttpHeaders, http::StatusCode};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // 401 Unauthorized без заголовка
    app.filter(|headers: HttpHeaders| match headers.get_raw("x-api-key") {
        Some(_) => Ok(()),
        None => Err((StatusCode::UNAUTHORIZED, "missing API key")),
    });

    app.map_get("/sum", |x: i32, y: i32| x + y);

    app.run().await
}
```

[`FilterResult::with_error()`](https://docs.rs/volga/latest/volga/http/response/filter_result/struct.FilterResult.html#method.with_error) принимает те же типы и отвечает так же, как `Err` с этой ошибкой.

::: warning Одного std::error::Error недостаточно
`Err` фильтра должен быть `Error` или реализовывать `IntoError`. Тип, который реализует только `std::error::Error`, — `ParseIntError`, ошибка из другого крейта — там не компилируется; дайте ему статус через `.map_err(|err| (StatusCode::BAD_REQUEST, err))` или оберните в собственный тип ошибки, реализующий `IntoError`.
:::

## Обработка входящего запроса

Метод [`tap_req()`](https://docs.rs/volga/latest/volga/app/router/struct.Route.html#method.tap_req) позволяет получить доступ к [`HttpRequestMut`](https://docs.rs/volga/latest/volga/http/request/struct.HttpRequestMut.html), чтобы модифицировать или исследовать запрос до обработки.

```rust compile
use volga::{App, HttpRequestMut, headers};

headers! {
    (CustomHeader, "x-custom-header")
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app
        .map_get("/sum", |x: i32, y: i32| async move { x + y })
        .tap_req(|mut req: HttpRequestMut| async move { 
            req.try_insert_header::<CustomHeader>("Custom Value")?;
            Ok(req)
        });

    app.run().await
}
```

## Обработка успешного ответа

Метод [`map_ok()`](https://docs.rs/volga/latest/volga/app/router/struct.Route.html#method.map_ok) позволяет изменить или дополнить HTTP-ответ после успешной обработки.

```rust compile
use volga::{App, HttpResponse, HttpResult, headers};

headers! {
    (CustomHeader, "x-custom-header")
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.group("/positive", |g| {
        g.map_ok(group_response);
        g.map_get("/sum/{x}/{y}", sum);
    });

    app.map_get("/negative/sum/{x}/{y}", sum)
        .map_ok(route_response);

    app.run().await
}

async fn group_response(mut resp: HttpResponse) -> HttpResult {
    resp.try_insert_header::<CustomHeader>("for-group")?;
    Ok(resp)
}

async fn route_response(mut resp: HttpResponse) -> HttpResult {
    resp.try_insert_header::<CustomHeader>("for-route")?;
    Ok(resp)
}

async fn sum(x: i32, y: i32) -> i32 {
    x + y
}
```

## Обработка ошибок

Метод [`map_err()`](https://docs.rs/volga/latest/volga/app/router/struct.Route.html#method.map_err) позволяет определить кастомную логику обработки ошибок — глобально, для отдельного маршрута или для группы.

```rust compile
use volga::{App, error::{Error, ProblemDetails}};
use std::io::Error as IoError;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();
    
    app.map_get("/error", produce_err)
        .map_err(handle_err);

    app.run().await
}

async fn handle_err(error: Error) -> ProblemDetails {
    ProblemDetails::from(error)
}

async fn produce_err() -> IoError {
    IoError::other("some error")
}
```

Начиная с **0.12.0** любой `Err`, который возвращает обработчик, доходит до этого `map_err` как `Error` — включая `Err(StatusCode::NOT_FOUND)` и `Err` вашего собственного типа ошибки.

::: tip
Если вызвать [`map_err()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_err) у [`App`](https://docs.rs/volga/latest/volga/app/struct.App.html), вы настроите глобальный обработчик ошибок. Подробнее о глобальной обработке ошибок читайте [здесь](/volga-docs/ru/reliability-observability/errors.html).
:::

## Синхронные middleware

Начиная с **v0.11.0** [`filter()`](https://docs.rs/volga/latest/volga/app/router/struct.Route.html#method.filter), [`map_ok()`](https://docs.rs/volga/latest/volga/app/router/struct.Route.html#method.map_ok), [`map_err()`](https://docs.rs/volga/latest/volga/app/router/struct.Route.html#method.map_err) и [`tap_req()`](https://docs.rs/volga/latest/volga/app/router/struct.Route.html#method.tap_req) принимают также обычную `fn` или замыкание, которое возвращает вердикт, ответ или запрос напрямую, когда ждать нечего, — у [`App`](https://docs.rs/volga/latest/volga/app/struct.App.html), маршрута и группы маршрутов, так же как и [обработчики](/volga-docs/ru/getting-started/handlers.html#синхронные-обработчики):

```rust compile
use volga::{App, HttpResponse, HttpResult, Path, headers, headers::HttpHeaders};

headers! {
    (CustomHeader, "x-custom-header")
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // Отклонять запросы без API-ключа
    app.filter(|headers: HttpHeaders| headers.get_raw("x-api-key").is_some());

    app.map_get("/positive/sum/{x}/{y}", |x: i32, y: i32| x + y)
        .filter(|Path((x, y)): Path<(i32, i32)>| x >= 0 && y >= 0)
        .map_ok(tag_response);

    app.run().await
}

fn tag_response(mut resp: HttpResponse) -> HttpResult {
    resp.try_insert_header::<CustomHeader>("sync")?;
    Ok(resp)
}
```

[`wrap()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.wrap), [`with()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.with) и [`attach()`](/volga-docs/ru/middleware-infrastructure/parameterized-middleware.html) остаются асинхронными: они существуют ради того, чтобы дождаться `next`.

## Примеры
* [Пример фильтрации запроса](https://github.com/RomanEmreis/volga/blob/main/examples/request_validation/src/main.rs)
* [Пример обработки ответа](https://github.com/RomanEmreis/volga/blob/main/examples/response_handler/src/main.rs)
