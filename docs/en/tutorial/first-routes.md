# Project and First Routes

In this chapter the service gets its routes: it lists, stores, reads and deletes bookmarks, in JSON, and keeps them in a store that every request shares.

## Create the Project

```bash
cargo new bookmarks
cd bookmarks
```

Add the dependencies to `Cargo.toml`:

```toml
[dependencies]
volga = { version = "0.15", features = ["full"] }
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
```

* **`volga`** with `full` turns on every part of the framework this tutorial uses: dependency injection, validation, authentication, Problem Details. A finished service can list only the [features](/volga-docs/en/getting-started/features.html) it needs.
* **`tokio`** is the async runtime Volga runs on, the way ASP.NET Core runs on the .NET thread pool.
* **`serde`** converts Rust types to and from JSON, as `System.Text.Json` or Jackson do. Its `derive` feature writes that code at compile time, with no reflection at run time.

## The Data

A bookmark the service stores, and the body a client sends to create one:

```rust
#[derive(Clone, Serialize, Deserialize)]
struct Bookmark {
    id: u64,
    url: String,
    title: String,
    tags: Vec<String>,
}

#[derive(Deserialize)]
struct NewBookmark {
    url: String,
    title: String,
    #[serde(default)]
    tags: Vec<String>,
}
```

`NewBookmark` is a separate type because the client does not choose the `id`, the service does. It plays the part of a request DTO. `#[derive(..)]` asks the compiler to [implement traits](https://doc.rust-lang.org/book/ch05-02-example-structs.html#adding-useful-functionality-with-derived-traits) for the type: `Serialize` writes it as JSON, `Deserialize` reads it, `Clone` copies it. `#[serde(default)]` lets a client leave `tags` out, which reads as an empty list.

## The Store

Every request uses the same store, possibly at the same moment, so the data sits behind a lock:

```rust
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
```

* **The methods take `&self`, not `&mut self`.** A service shared through dependency injection is reached through a shared reference, and Rust allows no changes through one unless the type says how they are made safe. [`RwLock`](https://doc.rust-lang.org/std/sync/struct.RwLock.html) does that: many readers or one writer at a time, like `ReaderWriterLockSlim` in .NET or `sync.RWMutex` in Go.
* **`unwrap()` on the lock** fails only if another thread panicked while it held the lock. For this store that is a bug worth stopping on, so the tutorial does not handle it.
* **`Option<Bookmark>`** is how Rust says "maybe nothing", in place of `null`. `get` and `remove` answer `None` for an id they do not know.
* **[`BTreeMap`](https://doc.rust-lang.org/std/collections/struct.BTreeMap.html)** keeps the bookmarks sorted by id, so the list comes out in the order they were added.

## The Handlers

A handler is an `async fn`. Its arguments say what it reads from the request, and its return type says what it answers:

```rust
async fn list_bookmarks(query: Query<ListQuery>, store: Dc<Bookmarks>) -> Json<Vec<Bookmark>> {
    Json(store.list(query.tag.as_deref()))
}

async fn get_bookmark(id: u64, store: Dc<Bookmarks>) -> HttpResult {
    match store.get(id) {
        Some(bookmark) => ok!(bookmark),
        None => not_found!(),
    }
}

async fn create_bookmark(Json(new): Json<NewBookmark>, store: Dc<Bookmarks>) -> HttpResult {
    let bookmark = store.add(new);
    created!(bookmark)
}

async fn delete_bookmark(id: u64, store: Dc<Bookmarks>) -> HttpResult {
    match store.remove(id) {
        Some(_) => no_content!(),
        None => not_found!(),
    }
}
```

| Argument | Where it comes from |
|---|---|
| `id: u64` | the `{id}` segment of the path |
| `Query<ListQuery>` | the query string, `?tag=rust`, read into a struct |
| `Json<NewBookmark>` | the body, read as JSON |
| `Dc<Bookmarks>` | the dependency injection container |

`ListQuery` is one more struct with `#[derive(Deserialize)]` and a single field, `tag: Option<String>`, so a request without `?tag=` is fine. `Json(new)` in the argument list takes the value out of the wrapper right there; this is a [pattern](https://doc.rust-lang.org/book/ch19-00-patterns.html), the same one `match` uses.

A request whose `id` is not a number, or whose body is not valid JSON, never reaches a handler: Volga answers it `400`, because the argument types say what the request must contain. Read more in [Extractors](/volga-docs/en/getting-started/extractors.html).

On the way out, `Json<T>` answers `200` with `T` as JSON. A handler that answers with different statuses returns `HttpResult` and builds the response with a macro: `ok!`, `created!`, `not_found!` and `no_content!` here, and the rest are listed in [Responses](/volga-docs/en/getting-started/responses.html).

## The Routes

```rust
fn routes(app: &mut App) {
    app.add_singleton(Bookmarks::default());

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

* **`add_singleton`** registers one store for the whole application, like `AddSingleton` in ASP.NET Core. `Dc<Bookmarks>` in a handler resolves it. More in [Dependency Injection](/volga-docs/en/advanced-patterns/di.html).
* **`group`** puts the four routes under one prefix. `""` is the group's own path, `/bookmarks`. See [Route Groups](/volga-docs/en/getting-started/route-groups.html).
* **`routes` is a function of its own** so that `main` is not the only one who can build the app. The tests in the last chapter call it too.
* **`#[tokio::main]`** starts the async runtime and runs `main` on it. `app.run()` serves on `localhost:7878` until you stop it.

## Run It

```bash
cargo run
```

In another terminal:

```bash
> curl -i -X POST http://localhost:7878/bookmarks -H "Content-Type: application/json" \
    -d '{"url":"https://tokio.rs","title":"Tokio","tags":["rust","async"]}'
HTTP/1.1 201 Created
content-type: application/json

{"id":1,"url":"https://tokio.rs","title":"Tokio","tags":["rust","async"]}

> curl -X POST http://localhost:7878/bookmarks -H "Content-Type: application/json" \
    -d '{"url":"https://go.dev","title":"Go"}'
{"id":2,"url":"https://go.dev","title":"Go","tags":[]}

> curl "http://localhost:7878/bookmarks?tag=rust"
[{"id":1,"url":"https://tokio.rs","title":"Tokio","tags":["rust","async"]}]

> curl -i -X DELETE http://localhost:7878/bookmarks/2
HTTP/1.1 204 No Content
```

The service works, but it trusts its clients too much: it stores a bookmark with an empty title or a `url` of `"hello"`, and its errors have no common shape. A `404` arrives with an empty body, and a `400` with a line of plain text. The next chapter fixes both.

::: details The whole src/main.rs
```rust compile
use std::collections::BTreeMap;
use std::sync::RwLock;

use serde::{Deserialize, Serialize};
use volga::di::Dc;
use volga::{App, HttpResult, Json, Query, created, no_content, not_found, ok};

#[derive(Clone, Serialize, Deserialize)]
struct Bookmark {
    id: u64,
    url: String,
    title: String,
    tags: Vec<String>,
}

#[derive(Deserialize)]
struct NewBookmark {
    url: String,
    title: String,
    #[serde(default)]
    tags: Vec<String>,
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

async fn list_bookmarks(query: Query<ListQuery>, store: Dc<Bookmarks>) -> Json<Vec<Bookmark>> {
    Json(store.list(query.tag.as_deref()))
}

async fn get_bookmark(id: u64, store: Dc<Bookmarks>) -> HttpResult {
    match store.get(id) {
        Some(bookmark) => ok!(bookmark),
        None => not_found!(),
    }
}

async fn create_bookmark(Json(new): Json<NewBookmark>, store: Dc<Bookmarks>) -> HttpResult {
    let bookmark = store.add(new);
    created!(bookmark)
}

async fn delete_bookmark(id: u64, store: Dc<Bookmarks>) -> HttpResult {
    match store.remove(id) {
        Some(_) => no_content!(),
        None => not_found!(),
    }
}

fn routes(app: &mut App) {
    app.add_singleton(Bookmarks::default());

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

Next: [Validation and Errors](/volga-docs/en/tutorial/validation-errors.html).
