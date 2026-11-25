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

## Таймаут чтения заголовков

Клиент, который присылает начало запроса по байту, держит соединение сколько захочет; так же и клиент, который подключился и ничего не прислал или так и не завершил TLS-рукопожатие. Нескольких таких хватает, чтобы занять все разрешения [`with_max_connections()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.with_max_connections). Начиная с **0.15.1** [`with_header_read_timeout()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.with_header_read_timeout) задаёт, сколько времени у клиента есть на строку запроса и заголовки, прежде чем соединение будет закрыто:

```rust compile
use std::time::Duration;
use volga::{App, Limit};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let app = App::new()
        .with_header_read_timeout(Limit::Limited(Duration::from_secs(10)));

    app.run().await
}
```

или ключом `header_read_timeout_secs` секции `[server]` в [файле конфигурации](/volga-docs/ru/middleware-infrastructure/config-files.html#встроенные-секции), где `0` означает отсутствие таймаута:

```toml
[server]
header_read_timeout_secs = 10
```

* Тот же таймаут ограничивает и то, что идёт до заголовков: [TLS-рукопожатие](/volga-docs/ru/protocols-realtime/https.html) и первые байты, по которым сервер с HTTP/1 и HTTP/2 сразу или с [WebSocket](/volga-docs/ru/protocols-realtime/ws.html) определяет протокол. На каждый из этих шагов отводится весь таймаут.
* Таймер идёт всякий раз, когда сервер ждёт запрос, поэтому он закрывает и соединение HTTP/1 keep-alive, простоявшее столько же между запросами. Пока работает обработчик или читается тело, он не идёт. Соединение, закрытое им, пишется в лог на уровне `debug`, а не `error`.
* После preface соединение HTTP/2 таймером не ограничивается: его запросы — это кадры в уже установленном соединении. Метод доступен с функцией `http1` или `tls`.
* `Limit::Default` и `Limit::Unlimited` означают отсутствие таймаута. `Limit::Limited(Duration::ZERO)` вызывает панику.

::: warning
Таймаут **по умолчанию выключен**, потому что он стоит чего-то на каждом запросе. hyper создаёт новый таймер для заголовков каждого запроса и регистрирует его в timer wheel рантайма, которое блокирует каждый воркер. В бенчмарке HTTP/1 с plain text примерно на миллионе запросов в секунду это вдвое снизило пропускную способность (hyper 1.12, tokio 1.54); сервер, который делает больше работы на запрос, теряет меньшую долю. Включайте его, если клиенты обращаются к серверу напрямую; серверу за прокси, который сам ограничивает медленных клиентов, он не нужен.
:::

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
Запрос `HEAD`, у которого нет собственного маршрута, обрабатывается маршрутом `GET` для того же пути — через middleware и политику CORS этого маршрута, — поэтому [`map_head`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_head) нужен только для собственной реализации. См. [Свои обработчики HEAD, OPTIONS и TRACE](/volga-docs/ru/advanced-patterns/custom-trace-opt-head.html).
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
