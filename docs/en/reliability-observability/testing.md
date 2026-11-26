# Testing

Volga's [`TestServer`](https://docs.rs/volga/latest/volga/test/struct.TestServer.html) starts your application on a free local port and gives you an HTTP client configured for it. A test sends real requests, so it covers routing, extractors, middleware, authentication and error handling together, which a unit test of a single handler cannot.

## Setup

`TestServer` lives behind the `test` feature, which only tests need, so add it under `[dev-dependencies]`:

```toml
[dependencies]
volga = { version = "0.15", features = ["full"] }
tokio = { version = "1", features = ["full"] }

[dev-dependencies]
volga = { version = "0.15", features = ["test"] }
```

## Share the Routes Between `main` and the Tests

Move route registration into a function that takes `&mut App`. `main` calls it before starting the server, and each test hands it to the `TestServer`:

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

`cargo test` runs it. Every `TestServer` gets its own port and shares no state with the others, so tests run in parallel.

* `server.url(path)` builds the full address of a path.
* `server.client()` is a [`reqwest::Client`](https://docs.rs/reqwest/latest/reqwest/struct.Client.html) that already speaks the server's protocol (HTTP/1 or HTTP/2, depending on the features).
* `server.shutdown()` stops the server and waits for it. A dropped `TestServer` stops too, but calling `shutdown` keeps the end of the test predictable.

## Sending and Checking JSON

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

## Configuring the App

`TestServer::spawn(setup)` is a shortcut for the builder. Use the builder when a test needs the `App`'s own settings, the `with_*` methods called before `App` is mutable:

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

`setup` can be called more than once; the calls run in order. Services for [dependency injection](/volga-docs/en/advanced-patterns/di.html) are registered in `setup`, as in `main`, so a test can register a fake in place of the real service.

## Other Helpers

* `server.ws("/path")` opens a [WebSocket](/volga-docs/en/protocols-realtime/ws.html) connection, returning a `TestWebSocket` with `send_text`, `recv_text` and `close`.
* `TestServer::builder().with_https()` makes the client use HTTPS, for a server configured with [TLS](/volga-docs/en/protocols-realtime/https.html) in `configure`.
* [`TempFile`](https://docs.rs/volga/latest/volga/test/struct.TempFile.html) creates a temporary file for testing [uploads](/volga-docs/en/requests-responses/files.html) and is removed when dropped.
