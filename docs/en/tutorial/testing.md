# Testing

The service is done; this chapter makes sure it stays that way. The tests start the whole service on a free local port and send it real HTTP requests, the way `WebApplicationFactory` does in ASP.NET Core or `httptest.NewServer` in Go. A test like that covers routing, validation, authentication and error handling together.

## Setup

Volga's [`TestServer`](/volga-docs/en/reliability-observability/testing.html) is behind the `test` feature, which only tests need, so it goes under `[dev-dependencies]`, next to [`serde_json`](https://docs.rs/serde_json) for writing request bodies:

```toml
[dev-dependencies]
volga = { version = "0.15", features = ["test"] }
serde_json = "1"
```

Cargo merges these features with the ones under `[dependencies]` when it builds the tests, so the tests get `full` and `test` together.

## A Test Server

The tests of a binary live in the same file as its code, in a module compiled only for `cargo test`. It goes at the end of `src/main.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::{Bookmark, Token, configure, routes};
    use serde_json::{Value, json};
    use volga::{App, http::StatusCode, test::TestServer};

    const SECRET: &str = "test-secret";

    async fn spawn() -> TestServer {
        TestServer::builder()
            .configure(|app: App| configure(app, SECRET))
            .setup(routes)
            .build()
            .await
    }
```

`spawn` builds the app the way `main` does, from the same `configure` and `routes`, with a secret of the test's own instead of the environment variable. This is why the earlier chapters kept them out of `main`. The builder's `configure` step takes the `App` settings, and `setup` registers the routes and services.

`routes` registers the store too, so every test server has a store of its own, empty at the start. `cargo test` runs the tests in parallel, and they share nothing.

A second helper signs a user in and answers the token:

```rust
    async fn token(server: &TestServer, username: &str, password: &str) -> String {
        let token: Token = server
            .client()
            .post(server.url("/login"))
            .json(&json!({ "username": username, "password": password }))
            .send()
            .await
            .unwrap()
            .json()
            .await
            .unwrap();
        token.access_token
    }
```

