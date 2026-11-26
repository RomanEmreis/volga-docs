# Аутентификация

Пока что любой может сохранить и удалить любую закладку. В этой главе пользователи входят и получают JWT, для сохранения закладки нужен действительный токен, а закладка помнит, кто её сохранил, так что удалить её может только владелец или администратор. Чтение остаётся открытым для всех.

## Claims

Claims это данные, которые несёт токен. Здесь это имя пользователя, роль и время истечения:

```rust
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
```

`sub` (subject, субъект) и `exp` (expiry, истечение в секундах от начала эпохи Unix) это стандартные claims JWT, и Волга отклоняет токен, чей `exp` уже прошёл. Реализация [типажа](https://doc.rust-lang.org/book/ch10-02-traits.html) `AuthClaims` говорит Волге, где лежит роль, чтобы маршрут мог её потребовать. Тип claims может сообщать и несколько ролей или разрешений; см. [Определение структуры Claims](/volga-docs/ru/security-access/auth.html#определение-структуры-claims).

## Настройте Bearer-аутентификацию

Ключи, которые подписывают и проверяют токены, задаются при сборке `App`:

```rust
fn configure(app: App, secret: &str) -> App {
    app.with_bearer_auth(|auth| {
        auth.set_encoding_key(EncodingKey::from_secret(secret.as_bytes()))
            .set_decoding_key(DecodingKey::from_secret(secret.as_bytes()))
    })
}
```

Сервис сам выпускает токены, поэтому ему нужны оба ключа: один подписывает токены, другой их проверяет. С общим секретом оба делаются из одних и тех же байтов. `with_bearer_auth` относится к настройкам `App`, методам `with_*`, которые вызываются на `App::new()` до добавления маршрутов. Она вынесена в отдельную функцию по той же причине, что и `routes`: тесты настроят ею свой сервер.

`main` читает секрет из окружения и собирает приложение из обеих функций:

```rust
#[tokio::main]
async fn main() -> std::io::Result<()> {
    let secret = std::env::var("JWT_SECRET").expect("JWT_SECRET must be set");

    let mut app = configure(App::new(), &secret);
    routes(&mut app);
    app.run().await
}
```

`expect` останавливает программу с этим сообщением, если переменная не задана; именно так и должен поступать сервис без ключа.

## Выпуск токенов

`POST /login` проверяет имя пользователя и пароль и отвечает токеном:

```rust
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
```

`Login` и `Token` это две небольшие структуры: `{ username, password }` читается из тела, а `{ access_token }` записывается в него. `BearerTokenService` тоже экстрактор: он даёт обработчику настроенные выше ключи, а `encode` подписывает ими claims.

Обработчик возвращает `Result<Json<Token>, Error>` с собственным [`Error`](https://docs.rs/volga/latest/volga/error/struct.Error.html) Волги, потому что из него выходят ошибки двух видов: `ApiError` и сбой `encode`. `?` превращает обе в `Error`, а `.into()` делает то же для `BadCredentials`.

Новые варианты добавляются в `ApiError`:

```rust
enum ApiError {
    NotFound(u64),
    NotOwner(u64),
    BadCredentials,
}
```

```rust
            ApiError::NotOwner(id) => (
                StatusCode::FORBIDDEN,
                format!("bookmark {id} belongs to another user"),
            ),
            ApiError::BadCredentials => (
                StatusCode::UNAUTHORIZED,
                "unknown user name or password".to_owned(),
            ),
```

`match` обязан покрыть все варианты перечисления, поэтому программа не скомпилируется, пока `into_error` не скажет, чем отвечают новые.

## Защитите маршруты

`authorize` на маршруте пропускает запрос только с действительным токеном, который несёт одну из указанных ролей:

```rust
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
```

Запрос без токена получает `401`, с просроченным или неверно подписанным токеном тоже `401`, а с ролью не из списка `403`. Это ошибки, поэтому `map_problem()` и на них отвечает в формате Problem Details. `authorize` работает и на целой группе или на `App`, как `RequireAuthorization` на группе маршрутов в ASP.NET Core.

## Кто вызывает

Обработчик за `authorize` читает проверенные claims экстрактором `Authenticated<Claims>`:

```rust
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
```

`user.sub` читает поле claims прямо через обёртку. У закладки теперь есть поле `owner: String`, а `Bookmarks::add` принимает владельца вторым аргументом, `owner: &str`, и сохраняет в это поле `owner.to_owned()`.

::: warning
`Authenticated<T>` читает claims, которые проверил `authorize`, поэтому работает только на маршруте, группе или приложении с `authorize`. На маршруте без него обработчик не вызывается, а запрос получает `500`.
:::

## Попробуйте

Задайте секрет и запустите сервер:

```bash
JWT_SECRET=dev-secret cargo run
```

Войдите как bob и сохраните закладку с полученным токеном:

```bash
> curl -X POST http://localhost:7878/login -H "Content-Type: application/json" \
    -d '{"username":"bob","password":"bob-pass"}'
{"access_token":"eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."}

> TOKEN=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...

> curl -X POST http://localhost:7878/bookmarks -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" -d '{"url":"https://tokio.rs","title":"Tokio"}'
{"id":1,"url":"https://tokio.rs","title":"Tokio","tags":[],"owner":"bob"}
```

Без токена тот же запрос отклоняется:

```bash
> curl -i -X POST http://localhost:7878/bookmarks -H "Content-Type: application/json" \
    -d '{"url":"https://tokio.rs","title":"Tokio"}'
HTTP/1.1 401 Unauthorized
content-type: application/problem+json
www-authenticate: Bearer

{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.2",
  "title": "Unauthorized",
  "status": 401,
  "detail": "Bearer token is missing",
  "instance": "/bookmarks"
}
```

Войдите так же как alice и попробуйте удалить закладку bob её токеном: удаление пройдёт с `204`, потому что alice администратор. Закладка alice, удаляемая с токеном bob, получит `403` с `"detail": "bookmark 2 belongs to another user"`.

::: tip За прокси
Волга отклоняет bearer-токен, присланный по обычному HTTP откуда-либо, кроме локальной машины, потому что его может прочитать любой по дороге. Локально это никогда не мешает. Если сервис работает за обратным прокси, который завершает TLS, отключите проверку через [`require_https(false)`](/volga-docs/ru/security-access/auth.html#конфигурация-bearer-auth).
:::

::: details Весь src/main.rs
```rust compile
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
```
:::

Дальше: [Тестирование](/volga-docs/ru/tutorial/testing.html).
