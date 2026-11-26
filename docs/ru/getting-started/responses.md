# Ответы

Обработчик возвращает любое значение, реализующее типаж [`IntoResponse`](https://docs.rs/volga/latest/volga/http/response/into_response/trait.IntoResponse.html), и Волга превращает его в HTTP-ответ. Собрать ответ можно тремя способами:

* **Простое значение**: строка, число, `StatusCode`, `Option`.
* **Типизированная обёртка**: [`Json<T>`](/volga-docs/ru/requests-responses/json-payload.html) или [`Form<T>`](/volga-docs/ru/requests-responses/form.html).
* **Макрос ответа**, например `ok!`, `created!` или `not_found!`. Он нужен, когда требуется определённый статус, заголовки или выбор между несколькими ответами.

Каждый макрос возвращает [`HttpResult`](https://docs.rs/volga/latest/volga/http/response/type.HttpResult.html), то есть `Result<HttpResponse, Error>`. Поэтому `HttpResult` обычно указывают как тип возврата обработчика, который отвечает по-разному или использует `?`.

## Возврат значения

```rust compile
use serde::Serialize;
use volga::{App, Json, http::StatusCode};

#[derive(Serialize)]
struct User {
    name: String,
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // 200, text/plain
    app.map_get("/health", || "healthy");

    // 200, text/plain: числа и bool отправляются текстом
    app.map_get("/sum/{x}/{y}", |x: i32, y: i32| x + y);

    // 200, application/json
    app.map_get("/me", || Json(User { name: "John".into() }));

    // 204 с пустым телом
    app.map_delete("/users/{id}", |_id: u32| StatusCode::NO_CONTENT);

    // `Some` отвечает значением, `None` отвечает 404
    app.map_get("/users/{id}", |id: u32| {
        (id == 1).then(|| Json(User { name: "John".into() }))
    });

    app.run().await
}
```

Обработчик, который ничего не возвращает (`()`), отвечает `200` с пустым телом.

## Макросы ответов

| Макрос | Статус |
|---|---|
| `ok!` | `200 OK` |
| `created!` | `201 Created` |
| `accepted!` | `202 Accepted` |
| `no_content!` | `204 No Content` |
| `bad_request!` | `400 Bad Request` |
| `not_found!` | `404 Not Found` |
| `status!(code, ...)` | любой статус |
| `redirect!`, `found!`, `see_other!`, `temp_redirect!`, `permanent_redirect!` | `301`, `302`, `303`, `307`, `308` с заголовком `Location` |
| `html!`, `html_file!` | `200`, `text/html` |
| `file!` | `200`, [скачивание файла](/volga-docs/ru/requests-responses/files.html) |
| `form!` | `200`, `application/x-www-form-urlencoded` |
| `stream!` | `200`, [потоковое тело](/volga-docs/ru/requests-responses/body.html) |
| `sse!`, `sse_stream!` | `200`, [Server-Sent Events](/volga-docs/ru/protocols-realtime/sse.html) |

```rust compile
use serde::Serialize;
use volga::{App, HttpResult, created, not_found, ok};

#[derive(Serialize)]
struct User {
    id: u32,
    name: String,
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/users/{id}", get_user);
    app.map_post("/users/{name}", |name: String| {
        created!(User { id: 2, name })
    });

    app.run().await
}

async fn get_user(id: u32) -> HttpResult {
    match id {
        1 => ok!(User { id, name: "John".into() }),
        _ => not_found!("no user {id}"),
    }
}
```

### Текст или JSON

`ok!`, `created!`, `accepted!`, `bad_request!`, `not_found!` и `status!` читают аргумент одинаково:

```rust
ok!();                                // пустое тело без Content-Type
ok!("healthy");                       // text/plain
ok!("Hello, {name}!");                // text/plain с форматированием
ok!("Hello, {}!", name);              // text/plain с форматированием
ok!(user);                            // application/json
ok!({ "status": "healthy" });         // application/json, записанный прямо в макросе
ok!(text: name);                      // text/plain, всё, что превращается в тело
ok!(json: name);                      // application/json, указан явно
```

Важна **форма** аргумента, а не его тип. Строковый литерал становится текстом, а любое другое выражение сериализуется в JSON. Поэтому переменная типа `String` становится JSON-строкой:

```rust
let name = String::from("John");
ok!(name);            // "John" (в кавычках), application/json
ok!(text: name);      // John, text/plain
ok!("{name}");        // John, text/plain
```

::: tip
Для чисел и `bool` укажите формат явно через `text:` или `json:`: `ok!(text: 150)`, `ok!(json: true)`.
:::

### Заголовки

Заголовки пишутся после **точки с запятой**, массивом пар или типизированных заголовков:

```rust
ok!("Hello"; [("x-request-id", "42")]);
ok!([("x-request-id", "42")]);                      // заголовки без тела
ok!(user; [("cache-control", "no-store")]);
ok!(fmt: "Hello, {}!", name; [("x-request-id", id)]);
status!(401, "Unauthorized"; [(WWW_AUTHENTICATE, "Bearer")]);
```

Если вместо точки с запятой поставить запятую, массив будет прочитан как аргумент `format!`, и код не скомпилируется. Когда форматированное тело идёт вместе с заголовками, используйте форму `fmt:`, как в четвёртой строке.

### Любой статус

`status!` принимает статус числом, а за ним тело в тех же формах, что и `ok!`:

```rust
status!(204);
status!(409, "already exists");
status!(422, { "error": "name is required" });
status!(503; [("retry-after", "30")]);
```

## Редиректы и HTML

```rust compile
use volga::{App, html, see_other};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/", || html!("<h1>Hello</h1>"));
    app.map_post("/login", || see_other!("/me"));

    app.run().await
}
```

## Ошибки

Обработчик, который может завершиться неудачей, возвращает `Result<T, E>`. На `Ok` отвечают как на любой другой ответ, а `Err` уходит в обработчик ошибок, который решает, что увидит клиент:

```rust compile
use volga::{App, Json, http::StatusCode};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/items/{id}", |id: u32| -> Result<Json<u32>, StatusCode> {
        if id > 100 {
            return Err(StatusCode::NOT_FOUND);
        }
        Ok(Json(id))
    });

    app.run().await
}
```

Какие типы могут быть `Err`, как описать собственный тип ошибки и как оформить все ошибки в одном месте, рассказано на странице [Центральный обработчик ошибок](/volga-docs/ru/reliability-observability/errors.html).

::: warning
У голой строки нет статуса: `Err("not found")` отвечает `500`. Укажите статус: `Err((StatusCode::NOT_FOUND, "not found"))`.
:::