`server.client()` is a [`reqwest::Client`](https://docs.rs/reqwest/latest/reqwest/struct.Client.html) set up for the server, and `server.url(path)` builds the full address of a path. `json!` writes a JSON body inline, and `.json()` on the response reads it into `Token`, which is why `Token` derives `Deserialize` as well as `Serialize`. In a test, `unwrap()` is the usual way to fail on an error.

## The Tests

Each `#[tokio::test]` is an async test that runs on its own Tokio runtime.

**Storing and reading a bookmark:**

```rust
    #[tokio::test]
    async fn creates_and_reads_a_bookmark() {
        let server = spawn().await;
        let token = token(&server, "bob", "bob-pass").await;

        let response = server
            .client()
            .post(server.url("/bookmarks"))
            .bearer_auth(&token)
            .json(&json!({ "url": "https://tokio.rs", "title": "Tokio", "tags": ["rust"] }))
            .send()
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::CREATED);
        let created: Bookmark = response.json().await.unwrap();
        assert_eq!(created.owner, "bob");

        let fetched: Bookmark = server
            .client()
            .get(server.url(&format!("/bookmarks/{}", created.id)))
            .send()
            .await
            .unwrap()
            .json()
            .await
            .unwrap();
        assert_eq!(fetched.title, "Tokio");

        server.shutdown().await;
    }
```

**No token, no bookmark:**

```rust
    #[tokio::test]
    async fn refuses_to_create_without_a_token() {
        let server = spawn().await;

        let response = server
            .client()
            .post(server.url("/bookmarks"))
            .json(&json!({ "url": "https://tokio.rs", "title": "Tokio" }))
            .send()
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);

        server.shutdown().await;
    }
```

**Every broken rule is reported.** The body is read as an untyped `serde_json::Value`, which is enough to look into the Problem Details:

```rust
    #[tokio::test]
    async fn reports_every_invalid_field() {
        let server = spawn().await;
        let token = token(&server, "bob", "bob-pass").await;

        let response = server
            .client()
            .post(server.url("/bookmarks"))
            .bearer_auth(&token)
            .json(&json!({ "url": "tokio.rs", "title": "" }))
            .send()
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        let problem: Value = response.json().await.unwrap();
        assert!(problem["errors"]["url"].is_array());
        assert!(problem["errors"]["title"].is_array());

        server.shutdown().await;
    }
```

**Only the owner deletes.** Alice stores a bookmark, bob may not delete it, alice may:

```rust
    #[tokio::test]
    async fn deletes_only_own_bookmarks() {
        let server = spawn().await;
        let alice = token(&server, "alice", "alice-pass").await;
        let bob = token(&server, "bob", "bob-pass").await;

        let created: Bookmark = server
            .client()
            .post(server.url("/bookmarks"))
            .bearer_auth(&alice)
            .json(&json!({ "url": "https://tokio.rs", "title": "Tokio" }))
            .send()
            .await
            .unwrap()
            .json()
            .await
            .unwrap();
        let url = server.url(&format!("/bookmarks/{}", created.id));

        let response = server
            .client()
            .delete(&url)
            .bearer_auth(&bob)
            .send()
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::FORBIDDEN);

        let response = server
            .client()
            .delete(&url)
            .bearer_auth(&alice)
            .send()
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::NO_CONTENT);

        server.shutdown().await;
    }
}
```

`server.shutdown()` stops the server and waits for it, so each test ends at a known point.

## Run Them

```bash
> cargo test
running 4 tests
test tests::refuses_to_create_without_a_token ... ok
test tests::reports_every_invalid_field ... ok
test tests::creates_and_reads_a_bookmark ... ok
test tests::deletes_only_own_bookmarks ... ok

test result: ok. 4 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out
```

::: details The whole src/main.rs
```rust compile features="full test"
use std::collections::BTreeMap;
use std::sync::RwLock;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use volga::auth::{AuthClaims, Authenticated, BearerTokenService, DecodingKey, EncodingKey, roles};
use volga::di::Dc;
use volga::error::{Error, IntoError};
use volga::http::StatusCode;
use volga::validation::{Valid, Validate, ValidationError};
use volga::{App, HttpResult, Json, Query, ValidJson, created};

#[derive(Clone, Serialize, Deserialize)]
struct Bookmark {
    id: u64,
    url: String,
    title: String,
    tags: Vec<String>,
    owner: String,
}

#[derive(Deserialize, Validate)]
struct NewBookmark {
    #[validate(custom = "is_http_url")]
    url: String,

    #[validate(length(min = 1, max = 200, message = "must be 1 to 200 characters"))]
    title: String,

    #[serde(default)]
    #[validate(length(max = 10, message = "at most 10 tags"))]
    tags: Vec<String>,
}

fn is_http_url(url: &str) -> Result<(), ValidationError> {
    if url.starts_with("http://") || url.starts_with("https://") {
        Ok(())
    } else {
        Err(ValidationError::message(
            "must start with http:// or https://",
        ))
    }
}

#[derive(Deserialize)]
struct ListQuery {
    tag: Option<String>,
}

#[derive(Default)]
struct Bookmarks {
    inner: RwLock<Inner>,
}

#[derive(Default)]
struct Inner {
    next_id: u64,
    items: BTreeMap<u64, Bookmark>,
}

impl Bookmarks {
    fn add(&self, new: NewBookmark, owner: &str) -> Bookmark {
        let mut inner = self.inner.write().unwrap();
        inner.next_id += 1;
        let bookmark = Bookmark {
            id: inner.next_id,
            url: new.url,
            title: new.title,
            tags: new.tags,
            owner: owner.to_owned(),
        };
        inner.items.insert(bookmark.id, bookmark.clone());
        bookmark
    }

    fn get(&self, id: u64) -> Option<Bookmark> {
        self.inner.read().unwrap().items.get(&id).cloned()
    }

    fn list(&self, tag: Option<&str>) -> Vec<Bookmark> {
        let inner = self.inner.read().unwrap();
        inner
            .items
            .values()
            .filter(|b| tag.is_none_or(|tag| b.tags.iter().any(|t| t == tag)))
            .cloned()
            .collect()
    }

    fn remove(&self, id: u64) -> Option<Bookmark> {
        self.inner.write().unwrap().items.remove(&id)
    }
}

enum ApiError {
    NotFound(u64),
    NotOwner(u64),
    BadCredentials,
}

impl IntoError for ApiError {
    fn into_error(self) -> Error {
        let (status, message) = match self {
            ApiError::NotFound(id) => (
                StatusCode::NOT_FOUND,
                format!("bookmark {id} does not exist"),
            ),
            ApiError::NotOwner(id) => (
                StatusCode::FORBIDDEN,
                format!("bookmark {id} belongs to another user"),
            ),
            ApiError::BadCredentials => (
                StatusCode::UNAUTHORIZED,
                "unknown user name or password".to_owned(),
            ),
        };
        (status, message).into()
    }
}

#[derive(Clone, Serialize, Deserialize)]
struct Claims {
    sub: String,
    role: String,
    exp: u64,
}

impl AuthClaims for Claims {
    fn role(&self) -> Option<&str> {
        Some(&self.role)
    }
}

#[derive(Deserialize)]
struct Login {
    username: String,
    password: String,
}

#[derive(Serialize, Deserialize)]
struct Token {
    access_token: String,
}

async fn login(Json(login): Json<Login>, bts: BearerTokenService) -> Result<Json<Token>, Error> {
    // A demo user list. A real service looks the user up and checks a password hash.
    let role = match (login.username.as_str(), login.password.as_str()) {
        ("alice", "alice-pass") => "admin",
        ("bob", "bob-pass") => "user",
        _ => return Err(ApiError::BadCredentials.into()),
    };

    let exp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .saturating_add(Duration::from_secs(3600))
        .as_secs();

    let claims = Claims {
        sub: login.username,
        role: role.to_owned(),
        exp,
    };
    let access_token = bts.encode(&claims)?.to_string();
    Ok(Json(Token { access_token }))
}

async fn list_bookmarks(query: Query<ListQuery>, store: Dc<Bookmarks>) -> Json<Vec<Bookmark>> {
    Json(store.list(query.tag.as_deref()))
}

async fn get_bookmark(id: u64, store: Dc<Bookmarks>) -> Result<Json<Bookmark>, ApiError> {
    store.get(id).map(Json).ok_or(ApiError::NotFound(id))
}

async fn create_bookmark(
    user: Authenticated<Claims>,
    Valid(Json(new)): ValidJson<NewBookmark>,
    store: Dc<Bookmarks>,
) -> HttpResult {
    let bookmark = store.add(new, &user.sub);
    created!(bookmark)
}

async fn delete_bookmark(
    id: u64,
    user: Authenticated<Claims>,
    store: Dc<Bookmarks>,
) -> Result<StatusCode, ApiError> {
    let bookmark = store.get(id).ok_or(ApiError::NotFound(id))?;
    if bookmark.owner != user.sub && user.role != "admin" {
        return Err(ApiError::NotOwner(id));
    }
    store.remove(id);
    Ok(StatusCode::NO_CONTENT)
}

fn configure(app: App, secret: &str) -> App {
    app.with_bearer_auth(|auth| {
        auth.set_encoding_key(EncodingKey::from_secret(secret.as_bytes()))
            .set_decoding_key(DecodingKey::from_secret(secret.as_bytes()))
    })
}

fn routes(app: &mut App) {
    app.add_singleton(Bookmarks::default());
    app.map_problem();

    app.map_post("/login", login);

    app.group("/bookmarks", |bookmarks| {
        bookmarks.map_get("", list_bookmarks);
        bookmarks.map_get("/{id}", get_bookmark);
        bookmarks
            .map_post("", create_bookmark)
            .authorize::<Claims>(roles(["admin", "user"]));
        bookmarks
            .map_delete("/{id}", delete_bookmark)
            .authorize::<Claims>(roles(["admin", "user"]));
    });
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let secret = std::env::var("JWT_SECRET").expect("JWT_SECRET must be set");

    let mut app = configure(App::new(), &secret);
    routes(&mut app);
    app.run().await
}

#[cfg(test)]
mod tests {
    use super::{Bookmark, Token, configure, routes};
    use serde_json::{Value, json};
    use volga::{App, http::StatusCode, test::TestServer};

    const SECRET: &str = "test-secret";

    async fn spawn() -> TestServer {
        TestServer::builder()
            .configure(|app: App| configure(app, SECRET))
            .setup(routes)
            .build()
            .await
    }

    async fn token(server: &TestServer, username: &str, password: &str) -> String {
        let token: Token = server
            .client()
            .post(server.url("/login"))
            .json(&json!({ "username": username, "password": password }))
            .send()
            .await
            .unwrap()
            .json()
            .await
            .unwrap();
        token.access_token
    }

    #[tokio::test]
    async fn creates_and_reads_a_bookmark() {
        let server = spawn().await;
        let token = token(&server, "bob", "bob-pass").await;

        let response = server
            .client()
            .post(server.url("/bookmarks"))
            .bearer_auth(&token)
            .json(&json!({ "url": "https://tokio.rs", "title": "Tokio", "tags": ["rust"] }))
            .send()
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::CREATED);
        let created: Bookmark = response.json().await.unwrap();
        assert_eq!(created.owner, "bob");

        let fetched: Bookmark = server
            .client()
            .get(server.url(&format!("/bookmarks/{}", created.id)))
            .send()
            .await
            .unwrap()
            .json()
            .await
            .unwrap();
        assert_eq!(fetched.title, "Tokio");

        server.shutdown().await;
    }

    #[tokio::test]
    async fn refuses_to_create_without_a_token() {
        let server = spawn().await;

        let response = server
            .client()
            .post(server.url("/bookmarks"))
            .json(&json!({ "url": "https://tokio.rs", "title": "Tokio" }))
            .send()
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);

        server.shutdown().await;
    }

    #[tokio::test]
    async fn reports_every_invalid_field() {
        let server = spawn().await;
        let token = token(&server, "bob", "bob-pass").await;

        let response = server
            .client()
            .post(server.url("/bookmarks"))
            .bearer_auth(&token)
            .json(&json!({ "url": "tokio.rs", "title": "" }))
            .send()
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        let problem: Value = response.json().await.unwrap();
        assert!(problem["errors"]["url"].is_array());
        assert!(problem["errors"]["title"].is_array());

        server.shutdown().await;
    }

    #[tokio::test]
    async fn deletes_only_own_bookmarks() {
        let server = spawn().await;
        let alice = token(&server, "alice", "alice-pass").await;
        let bob = token(&server, "bob", "bob-pass").await;

        let created: Bookmark = server
            .client()
            .post(server.url("/bookmarks"))
            .bearer_auth(&alice)
            .json(&json!({ "url": "https://tokio.rs", "title": "Tokio" }))
            .send()
            .await
            .unwrap()
            .json()
            .await
            .unwrap();
        let url = server.url(&format!("/bookmarks/{}", created.id));

        let response = server
            .client()
            .delete(&url)
            .bearer_auth(&bob)
            .send()
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::FORBIDDEN);

        let response = server
            .client()
            .delete(&url)
            .bearer_auth(&alice)
            .send()
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::NO_CONTENT);

        server.shutdown().await;
    }
}
```
:::

## Where to Go Next

The service is small, but its shape is the one a larger Volga service has. Some next steps:

* **A real database.** Replace `Bookmarks` with a type that holds a connection pool and register it with `add_singleton` in the same way. The handlers do not change, and a test can register a fake in its place in `setup`. [Dependency Injection](/volga-docs/en/advanced-patterns/di.html) shows factories and the scoped and transient lifetimes.
* **Settings from a file.** Read the secret and the port from `app_config.toml`; see [Configuration Files](/volga-docs/en/middleware-infrastructure/config-files.html).
* **An OpenAPI description.** Describe the routes and serve Swagger UI; see [OpenAPI](/volga-docs/en/middleware-infrastructure/openapi.html).
* **Logs.** Trace every request; see [Tracing & Logging](/volga-docs/en/reliability-observability/tracing.html).
* **Limits.** Protect `/login` from guessing with [Rate Limiting](/volga-docs/en/middleware-infrastructure/rate-limiting.html).
