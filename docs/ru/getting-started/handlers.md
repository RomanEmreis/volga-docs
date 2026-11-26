# Обработчики

Обработчик запроса — это функция или замыкание, сопоставленные маршруту. Его аргументы — [экстракторы](/volga-docs/ru/getting-started/extractors.html): параметры маршрута и строки запроса, заголовки, JSON-тело, сервисы из [DI](/volga-docs/ru/advanced-patterns/di.html), [собственные типы](/volga-docs/ru/advanced-patterns/custom-extractors.html), — а то, что он возвращает, превращается в ответ. Волга принимает обработчик в двух формах и определяет, какая из них перед ней, по сигнатуре.

## Асинхронные обработчики

`async fn` или замыкание, возвращающее future. Это форма для обработчика, которому есть что ждать: запроса к базе данных, HTTP-вызова, чтения файла через `tokio::fs`.

```rust compile
use volga::{App, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/hello/{name}", |name: String| async move {
        ok!("Hello, {name}!")
    });

    app.map_get("/users/{id}", get_user);

    app.run().await
}

async fn get_user(id: u32) -> String {
    // например, `db.find_user(id).await`
    format!("user #{id}")
}
```

## Синхронные обработчики

Обработчик, которому нечего ждать, — форматирование, арифметика, поиск в памяти, проверка заголовка, — может быть обычной `fn` или замыканием, которое возвращает ответ напрямую:

```rust compile
use volga::{App, HttpResult, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/sum/{x}/{y}", |x: i32, y: i32| x + y);
    app.map_get("/hello/{name}", |name: String| ok!("Hello, {name}!"));
    app.map_get("/health", health);

    app.run().await
}

fn health() -> HttpResult {
    ok!("healthy")
}
```

Всё остальное — как у асинхронной формы: экстракторы выполняются до обработчика, поэтому `Json<T>`, `Form<T>`, `Query<T>` и `Dc<T>` приходят с уже прочитанным телом; возвращать можно всё, что реализует [`IntoResponse`](https://docs.rs/volga/latest/volga/http/response/into_response/trait.IntoResponse.html), включая `HttpResult` и [`Result<T, E>`](#возврат-ошибок); в OpenAPI маршрут описывается так же.

```rust compile
use volga::{App, Json, ok};
use serde::Deserialize;

#[derive(Deserialize)]
struct User {
    name: String,
    age: u32,
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_post("/users", |user: Json<User>| {
        ok!("{} is {} years old", user.name, user.age)
    });

    app.run().await
}
```

Синхронный обработчик выполняется на том воркере рантайма, который опрашивает запрос, — ровно так же, как `async`-обработчик без единого `.await` внутри, и стоит столько же. Это подходящая форма для короткой работы, не нагружающей процессор.

### Где принимаются обе формы

* `map_get`, `map_post`, `map_put`, `map_patch`, `map_delete`, `map_head`, `map_options`, `map_trace`, `map_query` и `map` — у [`App`](https://docs.rs/volga/latest/volga/app/struct.App.html) и у [`RouteGroup`](https://docs.rs/volga/latest/volga/app/router/struct.RouteGroup.html);
* [`map_fallback`](/volga-docs/ru/reliability-observability/errors.html#fallback-обработчик) и [`map_err`](/volga-docs/ru/reliability-observability/errors.html);
* WebSocket-методы [`map_conn`](/volga-docs/ru/protocols-realtime/ws.html) и [`map_msg`](/volga-docs/ru/protocols-realtime/ws.html#простои-сервер);
* middleware [`filter`, `map_ok`, `map_err` и `tap_req`](/volga-docs/ru/middleware-infrastructure/middleware.html#синхронные-middleware).

`wrap`, `with` и `attach` принимают только асинхронные middleware: они существуют ради того, чтобы дождаться `next`.

## Какие экстракторы сочетаются

Обработчик читает экстракторы в том порядке, в котором они стоят. Экстракторы заголовочной части (параметры пути и строки запроса, заголовки, cookie, `Dc<T>`, [собственные типы](/volga-docs/ru/advanced-patterns/custom-extractors.html)) свободно сочетаются друг с другом и с одним экстрактором тела:

```rust compile
use serde::Deserialize;
use volga::{App, HttpRequest, Json, Query, ok};

#[derive(Deserialize)]
struct Paging {
    page: u32,
}

#[derive(Deserialize)]
struct Item {
    name: String,
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // Экстракторы заголовочной части, затем один экстрактор тела
    app.map_put("/lists/{id}", |id: u64, paging: Query<Paging>, item: Json<Item>| {
        ok!("list {id}, page {}: {}", paging.page, item.name)
    });

    // `HttpRequest` забирает весь запрос, поэтому стоит последним
    app.map_post("/raw/{id}", |id: u64, req: HttpRequest| {
        ok!("{id}: {}", req.uri())
    });

    app.run().await
}
```

Три сочетания не могут прочитать один запрос, и обработчик с любым из них не собирается:

* **Два экстрактора тела.** Тело — это поток, который читается один раз, поэтому обработчик принимает что-то одно из `Json<T>`, `Form<T>`, `HttpBody`, `ByteStream`, `File`, `Multipart` и `HttpRequest`.
* **Что угодно после `HttpRequest`.** Он забирает весь запрос вместе с заголовочной частью, поэтому стоит последним: `|id: u64, req: HttpRequest|`, а не `|req: HttpRequest, id: u64|`.
* **Позиционные параметры рядом с `Path<T>` или `NamedPath<T>`.** Обработчик читает параметры пути либо так, либо так.

Ошибка называет правило:

```text
`HttpRequest` takes the whole request, so it stands last among the arguments of a handler
```

Проверка выполняется, когда обработчик инстанцируется, поэтому её показывают `cargo build` и `cargo test`, а `cargo check` — нет.

## Возврат ошибок

Обработчик, который может завершиться неудачей, возвращает `Result<T, E>`: `Ok` — это ответ, а `Err` — ошибка, которая передаётся [обработчику ошибок](/volga-docs/ru/reliability-observability/errors.html#возврат-ошибок-из-обработчика) и никогда не становится самостоятельным ответом. `E` — это `Error` из Волги, `StatusCode`, пара `(StatusCode, сообщение)`, `std::io::Error` или любой тип, реализующий [`IntoError`](https://docs.rs/volga/latest/volga/error/trait.IntoError.html), — и все они преобразуются через `?`.

```rust compile
use volga::{App, HttpResult, http::StatusCode, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/users/{id}", |id: u32| -> Result<String, StatusCode> {
        match id {
            1 => Ok("admin".into()),
            _ => Err(StatusCode::NOT_FOUND),
        }
    });

    app.map_get("/config", read_config);

    app.run().await
}

async fn read_config() -> HttpResult {
    // Отсутствующий файл — это 404, нечитаемый — 403
    let text = tokio::fs::read_to_string("app_config.toml").await?;
    ok!(text)
}
```

::: warning
Голое сообщение — `Err("not found")`, `Err(format!(..))` — не несёт статуса и отвечает `500`. Дайте ему статус: `Err((StatusCode::NOT_FOUND, "not found"))`.
:::

## Блокирующая работа

Синхронный обработчик, который действительно блокирует, например `std::fs` или синхронный драйвер базы данных, не должен выполняться на воркере рантайма. Оберните его в `blocking`, чтобы перенести тело в блокирующий пул Tokio, как описано на странице [Блокирующая работа](/volga-docs/ru/advanced-patterns/blocking.html).

Полный пример доступен по [ссылке](https://github.com/RomanEmreis/volga/blob/main/examples/hello_world/src/main.rs).
