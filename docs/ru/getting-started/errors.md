# Центральный обработчик ошибок

Волга предоставляет централизованный механизм обработки ошибок, который перехватывает всё ошибки, которые реализуют типаж [`Errors`](https://doc.rust-lang.org/std/error/trait.Error.html), возникающие в обработчиках запросов и middleware. Для этого можно воспользоваться методом [`map_err`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_err) типа [`App`](https://docs.rs/volga/latest/volga/app/struct.App.html) для регистрации функции, обрабатывающей ошибки.

Функция принимает объект тип [`Error`](https://docs.rs/volga/latest/volga/error/struct.Error.html) и должна вернуть ответ, реализующий типаж [`IntoResponse`](https://docs.rs/volga/latest/volga/http/response/into_response/trait.IntoResponse.html).

### Пример:
```rust
use volga::{App, error::Error, status};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();
    
    app.map_get("/error", || async {
        std::io::IoError::other("some error")
    });

    // Регистрируем централизованный обработчик ошибок
    app.map_err(|error: Error| async move {
        status!(500, "{:?}", error)
    });

    app.run().await
}
```
В этом примере мы намеренно создаем обработчик запросов, который выдает ошибку, и определяем обработчик ошибок, который генерирует HTTP-ответ с кодом состояния `500` на основе сообщения об ошибке.

Для удобства структура [`Error`](https://docs.rs/volga/latest/volga/error/struct.Error.html) уже включает поле `status`, которое охватывает общие случаи (400, 401, 403, 404 и т. д.), что позволяет использовать макрос следующим образом:
```rust
status!(error.status.as_u16(), "{:?}", error)
```
Фактически, именно так реализован обработчик ошибок по-умолчанию. Если мы удалим метод [`map_err`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_err), ответ останется неизменным. Однако переопределение пользовательского обработчика ошибок обеспечивает большую гибкость для логгирования и трассировки.

## Problem Details

Волга полностью поддерживает формат [Problem Details](https://www.rfc-editor.org/rfc/rfc9457), который предоставляет машиночитаемые сведения об ошибках в ответах HTTP. Это устраняет необходимость определять пользовательские форматы ошибок для API.

Чтобы включить эту возможность, убедитесь, что функция `problem-details` активирована в `Cargo.toml` вашего приложения:
```toml
[dependencies]
volga = { version = "0.5.0", features = ["problem-details"] }
```
Затем вы можете воспользоваться макросом [`problem!`](https://docs.rs/volga/latest/volga/macro.problem.html) в связке с [`map_err`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_err):
```rust
use volga::{App, error::Error, problem};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();
    
    app.map_get("/error", || async {
        std::io::IoError::other("some error")
    });

    // Регистрируем централизованный обработчик ошибок
    app.map_err(|error: Error| async move {
        let (status, instance, err) = error.into_parts();
        problem! {
            "status": status.as_u16(),
            "detail": (err.to_string()),
            "instance": instance
        }
    });

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
Значения полей `type` и `title` вычисляются автоматически на основе статус код, однако их можно переопределить:
```rust
problem! {
    "type": "https://tools.ietf.org/html/rfc9110#section-15.6.1",
    "title": "Server Error",
    "status": status.as_u16(),
    "detail": (err.to_string()),
    "instance": instance
}
```
Кроме того, при необходимости вы можете добавить в тело ответа любую дополнительную информацию:
```rust
problem! {
    "type": "https://tools.ietf.org/html/rfc9110#section-15.5.1",
    "title": "Bad Request",
    "status": 400,
    "details": "Your request parameters didn't validate.",
    "instance": "/some/resource/path",
    "invalid-params": [
        { "name": "id", "reason": "Must be a positive integer" }
    ]
};
```

Итоговый пример вы можете найти [здесь](https://github.com/RomanEmreis/volga/blob/main/examples/global_error_handler.rs).