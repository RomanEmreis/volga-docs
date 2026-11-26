# Authentication

So far anyone can store and delete any bookmark. In this chapter users sign in and get a JWT, storing a bookmark takes a valid token, and a bookmark remembers who stored it, so only its owner or an admin can delete it. Reading stays open to everyone.

## Claims

The claims are the data a token carries. Here they are the user name, the role and the expiry time:

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

`sub` (subject) and `exp` (expiry, in seconds since the Unix epoch) are standard JWT claims, and Volga refuses a token whose `exp` has passed. Implementing the `AuthClaims` [trait](https://doc.rust-lang.org/book/ch10-02-traits.html) tells Volga where the role is, so that a route can ask for one. A claims type can also report several roles or permissions; see [Defining Claims](/volga-docs/en/security-access/auth.html#defining-claims).

## Configure Bearer Authentication

The keys that sign and check tokens are set when the `App` is built:

```rust
fn configure(app: App, secret: &str) -> App {
    app.with_bearer_auth(|auth| {
        auth.set_encoding_key(EncodingKey::from_secret(secret.as_bytes()))
            .set_decoding_key(DecodingKey::from_secret(secret.as_bytes()))
    })
}
```

The service issues its own tokens, so it needs both keys: one to sign tokens and one to check them. With a shared secret, the two are made from the same bytes. `with_bearer_auth` is one of the `App`'s settings, the `with_*` methods called on `App::new()` before routes are added. It sits in a function of its own for the same reason `routes` does: the tests will configure their server with it.

`main` reads the secret from the environment and builds the app from both functions:

```rust
#[tokio::main]
async fn main() -> std::io::Result<()> {
    let secret = std::env::var("JWT_SECRET").expect("JWT_SECRET must be set");

    let mut app = configure(App::new(), &secret);
    routes(&mut app);
    app.run().await
}
```

`expect` stops the program with that message when the variable is not set, which is what a service without a key should do.

## Issue Tokens

`POST /login` checks a user name and password and answers a token:

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

`Login` and `Token` are two small structs, `{ username, password }` read from the body and `{ access_token }` written to it. `BearerTokenService` is an extractor too: it hands the handler the keys configured above, and `encode` signs the claims with them.

The handler returns `Result<Json<Token>, Error>`, with Volga's own [`Error`](https://docs.rs/volga/latest/volga/error/struct.Error.html), because two kinds of error can come out of it: an `ApiError` and a failure of `encode`. `?` converts both into `Error`, and `.into()` does the same for `BadCredentials`.

The new cases join `ApiError`:

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

`match` must cover every case of an enum, so the program does not compile until `into_error` says what the new ones answer.

## Protect the Routes

`authorize` on a route lets a request through only with a valid token that carries one of the given roles:

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

A request without a token is answered `401`, one with a token that is expired or badly signed `401` as well, and one whose role is not in the list `403`. These are errors, so `map_problem()` answers them as Problem Details too. `authorize` also works on a whole group or on the `App`, the way `RequireAuthorization` does on a route group in ASP.NET Core.

## Know Who Is Calling

A handler behind `authorize` reads the verified claims with the `Authenticated<Claims>` extractor:

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

`user.sub` reads the claims field straight through the wrapper. A bookmark now has an `owner: String` field, and `Bookmarks::add` takes the owner as a second argument, `owner: &str`, and stores `owner.to_owned()` in it.

::: warning
`Authenticated<T>` reads the claims that `authorize` checked, so it works only on a route, group or app that has `authorize`. On a route without it, the handler is never entered and the request is answered `500`.
:::

## Try It

Set the secret and start the server:

```bash
JWT_SECRET=dev-secret cargo run
```

Sign in as bob, then store a bookmark with the token:

```bash
> curl -X POST http://localhost:7878/login -H "Content-Type: application/json" \
    -d '{"username":"bob","password":"bob-pass"}'
{"access_token":"eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."}

> TOKEN=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...

> curl -X POST http://localhost:7878/bookmarks -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" -d '{"url":"https://tokio.rs","title":"Tokio"}'
{"id":1,"url":"https://tokio.rs","title":"Tokio","tags":[],"owner":"bob"}
```

Without the token the same request is refused:

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

Sign in as alice the same way and try to delete bob's bookmark with alice's token: it succeeds with `204`, as alice is an admin. A bookmark of alice's, deleted with bob's token, is answered `403` with `"detail": "bookmark 2 belongs to another user"`.

::: tip Running behind a proxy
Volga refuses a bearer token sent over plain HTTP from anywhere but the local machine, since anyone on the way could read it. Locally that never gets in the way. When the service runs behind a reverse proxy that terminates TLS, turn the check off with [`require_https(false)`](/volga-docs/en/security-access/auth.html#bearer-auth-configuration).
:::

::: details The whole src/main.rs
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

Next: [Testing](/volga-docs/en/tutorial/testing.html).
