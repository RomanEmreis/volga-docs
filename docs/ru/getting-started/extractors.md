# Экстракторы

Обработчик объявляет в сигнатуре, что ему нужно из запроса, и Волга читает эти значения до его вызова. Каждый тип аргумента, который можно прочитать таким образом, называется **экстрактором**. Если вы работали с minimal API в ASP.NET Core, это model binding. В терминах Go экстракторы заменяют ручное чтение `r.URL.Query()` и декодирование `r.Body`.

```rust compile
use serde::Deserialize;
use volga::{App, Json, Query, ok};

#[derive(Deserialize)]
struct Paging {
    page: u32,
}

#[derive(Deserialize)]
struct Item {
    name: String,
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // PUT /lists/7?page=2  с телом {"name": "milk"}
    app.map_put("/lists/{id}", |id: u64, paging: Query<Paging>, item: Json<Item>| {
        ok!("list {id}, page {}: {}", paging.page, item.name)
    });

    app.run().await
}
```

Если значение прочитать не удалось (в строке запроса нет поля, тело не является корректным JSON, сегмент пути не число), обработчик не вызывается. Запрос получает ответ `400 Bad Request` через [обработчик ошибок](/volga-docs/ru/reliability-observability/errors.html).

`Json<T>`, `Query<T>`, `Form<T>` и `NamedPath<T>` десериализуют данные через [serde](https://serde.rs), поэтому проекту с ними нужна зависимость `serde` с фичей `derive`.

## Что можно извлечь

### Из пути и строки запроса

| Тип | Что читает | Страница |
|---|---|---|
| `u32`, `i64`, `String`, `bool`, `PathBuf`, `IpAddr`, … | один параметр пути, по позиции | [Параметры маршрута](/volga-docs/ru/getting-started/route-params.html) |
| `Path<T>` | параметры пути по позиции, в кортеж или собственный тип | [Параметры маршрута](/volga-docs/ru/getting-started/route-params.html#использование-path-t) |
| `NamedPath<T>` | параметры пути по имени, в структуру | [Параметры маршрута](/volga-docs/ru/getting-started/route-params.html#использование-namedpath-t) |
| `Query<T>` | строку запроса, в структуру или `HashMap` | [Параметры запроса](/volga-docs/ru/getting-started/query-params.html) |

### Из тела

| Тип | Что читает | Страница |
|---|---|---|
| `Json<T>` | тело в формате JSON | [Работа с JSON](/volga-docs/ru/requests-responses/json-payload.html) |
| `Vec<T>` | JSON-массив, то же, что `Json<Vec<T>>` | |
| `Form<T>` | тело `application/x-www-form-urlencoded` | [Работа с Form Data](/volga-docs/ru/requests-responses/form.html) |
| `File` | тело как загружаемый файл | [Работа с файлами](/volga-docs/ru/requests-responses/files.html) |
| `Multipart` | тело `multipart/form-data` (фича `multipart`) | [Работа с файлами](/volga-docs/ru/requests-responses/files.html) |
| `HttpBody`, `ByteStream` | сырое тело, целиком или потоком | [Сырое тело запроса](/volga-docs/ru/requests-responses/body.html) |
| `HttpRequest` | весь запрос: заголовки и тело | |

### Из заголовков и метаданных запроса

| Тип | Что читает | Страница |
|---|---|---|
| `Header<T>`, `HttpHeaders` | один заголовок или все сразу | [Заголовки](/volga-docs/ru/requests-responses/headers.html) |
| `Cookies`, `SignedCookies`, `PrivateCookies` | cookie (фичи `cookie`, `signed-cookie`, `private-cookie`) | [Cookies](/volga-docs/ru/requests-responses/cookie.html) |
| `Method`, `Uri` | метод и URI запроса | |
| `ClientIp` | адрес клиента | |
| `Bearer`, `Basic`, `Authenticated<T>` | учётные данные и проверенные claims (фича `auth`) | [Аутентификация и авторизация](/volga-docs/ru/security-access/auth.html) |

### Из приложения

| Тип | Что даёт | Страница |
|---|---|---|
| `Dc<T>` | сервис из DI-контейнера (фича `di`) | [Внедрение зависимостей](/volga-docs/ru/advanced-patterns/di.html) |
| `Config<T>` | секцию файла конфигурации (фича `config`) | [Файлы конфигурации](/volga-docs/ru/middleware-infrastructure/config-files.html) |
| `CancellationToken` | сигнал о том, что клиент ушёл | [Отмена запросов](/volga-docs/ru/reliability-observability/cancellation.html) |
| `ShutdownHandle` | способ остановить сервер из обработчика | [Плавное завершение работы](/volga-docs/ru/reliability-observability/graceful-shutdown.html) |

Собственный тип становится экстрактором через один типаж, как описано на странице [Свои экстракторы](/volga-docs/ru/advanced-patterns/custom-extractors.html).

## Необязательные значения и ошибки извлечения

Оберните экстрактор в `Option<T>`, чтобы получить `None` вместо `400`, или в `Result<T, Error>`, чтобы получить ошибку и решить, что с ней делать:

```rust compile
use serde::Deserialize;
use volga::{App, Query, error::Error, headers::{Header, ContentType}, ok};

#[derive(Deserialize)]
struct Search {
    q: String,
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // И GET /search, и GET /search?q=rust доходят до обработчика
    app.map_get("/search", |search: Option<Query<Search>>| match search {
        Some(s) => ok!("searching for {}", s.q),
        None => ok!("nothing to search for"),
    });

    app.map_post("/echo", |ct: Result<Header<ContentType>, Error>| match ct {
        Ok(ct) => ok!("{ct}"),
        Err(err) => ok!("no content type: {err}"),
    });

    app.run().await
}
```

Чтобы проверить извлечённое значение по собственным правилам (непустое имя, размер страницы в допустимых пределах), оберните его в `Valid<E>`. Подробнее на странице [Валидация запросов](/volga-docs/ru/requests-responses/validation.html).

## Сочетание экстракторов

Обработчик может принимать сколько угодно экстракторов, которые читают путь, строку запроса, заголовки и приложение, и **один** экстрактор тела. Три сочетания не компилируются, и ошибка называет нарушенное правило:

* **Два экстрактора тела**, например `Json<A>` и `Form<B>`. Тело запроса это поток, и прочитать его можно только один раз.
* **Аргумент после `HttpRequest`.** Он забирает весь запрос, поэтому стоит последним.
* **Позиционные параметры рядом с `Path<T>` или `NamedPath<T>`.** Обработчик читает параметры пути либо одним способом, либо другим.

Подробнее о правилах на странице [Обработчики](/volga-docs/ru/getting-started/handlers.html#какие-экстракторы-сочетаются).
