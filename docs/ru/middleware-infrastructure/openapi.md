# OpenAPI

Volga описывает приложение в формате [OpenAPI 3.0](https://spec.openapis.org/oas/v3.0.3) по тому, что уже написано: по шаблонам маршрутов, по экстракторам, которые принимает обработчик, и по типам, которые он возвращает. Не нужно ни макросов, ни рефлексии во время выполнения; то, чего маршрут не может сказать о себе сам, дописывается рядом с ним, в коде.

## Включение OpenAPI

Если вы не используете набор фич `full`, включите фичу `openapi` в `Cargo.toml`:

```toml
[dependencies]
volga = { version = "...", features = ["openapi"] }
```

## Публикация документа

Настройка документа и его публикация — два отдельных шага, как и везде в Volga: [`with_open_api()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.with_open_api) описывает документ, [`use_open_api()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.use_open_api) регистрирует эндпоинты, которые его отдают.

```rust compile
use volga::App;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new()
        .with_open_api(|config| config
            .with_title("Example API")
            .with_version("1.0.0")
            .with_ui());

    app.use_open_api();

    app.map_get("/hello", || "Hello, World!");

    app.run().await
}
```

Документ отдаётся по адресу `/openapi.json`, а с [`with_ui()`](https://docs.rs/volga/latest/volga/openapi/struct.OpenApiConfig.html#method.with_ui) — ещё и Swagger UI по адресу `/openapi` (его можно перенести через `with_ui_path(..)`). Страница UI отдаётся с заголовками `ETag` и `Cache-Control`.

::: warning
Один `with_open_api()` ничего не публикует — debug-сборка сообщает об этом при запуске, — а `use_open_api()` без настройки вызывает панику. Пока не вызван `use_open_api()`, наружу ничего не выставлено, так что сборка, которая не должна публиковать своё API, может этот вызов просто опустить.
:::

Те же настройки можно задать в [секции `[openapi]`](/volga-docs/ru/middleware-infrastructure/config-files.html) конфигурационного файла:

```toml
[openapi]
title = "Example API"
version = "1.0.0"
ui_enabled = true
```

## Описание маршрута

Сторона запроса выводится сама: параметры пути — из шаблона маршрута, где типизированный сегмент вроде `{age:integer}` задаёт параметру тип, а тело и query — из `Deserialize`-типов в `Json<T>`, `Form<T>`, `Query<T>` и `NamedPath<T>`, вместе с правилами [валидирующего](/volga-docs/ru/requests-responses/validation.html#openapi) экстрактора. Тип, который реализует только `Serialize`, так исследовать нельзя, поэтому ответы, построенные из него, называются вручную.

Всё остальное задаётся через `open_api(..)` на маршруте или на группе — для всех её маршрутов; настройки группы объединяются с собственными настройками каждого маршрута.

```rust compile
use serde::{Deserialize, Serialize};
use volga::{App, Json, NamedPath, ok};

#[derive(Default, Deserialize, Serialize)]
struct User {
    name: String,
    age: u64,
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new().with_open_api(|config| config.with_ui());
    app.use_open_api();

    app.group("/users", |api| {
        api.open_api(|cfg| cfg.with_tag("users"));

        api.map_get("/{name}/{age}", |user: NamedPath<User>| ok!(user.into_inner()))
            .open_api(|cfg| cfg
                .with_summary("Echoes a user back")
                .produces_json::<User>(200)
                .produces_no_schema(400));

        api.map_post("/", |user: Json<User>| user)
            .open_api(|cfg| cfg.produces_json_example(201, User {
                name: "John".into(),
                age: 30,
            }));
    });

    app.run().await
}
```

Остальное в операции покрывает построитель [`OpenApiRouteConfig`](https://docs.rs/volga/latest/volga/openapi/struct.OpenApiRouteConfig.html):

| Метод | Описывает |
|---|---|
| `with_summary`, `with_description`, `with_operation_id`, `with_tag` / `with_tags` | саму операцию |
| `produces_json::<T>(status)`, `produces_json_example(status, value)` | JSON-ответ |
| `produces_text(status)`, `produces_no_schema(status)` | текстовый ответ, ответ без тела |
| `produces_problem(status)`, `produces_problem_example(status, value)` | ответ `application/problem+json` |
| `produces_form::<T>(status)`, `produces_multipart(status)`, `produces_stream(status)`, `produces_sse(status)` | прочие виды ответов |
| `consumes_json::<T>()`, `consumes_form::<T>()`, `consumes_query::<T>()`, `consumes_multipart()`, `consumes_stream()` | вход, который не называет ни один экстрактор |
| `with_request_schema(schema)`, `with_query_schema(schema)`, `with_response_schema(status, schema)` | что угодно, [вручную](#описание-типа-вручную) |

Обработчик, возвращающий `Result<T, E>`, описывается ответами и `T`, и `E`: тип ошибки сообщает, чем он отвечает, через [`IntoError::describe_openapi()`](/volga-docs/ru/reliability-observability/errors.html#описание-ошибок-в-openapi).

## Несколько документов

API с версиями может публиковать по документу на версию. Каждая спецификация отдаётся по адресу `/{name}/openapi.json`, а маршрут или группа привязывается к своим документам через `with_doc(..)` / `with_docs(..)`; маршрут, не привязанный ни к одному, описывается в первом.

```rust compile
use volga::App;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new().with_open_api(|config| config
        .with_specs(["v1", "v2"])
        .with_ui());

    app.use_open_api();

    // Только в /v1/openapi.json
    app.map_get("/users", || "users");

    // В обоих документах
    app.group("/health", |api| {
        api.open_api(|cfg| cfg.with_docs(["v1", "v2"]));
        api.map_get("/", || "ok");
    });

    // Только в /v2/openapi.json
    app.map_post("/users", || "created")
        .open_api(|cfg| cfg.with_doc("v2"));

    app.run().await
}
```

## Описание типа вручную

serde читает структуру с полем `#[serde(flatten)]` как map, чтобы собрать ключи, которые структура не называет, — а map не говорит, какие ключи принимает. Ни одно поле такой структуры не выводится, включая объявленные рядом с flatten-полем: тело `Json<T>` или `Form<T>` описывается как объект без свойств (или как произвольное значение, если структура лежит внутри него, например в `Vec`), а `Query<T>` не описывает ни одного параметра.

Начиная с **0.11.2** debug-сборка называет каждый такой вход при запуске. Опишите его вручную через [`OpenApiSchema`](https://docs.rs/volga/latest/volga/openapi/struct.OpenApiSchema.html) — [`with_request_schema()`](https://docs.rs/volga/latest/volga/openapi/struct.OpenApiRouteConfig.html#method.with_request_schema) для тела, [`with_query_schema()`](https://docs.rs/volga/latest/volga/openapi/struct.OpenApiRouteConfig.html#method.with_query_schema) для query; последний описывает по параметру на каждое свойство, обязательному, если его называет список `required` схемы:

```rust compile
use std::collections::HashMap;
use serde::Deserialize;
use volga::{App, Json, Query, openapi::OpenApiSchema};

#[derive(Deserialize)]
struct Search {
    name: String,
    page: u32,
    // Все прочие ключи: именно из-за этого serde читает `Search` как map
    #[serde(flatten)]
    filters: HashMap<String, String>,
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new().with_open_api(|config| config.with_ui());
    app.use_open_api();

    let schema = OpenApiSchema::object()
        .with_property("name", OpenApiSchema::string())
        .with_property("page", OpenApiSchema::integer())
        .with_required(["name", "page"]);

    app.map_post("/search", |search: Json<Search>| search.name.clone())
        .open_api(|cfg| cfg.with_request_schema(schema.clone()));

    app.map_get("/search", |search: Query<Search>| search.name.clone())
        .open_api(|cfg| cfg.with_query_schema(schema));

    app.run().await
}
```

Параметр, уже описанный под тем же именем, заменяется, а вход, описанный вручную, пропадает из [`undescribed_inputs()`](https://docs.rs/volga/latest/volga/openapi/struct.OpenApiRouteConfig.html#method.undescribed_inputs) — списка, из которого строится сообщение при запуске. О настоящих map, например о теле `HashMap<String, T>`, не сообщается.

Параметры пути всегда называются по шаблону маршрута, что бы ни описывал экстрактор, поэтому их типы указываются там же: `{id:integer}`.

## Маршруты, по-разному называющие одну позицию

OpenAPI 3.0 допускает один шаблонный путь на позицию. `GET /users/{id}` рядом с `POST /users/{name}` описываются под одним путём, названным так, как записано большинство маршрутов в нём, а debug-сборка сообщает о каждом маршруте, чьи параметры были переименованы, — см. [Именование параметров принадлежит маршруту](/volga-docs/ru/getting-started/route-params.html#в-документе-openapi).

::: tip Куда попадают сообщения при запуске
Сообщения выше выдаёт только debug-сборка. С включённой фичей `tracing` — а `full` её включает — они отправляются как события уровня `WARN` и видны только после установки [подписчика tracing](/volga-docs/ru/reliability-observability/tracing.html); без этой фичи они печатаются в stderr.
:::

Полный пример — в [примере OpenAPI](https://github.com/RomanEmreis/volga/blob/main/examples/open_api/src/main.rs).
