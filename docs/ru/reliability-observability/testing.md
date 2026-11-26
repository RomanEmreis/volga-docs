# Тестирование

[`TestServer`](https://docs.rs/volga/latest/volga/test/struct.TestServer.html) запускает ваше приложение на свободном локальном порту и даёт HTTP-клиент, уже настроенный на него. Тест отправляет настоящие запросы, поэтому проверяет вместе маршрутизацию, экстракторы, middleware, аутентификацию и обработку ошибок. Модульный тест отдельного обработчика этого не видит.

## Подключение

`TestServer` находится за фичей `test`, которая нужна только тестам, поэтому добавьте её в `[dev-dependencies]`:

```toml
[dependencies]
volga = { version = "0.15", features = ["full"] }
tokio = { version = "1", features = ["full"] }

[dev-dependencies]
volga = { version = "0.15", features = ["test"] }
```

## Общие маршруты для `main` и тестов

Вынесите регистрацию маршрутов в функцию, которая принимает `&mut App`. `main` вызывает её перед запуском сервера, а каждый тест передаёт её в `TestServer`:

```rust compile features="full test"
use volga::{App, ok};

fn routes(app: &mut App) {
    app.map_get("/health", || ok!("healthy"));
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();
    routes(&mut app);
    app.run().await
}

#[cfg(test)]
mod tests {
    use super::routes;
    use volga::test::TestServer;

    #[tokio::test]
    async fn health_check() {
        let server = TestServer::spawn(routes).await;

        let response = server
            .client()
            .get(server.url("/health"))
            .send()
            .await
            .unwrap();

        assert!(response.status().is_success());
        assert_eq!(response.text().await.unwrap(), "healthy");

        server.shutdown().await;
    }
}
```

Тест запускается командой `cargo test`. Каждый `TestServer` получает свой порт и не делит состояние с другими, поэтому тесты выполняются параллельно.

* `server.url(path)` строит полный адрес пути.
* `server.client()` это [`reqwest::Client`](https://docs.rs/reqwest/latest/reqwest/struct.Client.html), который уже говорит на протоколе сервера (HTTP/1 или HTTP/2, в зависимости от фич).
* `server.shutdown()` останавливает сервер и дожидается его остановки. Удалённый `TestServer` тоже останавливается, но явный вызов `shutdown` делает конец теста предсказуемым.

## Отправка и проверка JSON

```rust compile features="full test"
use serde::{Deserialize, Serialize};
use volga::{App, Json, created, http::StatusCode, test::TestServer};

#[derive(Serialize, Deserialize)]
struct User {
    name: String,
}

fn routes(app: &mut App) {
    app.map_post("/users", |user: Json<User>| created!(user.into_inner()));
}

#[tokio::test]
async fn creates_a_user() {
    let server = TestServer::spawn(routes).await;

    let response = server
        .client()
        .post(server.url("/users"))
        .json(&User { name: "John".into() })
        .send()
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::CREATED);
    let user: User = response.json().await.unwrap();
    assert_eq!(user.name, "John");

    server.shutdown().await;
}

#[tokio::test]
async fn refuses_a_body_that_is_not_json() {
    let server = TestServer::spawn(routes).await;

    let response = server
        .client()
        .post(server.url("/users"))
        .body("not json")
        .send()
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);

    server.shutdown().await;
}
```

## Настройка приложения

`TestServer::spawn(setup)` это сокращение для билдера. Билдер нужен, когда тесту требуются собственные настройки `App`, то есть методы `with_*`, которые вызываются до того, как `App` становится изменяемым:

```rust compile features="full test"
use volga::{App, Json, Limit, test::TestServer};

#[tokio::test]
async fn small_bodies_only() {
    let server = TestServer::builder()
        .configure(|app: App| app.with_body_limit(Limit::Limited(16)))
        .setup(|app| {
            app.map_post("/echo", |Json(text): Json<String>| text);
        })
        .build()
        .await;

    let response = server
        .client()
        .post(server.url("/echo"))
        .json("a body longer than sixteen bytes")
        .send()
        .await
        .unwrap();

    assert_eq!(response.status().as_u16(), 413);

    server.shutdown().await;
}
```

`setup` можно вызывать несколько раз, вызовы выполняются по порядку. Сервисы для [внедрения зависимостей](/volga-docs/ru/advanced-patterns/di.html) регистрируются в `setup` так же, как в `main`, поэтому тест может зарегистрировать заглушку вместо настоящего сервиса.

## Другие помощники

* `server.ws("/path")` открывает соединение [WebSocket](/volga-docs/ru/protocols-realtime/ws.html) и возвращает `TestWebSocket` с методами `send_text`, `recv_text` и `close`.
* `TestServer::builder().with_https()` переключает клиента на HTTPS, для сервера, настроенного с [TLS](/volga-docs/ru/protocols-realtime/https.html) в `configure`.
* [`TempFile`](https://docs.rs/volga/latest/volga/test/struct.TempFile.html) создаёт временный файл для тестов [загрузки файлов](/volga-docs/ru/requests-responses/files.html) и удаляется, когда выходит из области видимости.
