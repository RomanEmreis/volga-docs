# Проект и первые маршруты

В этой главе у сервиса появляются маршруты: он возвращает список закладок, сохраняет, читает и удаляет их в JSON и держит их в хранилище, общем для всех запросов.

## Создайте проект

```bash
cargo new bookmarks
cd bookmarks
```

Добавьте зависимости в `Cargo.toml`:

```toml
[dependencies]
volga = { version = "0.15", features = ["full"] }
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
```

* **`volga`** с `full` включает все части фреймворка, которые использует туториал: внедрение зависимостей, валидацию, аутентификацию, Problem Details. В готовом сервисе можно оставить только нужные [фичи](/volga-docs/ru/getting-started/features.html).
* **`tokio`** это асинхронный рантайм, на котором работает Волга, как ASP.NET Core работает на пуле потоков .NET.
* **`serde`** переводит типы Rust в JSON и обратно, как `System.Text.Json` или Jackson. Его фича `derive` пишет этот код при компиляции, без рефлексии во время работы.

## Данные

Закладка, которую хранит сервис, и тело, которое клиент присылает, чтобы её создать:

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

`NewBookmark` это отдельный тип, потому что `id` выбирает не клиент, а сервис. Это DTO запроса. `#[derive(..)]` просит компилятор [реализовать типажи](https://doc.rust-lang.org/book/ch05-02-example-structs.html#adding-useful-functionality-with-derived-traits) для типа: `Serialize` записывает его в JSON, `Deserialize` читает, `Clone` копирует. `#[serde(default)]` позволяет клиенту не присылать `tags`: такое тело читается с пустым списком.

## Хранилище

Все запросы пользуются одним хранилищем, возможно, в один и тот же момент, поэтому данные лежат за блокировкой:

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

* **Методы принимают `&self`, а не `&mut self`.** Сервис из контейнера доступен по общей ссылке, а через неё Rust не разрешает изменений, если тип не говорит, как они становятся безопасными. Это делает [`RwLock`](https://doc.rust-lang.org/std/sync/struct.RwLock.html): много читателей или один писатель одновременно, как `ReaderWriterLockSlim` в .NET или `sync.RWMutex` в Go.
* **`unwrap()` на блокировке** срабатывает, только если другой поток запаниковал, держа её. Для этого хранилища это ошибка, на которой стоит остановиться, поэтому туториал её не обрабатывает.
* **`Option<Bookmark>`** так Rust говорит «может быть, ничего» вместо `null`. `get` и `remove` возвращают `None` для незнакомого `id`.
* **[`BTreeMap`](https://doc.rust-lang.org/std/collections/struct.BTreeMap.html)** хранит закладки отсортированными по `id`, поэтому список выходит в порядке добавления.

## Обработчики

Обработчик это `async fn`. Его аргументы говорят, что он читает из запроса, а тип результата говорит, чем он отвечает:

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

| Аргумент | Откуда берётся |
|---|---|
| `id: u64` | сегмент `{id}` пути |
| `Query<ListQuery>` | строка запроса, `?tag=rust`, прочитанная в структуру |
| `Json<NewBookmark>` | тело, прочитанное как JSON |
| `Dc<Bookmarks>` | контейнер внедрения зависимостей |

`ListQuery` это ещё одна структура с `#[derive(Deserialize)]` и одним полем `tag: Option<String>`, поэтому запрос без `?tag=` тоже подходит. `Json(new)` в списке аргументов сразу достаёт значение из обёртки; это [шаблон](https://doc.rust-lang.org/book/ch19-00-patterns.html), тот же, что использует `match`.

Запрос, у которого `id` не число или тело не является корректным JSON, до обработчика не доходит: Волга отвечает ему `400`, потому что типы аргументов говорят, что должен содержать запрос. Подробнее в разделе [Экстракторы](/volga-docs/ru/getting-started/extractors.html).

На выходе `Json<T>` отвечает `200` с `T` в виде JSON. Обработчик, который отвечает разными статусами, возвращает `HttpResult` и строит ответ макросом: здесь это `ok!`, `created!`, `not_found!` и `no_content!`, а остальные перечислены в разделе [Ответы](/volga-docs/ru/getting-started/responses.html).

## Маршруты

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

* **`add_singleton`** регистрирует одно хранилище на всё приложение, как `AddSingleton` в ASP.NET Core. `Dc<Bookmarks>` в обработчике его получает. Подробнее в разделе [Внедрение зависимостей](/volga-docs/ru/advanced-patterns/di.html).
* **`group`** собирает четыре маршрута под одним префиксом. `""` это собственный путь группы, `/bookmarks`. См. [Группировка маршрутов](/volga-docs/ru/getting-started/route-groups.html).
* **`routes` вынесена в отдельную функцию**, чтобы собрать приложение мог не только `main`. Тесты в последней главе тоже её вызывают.
* **`#[tokio::main]`** запускает асинхронный рантайм и выполняет на нём `main`. `app.run()` обслуживает `localhost:7878`, пока вы его не остановите.

## Запустите

```bash
cargo run
```

В другом терминале:

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

Сервис работает, но слишком доверяет клиентам: он сохраняет закладку с пустым заголовком или с `url`, равным `"hello"`, а у его ошибок нет общей формы. `404` приходит с пустым телом, а `400` со строкой обычного текста. Следующая глава исправляет и то, и другое.

::: details Весь src/main.rs
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

Дальше: [Валидация и ошибки](/volga-docs/ru/tutorial/validation-errors.html).
