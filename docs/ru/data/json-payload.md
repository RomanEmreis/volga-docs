# Работа с JSON

Волга упрощает работу с JSON в ваших веб-приложениях, как для приема входящих JSON в запросах, так и для отправки JSON-ответов.

## Получение JSON
Чтобы принять JSON в теле запроса и десериализовать его в строго типизированную сущность, используйте структуру [`Json<T>`](https://docs.rs/volga/latest/volga/http/endpoints/args/json/struct.Json.html). Тип `T` должен быть десериализуемой структурой, поэтому убедитесь, что он реализует типаж [`Deserialize`](https://docs.rs/serde/latest/serde/trait.Deserialize.html) из [serde](https://crates.io/crates/serde):
```rust
use volga::{App, Json, ok};
use serde::Deserialize;

#[derive(Deserialize)]
struct User {
    name: String,
    age: i32
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // POST /hello
    // { name: "John", age: 35 }
    app.map_post("/hello", |user: Json<User>| async move {
        ok!("Привет, {}!", user.name)
    });

    app.run().await
}
```
Для тестирования можно использовать команду `curl` следующим образом:
```bash
curl -X POST "http://127.0.0.1:7878/hello" -H "Content-Type: application/json" -d "{ \"name\": \"John\", \"age\": 35 }"
Привет, John!
```
::: tip
Вы можете обернуть поля вашей структуры в [`Option<T>`](https://doc.rust-lang.org/std/option/), как описано в разделе [Обработка опциональных параметров запроса](/volga-docs/ru/basics/query-params.html#обработка-опциональных-параметров).
:::

## Отправка JSON
Для отправки ответов в формате JSON Волга предоставляет несколько удобных методов:

### Использование `Results::from()`
Метод [`Results::from()`](https://docs.rs/volga/latest/volga/http/response/struct.Results.html#method.from), который был описан ранее, автоматически сериализует переданную структуру в JSON.

### Использование `Results::json()`
Метод [`Results::json()`](https://docs.rs/volga/latest/volga/http/response/struct.Results.html#method.json) напрямую сериализует структуры Rust в JSON. Убедитесь, что ваша структура реализует trait [`Serialize`](https://docs.rs/serde/latest/serde/trait.Serialize.html):
```rust
use volga::{App, Results};
use serde::Serialize;

#[derive(Serialize)]
struct User {
    name: String,
    age: i32
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/hello", || async {
        let user: User = User {
            name: "John".into(),
            age: 35
        };

        Results::json(user)
    });

    app.run().await
}
```
Проверяем:
```bash
> curl http://127.0.0.1:7878/hello
{"name":"John","age":35}
```
### Упрощенная версия с макросом `ok!`
Для более компактного подхода используйте макрос [`ok!`](https://docs.rs/volga/latest/volga/macro.ok.html), который автоматически компилируется в [`Results::json()`](https://docs.rs/volga/latest/volga/http/response/struct.Results.html#method.json), если передать сериализуемый объект:
```rust
use volga::{App, ok};
use serde::Serialize;

#[derive(Serialize)]
struct User {
    name: String,
    age: i32
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/hello", || async {
        let user: User = User {
            name: "John".into(),
            age: 35
        };

        ok!(user)
    });

    app.run().await
}
```
Кроме того, с помощью макроса [`ok!`](https://docs.rs/volga/latest/volga/macro.ok.html) можно использовать и неструктурированные JSON-данные:
```rust
use volga::{App, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/hello", || async {
        ok!({ name: "John", age: 35 })
    });

    app.run().await
}
```
### Указание статуса вместе с JSON
Вы также можете включать HTTP-статусы в ваши JSON-ответы с помощью макроса [`status!`](https://docs.rs/volga/latest/volga/macro.status.html):
```rust
use volga::{App, status};
use serde::Serialize;

#[derive(Serialize)]
struct User {
    name: String,
    age: i32
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/hello", || async {
        let user: User = User {
            name: "John".into(),
            age: 35
        };

        status!(200, user)
    });

    app.run().await
}
```
Тело JSON можно дополнить стандартными HTTP-статусами, такими как `200`, `400`, `401`, `403` и другими, чтобы предоставлять понятные сообщения для клиента.

Вот [полный пример](https://github.com/RomanEmreis/volga/blob/main/examples/json/src/main.rs).