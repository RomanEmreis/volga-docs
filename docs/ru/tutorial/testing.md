# Тестирование

Сервис готов; эта глава следит, чтобы он таким и остался. Тесты запускают весь сервис на свободном локальном порту и отправляют ему настоящие HTTP-запросы, как `WebApplicationFactory` в ASP.NET Core или `httptest.NewServer` в Go. Такой тест проверяет маршрутизацию, валидацию, аутентификацию и обработку ошибок вместе.

## Подготовка

[`TestServer`](/volga-docs/ru/reliability-observability/testing.html) Волги находится за фичей `test`, которая нужна только тестам, поэтому она записывается в `[dev-dependencies]`, рядом с [`serde_json`](https://docs.rs/serde_json) для записи тел запросов:

```toml
[dev-dependencies]
volga = { version = "0.15", features = ["test"] }
serde_json = "1"
```

При сборке тестов Cargo объединяет эти фичи с фичами из `[dependencies]`, так что тесты получают `full` и `test` вместе.

## Тестовый сервер

Тесты бинарного крейта живут в том же файле, что и его код, в модуле, который компилируется только для `cargo test`. Он идёт в конце `src/main.rs`:

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

`spawn` собирает приложение так же, как `main`, из тех же `configure` и `routes`, но с собственным секретом теста вместо переменной окружения. Вот почему предыдущие главы держали их вне `main`. Шаг `configure` у builder принимает настройки `App`, а `setup` регистрирует маршруты и сервисы.

`routes` регистрирует и хранилище, поэтому у каждого тестового сервера своё хранилище, пустое в начале. `cargo test` запускает тесты параллельно, и у них нет ничего общего.

Второй помощник выполняет вход пользователя и возвращает токен:

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

`server.client()` это [`reqwest::Client`](https://docs.rs/reqwest/latest/reqwest/struct.Client.html), настроенный на сервер, а `server.url(path)` строит полный адрес пути. `json!` записывает тело JSON прямо в коде, а `.json()` на ответе читает его в `Token`; поэтому `Token` выводит не только `Serialize`, но и `Deserialize`. В тесте `unwrap()` это обычный способ упасть на ошибке.

## Тесты

Каждый `#[tokio::test]` это асинхронный тест, который работает на собственном рантайме Tokio.

**Сохранение и чтение закладки:**

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

**Нет токена, нет закладки:**

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

**Сообщается о каждом нарушенном правиле.** Тело читается как нетипизированное `serde_json::Value`, этого достаточно, чтобы заглянуть в Problem Details:

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

**Удаляет только владелец.** alice сохраняет закладку, bob удалить её не может, а alice может:

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

`server.shutdown()` останавливает сервер и дожидается его, так что каждый тест заканчивается в известной точке.

## Запустите

```bash
> cargo test
running 4 tests
test tests::refuses_to_create_without_a_token ... ok
test tests::reports_every_invalid_field ... ok
test tests::creates_and_reads_a_bookmark ... ok
test tests::deletes_only_own_bookmarks ... ok

test result: ok. 4 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out
```

::: details Весь src/main.rs
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

## Что дальше

Сервис небольшой, но устроен так же, как устроен сервис на Волге побольше. Несколько следующих шагов:

* **Настоящая база данных.** Замените `Bookmarks` типом, который держит пул соединений, и зарегистрируйте его через `add_singleton` так же. Обработчики не меняются, а тест может зарегистрировать вместо него подделку в `setup`. Фабрики и времена жизни Scoped и Transient описаны в разделе [Внедрение зависимостей](/volga-docs/ru/advanced-patterns/di.html).
* **Настройки из файла.** Читайте секрет и порт из `app_config.toml`; см. [Файлы конфигурации](/volga-docs/ru/middleware-infrastructure/config-files.html).
* **Описание OpenAPI.** Опишите маршруты и раздавайте Swagger UI; см. [OpenAPI](/volga-docs/ru/middleware-infrastructure/openapi.html).
* **Логи.** Трассируйте каждый запрос; см. [Логгирование и Трассировка](/volga-docs/ru/reliability-observability/tracing.html).
* **Ограничения.** Защитите `/login` от подбора паролей с помощью [Rate Limiting](/volga-docs/ru/middleware-infrastructure/rate-limiting.html).
