# Центральный обработчик ошибок

Волга предоставляет централизованный механизм обработки ошибок, который перехватывает все ошибки, реализующие типаж [`Error`](https://doc.rust-lang.org/std/error/trait.Error.html), возникающие в обработчиках запросов и middleware. Для этого можно воспользоваться методом [`map_err`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_err) типа [`App`](https://docs.rs/volga/latest/volga/app/struct.App.html) для регистрации функции, обрабатывающей ошибки.

Функция принимает объект типа [`Error`](https://docs.rs/volga/latest/volga/error/struct.Error.html) и должна вернуть ответ, реализующий типаж [`IntoResponse`](https://docs.rs/volga/latest/volga/http/response/into_response/trait.IntoResponse.html). Как и обработчик запроса, она может быть [асинхронной или синхронной](/volga-docs/ru/getting-started/handlers.html).

### Пример:
```rust compile
use volga::{App, error::Error, status};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();
    
    app.map_get("/error", || async {
        std::io::Error::other("some error")
    });

    // Регистрируем централизованный обработчик ошибок
    app.map_err(|error: Error| async move {
        status!(500, "{:?}", error)
    });

    app.run().await
}
```
В этом примере мы намеренно создаем обработчик запросов, который выдает ошибку, и определяем обработчик ошибок, который генерирует HTTP-ответ с кодом состояния `500` на основе сообщения об ошибке.

Для удобства структура [`Error`](https://docs.rs/volga/latest/volga/error/struct.Error.html) предоставляет метод [`status()`](https://docs.rs/volga/latest/volga/error/struct.Error.html#method.status), который охватывает общие случаи (400, 401, 403, 404 и т. д.), что позволяет использовать макрос следующим образом:
```rust
status!(error.status().as_u16(), "{:?}", error)
```
Фактически, именно так реализован обработчик ошибок по умолчанию — с той разницей, что ошибка, [несущая собственный ответ](#ответ-с-собственным-телом), отвечает этим ответом. Если мы удалим метод [`map_err`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_err), ответ останется неизменным. Однако переопределение пользовательского обработчика ошибок обеспечивает большую гибкость для логирования и трассировки.

Обработчику, которому нужно лишь посмотреть на ошибку, достаточно вернуть её как есть: тогда на неё ответят ровно так, как ответил бы обработчик по умолчанию.

```rust compile-fragment
use volga::error::Error;

app.map_err(|error: Error| {
    eprintln!("{} {error}", error.status());
    error
});
```

## Возврат ошибок из обработчика

Обработчик, который может завершиться неудачей, возвращает `Result<T, E>`. `Ok` отвечает значением `T`, как и любой другой ответ. Начиная с **0.12.0** `Err` — это ошибка, а не второй вид ответа: она превращается в [`Error`](https://docs.rs/volga/latest/volga/error/struct.Error.html) через типаж [`IntoError`](https://docs.rs/volga/latest/volga/error/trait.IntoError.html) и передаётся обработчику ошибок — зарегистрированному через `map_err` или обработчику по умолчанию — точно так же, как ошибка из любого другого места.

```rust compile
use volga::{App, Json, http::StatusCode};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // GET /items/7   -> 200 7
    // GET /items/500 -> 404 Not Found
    app.map_get("/items/{id}", |id: u32| -> Result<Json<u32>, StatusCode> {
        if id > 100 {
            return Err(StatusCode::NOT_FOUND);
        }
        Ok(Json(id))
    });

    // GET /users/<имя длиннее 32 символов> -> 400 name is too long
    app.map_get("/users/{name}", |name: String| -> Result<String, (StatusCode, &'static str)> {
        if name.len() > 32 {
            return Err((StatusCode::BAD_REQUEST, "name is too long"));
        }
        Ok(format!("Hello, {name}!"))
    });

    app.run().await
}
```

Чем может быть `Err` и что ответит обработчик ошибок по умолчанию:

| `E` | Статус | Тело |
|---|---|---|
| `Error` | собственный | его сообщение |
| `StatusCode` | этот статус | каноническая фраза статуса, например `Not Found` |
| `(StatusCode, E)`, где `E` — сообщение или любая ошибка | этот статус | сообщение `E` |
| `std::io::Error` | по виду ошибки: `NotFound` → `404`, `PermissionDenied` → `403`, `AlreadyExists` → `409`, `InvalidInput` → `400`, большинство остальных → `500` | её сообщение |
| собственные ошибки Volga — `ValidationError`, `OAuthError`, `serde_json::Error` и другие | собственный | их сообщение |
| `Problem<E>` (фича `problem-details`) | статус problem | [сам problem](#problem-как-ошибка) |
| `String`, `&'static str`, `Cow<'static, str>`, `Box<str>` | `500` | сообщение |
| `Box<dyn std::error::Error + Send + Sync>` | `500` | её сообщение |
| ваш собственный тип, реализующий `IntoError` | какой он решит | см. [ниже](#собственные-типы-ошибок) |

Целые числа исключены намеренно: `Err(404)` одинаково читается и как статус, и как код ошибки приложения, поэтому не компилируется. `Err(StatusCode::NOT_FOUND)` говорит то же самое и проверяется компилятором.

::: warning Сообщение само по себе — это 500
У строки нет статуса, поэтому `Err("name is required")` или `Err(format!(..))` отвечает `500 Internal Server Error`. Дайте клиентской ошибке её статус: `Err((StatusCode::BAD_REQUEST, "name is required"))`.
:::

Раз ошибка проходит через обработчик ошибок, всё, что делает `map_err` — логирование, [Problem Details](#центральная-обработка-ошибок-с-problem-details), собственная JSON-обёртка, — применяется и к ней. То же касается `Err`, возвращённого из `map_fallback`, самого `map_err`, middleware [`with`](/volga-docs/ru/middleware-infrastructure/middlewares.html) и [`map_ok`](/volga-docs/ru/middleware-infrastructure/middleware.html#обработка-успешного-ответа) и — с одним отличием — из [фильтра](/volga-docs/ru/middleware-infrastructure/middleware.html#что-возвращает-фильтр).

### Собственные типы ошибок

Тип ошибки приложения становится `Err` обработчика благодаря одной реализации — [`IntoError`](https://docs.rs/volga/latest/volga/error/trait.IntoError.html). Она определяет статус и сообщение, а заодно даёт `From<T> for Error`, так что `?` преобразует этот тип везде, где ожидается `Error`: в обработчике, возвращающем `HttpResult`, и в middleware.

```rust compile
use serde::Serialize;
use std::num::ParseIntError;
use volga::{App, Json, error::{Error, IntoError}, http::StatusCode};

enum ApiError {
    NotFound(u32),
    BadId(ParseIntError),
}

// Позволяет `?` превратить ошибку разбора в `ApiError`
impl From<ParseIntError> for ApiError {
    fn from(err: ParseIntError) -> Self {
        Self::BadId(err)
    }
}

#[derive(Serialize)]
struct ErrorBody {
    code: &'static str,
    message: String,
}

impl IntoError for ApiError {
    fn into_error(self) -> Error {
        let (status, code, message) = match self {
            ApiError::NotFound(id) => (StatusCode::NOT_FOUND, "not_found", format!("no item {id}")),
            ApiError::BadId(err) => (StatusCode::BAD_REQUEST, "bad_id", err.to_string()),
        };
        let body = Json(ErrorBody { code, message: message.clone() });

        // Статус и сообщение читает `map_err`; тело получает клиент
        Error::from_parts(status, None, message).with_response(body)
    }
}

fn get_item(id: String) -> Result<Json<u32>, ApiError> {
    let id: u32 = id.parse()?;
    if id > 100 {
        return Err(ApiError::NotFound(id));
    }
    Ok(Json(id))
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // GET /items/7   -> 200 7
    // GET /items/abc -> 400 {"code":"bad_id","message":"invalid digit found in string"}
    // GET /items/500 -> 404 {"code":"not_found","message":"no item 500"}
    app.map_get("/items/{id}", get_item);

    app.run().await
}
```

::: tip Реализуйте `IntoError`, а не `From`
`From<T> for Error` приходит вместе с `IntoError` через blanket-реализацию, поэтому тип, реализующий оба, вызывает конфликт (`E0119`). Тип, у которого есть только собственный `From<T> for Error`, по-прежнему преобразуется через `?`, но не может быть `Err` обработчика — перенесите тело его `from` в `into_error`.
:::

### Ответ с собственным телом

[`Error::with_response()`](https://docs.rs/volga/latest/volga/error/struct.Error.html#method.with_response) прикрепляет к ошибке ответ, которым она ответит, — JSON-тело, `Problem`, — и ошибка остаётся ошибкой: `map_err` всё так же получает её, с прежними статусом, сообщением и instance.

* Прикреплённый ответ получает статус ошибки, с каким бы статусом он ни был построен, так что достаточно передать одно тело — значение `Json(..)`.
* Обработчик ошибок по умолчанию и [`use_problem_details()`](#центральная-обработка-ошибок-с-problem-details) отправляют его без изменений.
* Ответ, который не удалось построить, отбрасывается, и ошибка отвечает так, как ответила бы без него.

В собственном `map_err` метод [`has_response()`](https://docs.rs/volga/latest/volga/error/struct.Error.html#method.has_response) сообщает, несёт ли ошибка ответ, а [`take_response()`](https://docs.rs/volga/latest/volga/error/struct.Error.html#method.take_response) забирает его. Обработчику, который оформляет все ошибки по-своему, стоит решить, что делать с таким ответом, — здесь прикреплённое тело пропускается, а всё остальное оборачивается:

```rust compile-fragment
use volga::{HttpResult, error::Error, status};

app.map_err(|error: Error| -> HttpResult {
    if error.has_response() {
        // Ответит так же, как обработчик по умолчанию: прикреплённым ответом
        return Err(error);
    }
    status!(error.status().as_u16(), { "error": error.to_string() })
});
```

### Описание ошибок в OpenAPI

С фичей `openapi` маршрут, обработчик которого возвращает `Result<T, E>`, описывается ответами и `T`, и `E`. Тип ошибки сообщает, чем он отвечает, переопределяя [`IntoError::describe_openapi()`](https://docs.rs/volga/latest/volga/error/trait.IntoError.html#method.describe_openapi). По умолчанию не описывается ничего, и для большинства ошибок это правильно: как они выглядят, решает обработчик ошибок, а статус конкретной ошибки известен только тогда, когда она произошла.

```rust compile
use volga::{error::{Error, IntoError}, http::StatusCode, openapi::OpenApiRouteConfig};

struct NotFound;

impl IntoError for NotFound {
    fn into_error(self) -> Error {
        Error::from_parts(StatusCode::NOT_FOUND, None, "not found")
    }

    fn describe_openapi(config: OpenApiRouteConfig) -> OpenApiRouteConfig {
        config.produces_text(404)
    }
}
```

`describe_openapi` существует, только пока включена фича Volga `openapi`. Если ваш крейт включает её через собственную фичу, поставьте на метод тот же `#[cfg(feature = "..")]`. Остальное — на странице [OpenAPI](/volga-docs/ru/middleware-infrastructure/openapi.html).

### Переход с 0.11

::: warning Что меняется для Err обработчика в 0.12.0
До 0.12.0 `Err` обработчика должен был реализовывать `IntoResponse` и отправлялся как самостоятельный ответ, минуя `map_err`. Теперь:

* **`Err(String)` и другие строки отвечают `500` вместо `200`.** Это по-прежнему компилируется, и ничто об этом не предупредит — найдите такие обработчики и дайте каждой ошибке статус.
* `Err(StatusCode)` и `Err(Problem)` сохраняют свой статус, но теперь доходят до `map_err`. `Err(StatusCode)` отвечает канонической фразой статуса вместо пустого тела, а под `use_problem_details()` — в формате Problem Details.
* `Err(HttpResponse)`, `Err(Json<T>)` и другие типы ответов больше не компилируются. Верните ответ как `Ok` или верните ошибку и прикрепите тело через `with_response()`.
* Тип с собственным `From<T> for Error` по-прежнему преобразуется через `?`, но не может быть `Err` обработчика, пока этот `From` не станет реализацией `IntoError`.

Всё это относится и к `map_err`, `map_fallback`, `with` и `map_ok`, а также к [`Err` фильтра](/volga-docs/ru/middleware-infrastructure/middleware.html#что-возвращает-фильтр).
:::

## Fallback-обработчик

[`map_fallback()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_fallback) регистрирует обработчик, который отвечает на запрос, не совпавший ни с одним маршрутом. Он принимает те же аргументы, что и [`map_err()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_err) — всё, что реализует [`FromRequestParts`](https://docs.rs/volga/latest/volga/http/endpoints/args/trait.FromRequestParts.html): заголовки, URI, куки, [`ClientIp`](https://docs.rs/volga/latest/volga/struct.ClientIp.html), [`Dc<T>`](https://docs.rs/volga/latest/volga/di/struct.Dc.html). Но не тело: ничего не совпало, значит нет маршрута, который сказал бы, как это тело читать; по той же причине недоступны и параметры пути.

```rust compile
use volga::{App, ClientIp, http::Uri, error::Error, not_found, status};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_fallback(|uri: Uri, ip: ClientIp| async move {
        not_found!("no route for {uri} (from {ip})")
    });

    // Ошибка из fallback попадёт сюда, как и любая другая
    app.map_err(|error: Error| async move {
        status!(error.status().as_u16(), "{:?}", error)
    });

    app.run().await
}
```

Fallback выполняется в полноценном скоупе запроса, поэтому принимает те же экстракторы, что и любой другой обработчик, — `ClientIp`, `CancellationToken`, `Config<T>`, `HostEnv`, `Dc<T>`, — и настроенный лимит тела запроса к нему тоже применяется. Возвращённую им ошибку обрабатывает `map_err` приложения, как и ошибку любого другого обработчика, поэтому сервис, формирующий свои ошибки, формирует их и здесь.

### Свой fallback для каждой части API

Одного обработчика на все неизвестные пути приложения часто мало: API хочет JSON, а SPA — свою оболочку. Начиная с **0.11.1** [группа маршрутов](/volga-docs/ru/getting-started/route-groups.html#fallback-группы) несёт собственный fallback, и роутер выбирает самый глубокий префикс, у которого он есть:

```rust compile
use volga::{App, http::Uri, error::Problem, not_found};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.group("/api", |api| {
        // Всё неизвестное под /api отвечает в формате самого API
        api.map_fallback(|uri: Uri| async move {
            let problem: Problem = Problem::new(404)
                .with_detail("No endpoint at this path")
                .with_instance(uri.path());
            problem
        });
    });

    // Всё остальное
    app.map_fallback(|| async { not_found!("not found") });

    app.run().await
}
```

Middleware группы — `authorize`, ограничитель частоты, `tap_req` с request-id — выполняется вокруг её fallback так же, как вокруг её маршрутов, поэтому неизвестный путь за аутентификацией отклоняется, а не перечисляет существующие.

Расширения `Problem` — это его типовой параметр, поэтому аннотация нужна лишь чтобы подхватить значение по умолчанию: у `Problem`, собранного через [`with_extensions()`](https://docs.rs/volga/latest/volga/error/problem/struct.Problem.html#method.with_extensions), она не нужна.

## Problem Details

Волга полностью поддерживает формат [Problem Details](https://www.rfc-editor.org/rfc/rfc9457), который предоставляет машиночитаемые сведения об ошибках в ответах HTTP. Это устраняет необходимость определять пользовательские форматы ошибок для API.

Чтобы включить эту возможность, убедитесь, что функция `problem-details` активирована в `Cargo.toml` вашего приложения:
```toml
[dependencies]
volga = { version = "...", features = ["problem-details"] }
```
Затем вы можете вернуть структуру [`Problem`](https://docs.rs/volga/latest/volga/error/problem/struct.Problem.html) из обработчика запроса:
```rust compile
use volga::{App, error::Problem};
use serde::Serialize;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/problem", || async {
        // Всегда выдает Problem Details

        Problem::new(400)
            .with_detail("Missing Parameter")
            .with_instance("/problem")
            .with_extensions(ValidationError {
                invalid_params: vec![InvalidParam { 
                    name: "id".into(), 
                    reason: "The ID must be provided".into()
                }]
            })
    }); 

    app.run().await
}

#[derive(Default, Serialize)]
struct ValidationError {
    #[serde(rename = "invalid-params")]
    invalid_params: Vec<InvalidParam>,
}

#[derive(Default, Serialize)]
struct InvalidParam {
    name: String,
    reason: String,
}
```
### Пример ответа:
```json
HTTP/1.1 400 Bad Request
Content-Type: application/problem+json

{
    "type": "https://tools.ietf.org/html/rfc9110#section-15.5.1",
    "title": "Bad Request",
    "status": 400,
    "detail": "Missing Parameter",
    "instance": "/problem",
    "invalid-params": [
        { "name": "id", "reason": "The ID must be provided" }
    ]
}
```

### Problem как ошибка

`Problem` может быть и `Err` в `Result` обработчика. Он отвечает самим собой, как и в роли значения `Ok`, но сначала проходит как ошибка: она несёт статус problem, его `detail` (или `title`) в качестве сообщения и его `instance`, а обработчик `map_err` может ответить чем-то другим.

```rust compile
use volga::{App, Json, error::Problem};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/items/{id}", |id: u64| -> Result<Json<u64>, Problem> {
        if id == 0 {
            return Err(Problem::new(404).with_detail("no item 0"));
        }
        Ok(Json(id))
    });

    app.run().await
}
```

::: tip Держите Err компактным
`Problem` — большое значение, поэтому именованная функция, возвращающая `Result<T, Problem>`, срабатывает на lint Clippy [`result_large_err`](https://rust-lang.github.io/rust-clippy/master/index.html#result_large_err). Возвращайте `Result<T, Error>` и пишите `Err(problem.into())` — клиент получит тот же ответ, а `Error` занимает 32 байта на 64-битной платформе.
:::

## Центральная обработка ошибок с Problem Details

Кроме того, вы можете комбинировать [`Problem`](https://docs.rs/volga/latest/volga/error/problem/struct.Problem.html) с [`map_err`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_err), используя метод [`use_problem_details()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.use_problem_details):
```rust compile
use volga::{App, error::Error};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();
    
    app.map_get("/error", || async {
        // Всегда выдает ошибку, которая будет преобразована
        // в Problem Details

        std::io::Error::other("some error")
    });

    // Регистрируем централизованный обработчик ошибок, который выдает
    // ответы в формате Problem Details
    app.use_problem_details();  

    app.run().await
}
```
### Пример ответа:
```json
HTTP/1.1 500 Internal Server Error
Content-Type: application/problem+json

{
    "type": "https://tools.ietf.org/html/rfc9110#section-15.6.1",
    "title": "Internal Server Error",
    "status": 500,
    "detail": "some error",
    "instance": "/error"
}
```

Ошибка, которая [несёт собственный ответ](#ответ-с-собственным-телом), — в том числе `Problem`, возвращённый как `Err`, — отправляется как есть, а не описывается заново.

Поля `type` и `title` определяются из кода состояния, но могут быть переопределены:
```rust
Problem::new(400)
    .with_type("https://tools.ietf.org/html/rfc9110#section-15.6.1")
    .with_title("Server Error");
```
А также при необходимости можно добавить дополнительные сведения: 
```rust
Problem::new(400)
    .with_detail("Missing Parameter")
    .with_instance("/problem")
    .with_extensions(ValidationError {
        invalid_params: vec![InvalidParam { 
            name: "id".into(), 
            reason: "The ID must be provided".into()
        }]
    })
```
или
```rust
Problem::new(400)
    .with_detail("Missing Parameter")
    .with_instance("/problem")
    .add_param("reason", "The ID must be provided");
```

Готовые примеры можно найти по следующим ссылкам:
- [Центральная обработка ошибок](https://github.com/RomanEmreis/volga/blob/main/examples/global_error_handler/src/main.rs).
- [Problem Details](https://github.com/RomanEmreis/volga/blob/main/examples/problem_details/src/main.rs)
