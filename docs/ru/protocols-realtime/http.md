# Версии и методы HTTP

## HTTP/1 и HTTP/2
Начиная с **v0.3.1**, можно настроить версию HTTP.
Если добавить Волгу вот так, по умолчанию используется HTTP/1:
```toml
[dependencies]
volga = { version = "..." }
```
Чтобы включить HTTP/2, добавьте функцию `http2` или используйте `full`:
```toml
[dependencies]
volga = { version = "...", features = ["full"] }
```
При использовании `full` HTTP/2 применяется, если это возможно, иначе автоматически используется HTTP/1.

## HTTP-методы
Для каждого стандартного глагола в Волге есть именованный метод `map_*` — он регистрируется на [`App`](https://docs.rs/volga/latest/volga/app/struct.App.html) или на [`RouteGroup`](https://docs.rs/volga/latest/volga/routing/struct.RouteGroup.html):

```rust compile-fragment
app.map_get("/items", || async { ok!("list") });
app.map_post("/items", || async { ok!("created") });
app.map_put("/items/{id}", || async { ok!("updated") });
app.map_patch("/items/{id}", || async { ok!("patched") });
app.map_delete("/items/{id}", || async { ok!("deleted") });
app.map_head("/items", || async { ok!() });
app.map_options("/items", || async { ok!() });
app.map_trace("/items", || async { ok!() });
```

::: tip
`HEAD` подключается неявно для каждого маршрута `GET`, поэтому [`map_head`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_head) нужен только для собственной реализации. См. [Свои обработчики HEAD, OPTIONS и TRACE](/volga-docs/ru/advanced-patterns/custom-trace-opt-head.html).
:::

### Метод `QUERY`
Начиная с **v0.9.4**, Волга поддерживает HTTP-метод `QUERY` — безопасный идемпотентный глагол с телом запроса, для поисковых запросов, которые слишком велики или слишком структурированы для строки запроса URI.

Обработчик регистрируется через [`map_query()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_query):

```rust compile
use volga::{App, Json, ok};
use serde::Deserialize;

#[derive(Deserialize)]
struct SearchQuery {
    criteria: String
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_query("/search", |query: Json<SearchQuery>| async move {
        // выполняем поиск по query.criteria...
        ok!("search results...")
    });

    app.run().await
}
```

Проверить можно через `curl`:
```bash
> curl -X QUERY "http://localhost:7878/search" -H "Content-Type: application/json" -d '{"criteria":"volga"}'
```

::: warning
Не путайте [`map_query()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_query) с экстрактором [`Query<T>`](/volga-docs/ru/getting-started/query-params.html): первый регистрирует маршрут для **глагола** `QUERY`, второй читает **строку запроса** URI любого запроса.
:::

::: tip
Сложные критерии выборки лучше передавать в теле запроса `QUERY`. Параметры строки запроса стоит оставить для метаданных, влияющих на маршрутизацию и кеширование: тенант, локаль, версия, флаги, совместимость пагинации.
:::

### Произвольный метод
Также с **v0.9.4** метод [`map()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.map) регистрирует маршрут для любого HTTP-метода. Это удобно, когда глагол известен только во время выполнения, когда один обработчик обслуживает несколько методов, или для нестандартных глаголов:

```rust compile
use volga::{App, ok};
use volga::http::Method;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map(Method::GET, "/hello", || async {
        ok!("Hello, World!")
    });

    // строковый глагол и шаблон, собранный во время выполнения, тоже работают
    app.map("QUERY", format!("/search/{}", "v1"), || async {
        ok!("search results...")
    });

    app.run().await
}
```

Аргумент `method` принимает всё, что преобразуется в [`Method`](https://docs.rs/http/latest/http/method/struct.Method.html), включая строковые глаголы, а шаблон — как заимствованный `&str` (без аллокации), так и владеющий `String`, собранный во время выполнения.

::: warning
[`map()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.map) **паникует**, если метод не преобразуется в корректный [`Method`](https://docs.rs/http/latest/http/method/struct.Method.html). Маршруты регистрируются на старте, поэтому некорректный глагол — это ошибка программиста, а не состояние времени выполнения.
:::
