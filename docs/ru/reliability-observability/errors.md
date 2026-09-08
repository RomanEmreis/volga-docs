# Центральный обработчик ошибок

Волга предоставляет централизованный механизм обработки ошибок, который перехватывает все ошибки, реализующие типаж [`Error`](https://doc.rust-lang.org/std/error/trait.Error.html), возникающие в обработчиках запросов и middleware. Для этого можно воспользоваться методом [`map_err`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_err) типа [`App`](https://docs.rs/volga/latest/volga/app/struct.App.html) для регистрации функции, обрабатывающей ошибки.

Функция принимает объект типа [`Error`](https://docs.rs/volga/latest/volga/error/struct.Error.html) и должна вернуть ответ, реализующий типаж [`IntoResponse`](https://docs.rs/volga/latest/volga/http/response/into_response/trait.IntoResponse.html).

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
Фактически, именно так реализован обработчик ошибок по умолчанию. Если мы удалим метод [`map_err`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_err), ответ останется неизменным. Однако переопределение пользовательского обработчика ошибок обеспечивает большую гибкость для логирования и трассировки.

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

::: warning Изменено в 0.10.0
* **Скоуп запроса создаётся и для несовпавших запросов.** `ClientIp`, `CancellationToken`, `Config<T>`, `HostEnv` и `Dc<T>` теперь работают внутри fallback-обработчика, а не роняют его в `500`, и настроенный лимит тела запроса там тоже действует — раньше fallback получал тело соединения без ограничений.
* **Ошибку, возвращённую fallback-обработчиком, обрабатывает `map_err` приложения**, как и ошибку любого другого обработчика. Раньше она уходила во встроенный обработчик, поэтому сервис, формировавший свои ошибки, получал один ответ для упавшего маршрута и другой — для упавшего fallback.
* **`FallbackHandler::call` принимает `HttpRequest`**, а не `Request<Incoming>`, поэтому написанный вручную `impl FallbackHandler` должен принимать новый тип аргумента. Все fallback-обработчики в виде замыканий, которые компилировались раньше, компилируются и сейчас.
* **`FromRawRequest` удалён.** Он существовал только чтобы описать, что может принимать fallback-обработчик, и принимал ровно то же, что принимает `FromRequestParts`, поэтому `map_fallback` принимает тот же набор и без него. Вместе с ним удалены его реализации для `Cookies`, `SignedCookies` и `PrivateCookies`; все три по-прежнему реализуют `FromRequestParts`, `FromRequestRef` и `FromPayload`, поэтому их использование в качестве экстракторов не изменилось.
:::

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
