# Validation and Errors

The service from the [previous chapter](/volga-docs/en/tutorial/first-routes.html) stores whatever it is sent, and answers errors in three different shapes. In this chapter it checks every new bookmark before storing it, gets an error type of its own, and answers every error, its own and Volga's, as [Problem Details](https://www.rfc-editor.org/rfc/rfc9457).

## Rules for a New Bookmark

The rules go on the type, as Data Annotations do in .NET or Bean Validation in Java. `Validate` comes with the `validation-derive` feature, which `full` includes:

```rust
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
```

`length` counts characters in a string and elements in a list. A rule the derive has no word for goes into a function named by `custom`, which answers `Ok(())` or the reason the value is wrong.

The handler asks for a validated body by wrapping its extractor in `Valid`. `ValidJson<T>` is the short name for `Valid<Json<T>>`:

```rust
async fn create_bookmark(
    Valid(Json(new)): ValidJson<NewBookmark>,
    store: Dc<Bookmarks>,
) -> HttpResult {
    let bookmark = store.add(new);
    created!(bookmark)
}
```

The rules run after the JSON is read and before the handler is called, so `create_bookmark` sees only bookmarks that passed. A body that breaks them is answered `400`, with every broken rule listed, not only the first. All the rules are in [Validating Requests](/volga-docs/en/requests-responses/validation.html).

## An Error Type of Your Own

`get_bookmark` and `delete_bookmark` answered `not_found!()`. That is a response with a `404` status, built by the handler, and nothing else in the application knows it means an error. To give errors one shape, the handlers have to return them as errors.

In Rust an error is a value. A function that can fail returns [`Result<T, E>`](https://doc.rust-lang.org/book/ch09-02-recoverable-errors-with-result.html): `Ok(value)` or `Err(error)`. Instead of an exception class per failure, the service declares one enum of everything that can go wrong, and says how each case becomes an HTTP error by implementing `IntoError`:

```rust
enum ApiError {
    NotFound(u64),
}

impl IntoError for ApiError {
    fn into_error(self) -> Error {
        let (status, message) = match self {
            ApiError::NotFound(id) => (
                StatusCode::NOT_FOUND,
                format!("bookmark {id} does not exist"),
            ),
        };
        (status, message).into()
    }
}
```

The enum has one case for now, and the next chapter adds two. A handler that returns `Result<T, ApiError>` answers `Ok` as a response and hands `Err` to the error handler:

```rust
async fn get_bookmark(id: u64, store: Dc<Bookmarks>) -> Result<Json<Bookmark>, ApiError> {
    store.get(id).map(Json).ok_or(ApiError::NotFound(id))
}

async fn delete_bookmark(id: u64, store: Dc<Bookmarks>) -> Result<StatusCode, ApiError> {
    store.remove(id).ok_or(ApiError::NotFound(id))?;
    Ok(StatusCode::NO_CONTENT)
}
```

`ok_or` turns the store's `Option` into a `Result`: `Some(bookmark)` becomes `Ok`, and `None` becomes the error given. The `?` after it returns that error from the handler on the spot and otherwise goes on with the value, which is how Rust code passes an error up without `try`/`catch`. A `StatusCode` on its own is a response too, so `Ok(StatusCode::NO_CONTENT)` answers `204`.

## Problem Details for Every Error

One line in `routes` makes the error handler answer in the Problem Details format:

```rust
fn routes(app: &mut App) {
    app.add_singleton(Bookmarks::default());
    app.map_problem();

    app.group("/bookmarks", |bookmarks| {
        bookmarks.map_get("", list_bookmarks);
        bookmarks.map_post("", create_bookmark);
        bookmarks.map_get("/{id}", get_bookmark);
        bookmarks.map_delete("/{id}", delete_bookmark);
    });
}
```

`map_problem()` handles every error of the application: the `ApiError`s, a body that failed validation, a path that does not parse, a route that does not exist. It is the counterpart of `AddProblemDetails()` in ASP.NET Core. To answer errors in a format of your own, register a handler with `map_err` instead; see [Error Handling](/volga-docs/en/reliability-observability/errors.html).

## Try It

Restart the server with `cargo run`. The responses below are formatted for reading:

```bash
> curl -i -X POST http://localhost:7878/bookmarks -H "Content-Type: application/json" \
    -d '{"url":"tokio.rs","title":""}'
HTTP/1.1 400 Bad Request
content-type: application/problem+json

{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.1",
  "title": "Bad Request",
  "status": 400,
  "detail": "url: must start with http:// or https://; title: must be 1 to 200 characters",
  "instance": "/bookmarks",
  "errors": {
    "title": ["must be 1 to 200 characters"],
    "url": ["must start with http:// or https://"]
  }
}

> curl -i http://localhost:7878/bookmarks/7
HTTP/1.1 404 Not Found
content-type: application/problem+json

{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.5",
  "title": "Not Found",
  "status": 404,
  "detail": "bookmark 7 does not exist",
  "instance": "/bookmarks/7"
}

> curl http://localhost:7878/bookmarks/abc
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.1",
  "title": "Bad Request",
  "status": 400,
  "detail": "Path parsing error: argument `id` type mismatch",
  "instance": "/bookmarks/abc"
}
```

Anyone can still delete any bookmark. The next chapter adds users.

::: details The whole src/main.rs
```rust compile
use std::collections::BTreeMap;
use std::sync::RwLock;

use serde::{Deserialize, Serialize};
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
    fn add(&self, new: NewBookmark) -> Bookmark {
        let mut inner = self.inner.write().unwrap();
        inner.next_id += 1;
        let bookmark = Bookmark {
            id: inner.next_id,
            url: new.url,
            title: new.title,
            tags: new.tags,
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
}

impl IntoError for ApiError {
    fn into_error(self) -> Error {
        let (status, message) = match self {
            ApiError::NotFound(id) => (
                StatusCode::NOT_FOUND,
                format!("bookmark {id} does not exist"),
            ),
        };
        (status, message).into()
    }
}

async fn list_bookmarks(query: Query<ListQuery>, store: Dc<Bookmarks>) -> Json<Vec<Bookmark>> {
    Json(store.list(query.tag.as_deref()))
}

async fn get_bookmark(id: u64, store: Dc<Bookmarks>) -> Result<Json<Bookmark>, ApiError> {
    store.get(id).map(Json).ok_or(ApiError::NotFound(id))
}

async fn create_bookmark(
    Valid(Json(new)): ValidJson<NewBookmark>,
    store: Dc<Bookmarks>,
) -> HttpResult {
    let bookmark = store.add(new);
    created!(bookmark)
}

async fn delete_bookmark(id: u64, store: Dc<Bookmarks>) -> Result<StatusCode, ApiError> {
    store.remove(id).ok_or(ApiError::NotFound(id))?;
    Ok(StatusCode::NO_CONTENT)
}

fn routes(app: &mut App) {
    app.add_singleton(Bookmarks::default());
    app.map_problem();

    app.group("/bookmarks", |bookmarks| {
        bookmarks.map_get("", list_bookmarks);
        bookmarks.map_post("", create_bookmark);
        bookmarks.map_get("/{id}", get_bookmark);
        bookmarks.map_delete("/{id}", delete_bookmark);
    });
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();
    routes(&mut app);
    app.run().await
}
```
:::

Next: [Authentication](/volga-docs/en/tutorial/authentication.html).
