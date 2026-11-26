# Валидация и ошибки

Сервис из [предыдущей главы](/volga-docs/ru/tutorial/first-routes.html) сохраняет всё, что ему присылают, и отвечает на ошибки в трёх разных формах. В этой главе он проверяет каждую новую закладку перед сохранением, получает собственный тип ошибки и отвечает на любую ошибку, свою и Волги, в формате [Problem Details](https://www.rfc-editor.org/rfc/rfc9457).

## Правила для новой закладки

Правила записываются на типе, как Data Annotations в .NET или Bean Validation в Java. `Validate` даёт фича `validation-derive`, которая входит в `full`:

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

`length` считает символы в строке и элементы в списке. Правило, для которого у derive нет слова, уходит в функцию, названную в `custom`; она отвечает `Ok(())` или причиной, по которой значение неверно.

Обработчик просит проверенное тело, оборачивая свой экстрактор в `Valid`. `ValidJson<T>` это короткое имя для `Valid<Json<T>>`:

```rust
async fn create_bookmark(
    Valid(Json(new)): ValidJson<NewBookmark>,
    store: Dc<Bookmarks>,
) -> HttpResult {
    let bookmark = store.add(new);
    created!(bookmark)
}
```

Правила выполняются после чтения JSON и до вызова обработчика, так что `create_bookmark` видит только закладки, которые их прошли. Тело, которое их нарушает, получает `400` со списком всех нарушенных правил, а не только первого. Все правила описаны в разделе [Валидация запросов](/volga-docs/ru/requests-responses/validation.html).

## Собственный тип ошибки

`get_bookmark` и `delete_bookmark` отвечали `not_found!()`. Это ответ со статусом `404`, построенный обработчиком, и больше никто в приложении не знает, что он означает ошибку. Чтобы у ошибок была одна форма, обработчики должны возвращать их как ошибки.

В Rust ошибка это значение. Функция, которая может не сработать, возвращает [`Result<T, E>`](https://doc.rust-lang.org/book/ch09-02-recoverable-errors-with-result.html): `Ok(value)` или `Err(error)`. Вместо класса исключения на каждый сбой сервис объявляет одно перечисление всего, что может пойти не так, и говорит, какой HTTP-ошибкой становится каждый вариант, реализуя `IntoError`:

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

Пока у перечисления один вариант, следующая глава добавит ещё два. Обработчик, который возвращает `Result<T, ApiError>`, отвечает на `Ok` ответом и передаёт `Err` обработчику ошибок:

```rust
async fn get_bookmark(id: u64, store: Dc<Bookmarks>) -> Result<Json<Bookmark>, ApiError> {
    store.get(id).map(Json).ok_or(ApiError::NotFound(id))
}

async fn delete_bookmark(id: u64, store: Dc<Bookmarks>) -> Result<StatusCode, ApiError> {
    store.remove(id).ok_or(ApiError::NotFound(id))?;
    Ok(StatusCode::NO_CONTENT)
}
```

`ok_or` превращает `Option` хранилища в `Result`: `Some(bookmark)` становится `Ok`, а `None` становится переданной ошибкой. `?` после него сразу возвращает эту ошибку из обработчика, а иначе продолжает со значением; так код на Rust передаёт ошибку наверх без `try`/`catch`. `StatusCode` сам по себе тоже ответ, поэтому `Ok(StatusCode::NO_CONTENT)` отвечает `204`.

## Problem Details для любой ошибки

Одна строка в `routes` заставляет обработчик ошибок отвечать в формате Problem Details:

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

`map_problem()` обрабатывает все ошибки приложения: `ApiError`, тело, не прошедшее валидацию, путь, который не разбирается, несуществующий маршрут. Это аналог `AddProblemDetails()` в ASP.NET Core. Чтобы отвечать на ошибки в собственном формате, зарегистрируйте вместо него обработчик через `map_err`; см. [Обработка ошибок](/volga-docs/ru/reliability-observability/errors.html).

## Попробуйте

Перезапустите сервер командой `cargo run`. Ответы ниже отформатированы для чтения:

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

Удалить любую закладку по-прежнему может кто угодно. Следующая глава добавляет пользователей.

::: details Весь src/main.rs
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

Дальше: [Аутентификация](/volga-docs/ru/tutorial/authentication.html).
