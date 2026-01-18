# Заголовки (Headers)

Волга предоставляет удобные инструменты для управления заголовками HTTP: чтения из запросов и записи в ответы.

## Чтение заголовков запроса

Вы можете извлечь определённый заголовок из запроса с помощью [`Header<T>`](https://docs.rs/volga/latest/volga/headers/header/struct.Header.html) или получить все заголовки в виде [`HttpHeaders`](https://docs.rs/volga/latest/volga/headers/header/struct.HttpHeaders.html) — снимка, доступного только для чтения.

### Использование `Header<T>`
```rust
use volga::{App, ok};
use volga::headers::{Header, ContentType};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/hello", |content_type: Header<ContentType>| async move {
        ok!("{content_type}")
    });

    app.run().await
}
```
Пример запроса:
```bash
> curl "http://127.0.0.1:7878/hello" -H "content-type: text/plain"
Content-Type: text/plain
```

### Чтение кастомного HTTP-заголовка с `Header<T>`
Если вам нужно прочитать свой HTTP-заголовок, создайте структуру и реализуйте для неё типаж [`FromHeaders`](https://docs.rs/volga/latest/volga/headers/trait.FromHeaders.html):
```rust
use volga::{App, ok};
use volga::headers::{Header, FromHeaders, HeaderMap, HeaderName, HeaderValue};

// Заголовок `x-api-key`
struct ApiKey;

// Реализация FromHeaders для ApiKey
impl FromHeaders for ApiKey {
    const NAME: HeaderName = HeaderName::from_static("x-api-key");

    fn from_headers(headers: &HeaderMap) -> Option<&HeaderValue> {
        headers.get(Self::header_type())
    }
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/hello", |api_key: Header<ApiKey>| async move {
        ok!("Received {api_key}")
    });

    app.run().await
}
```
Пример запроса:
```bash
> curl "http://127.0.0.1:7878/hello" -H "x-api-key: 123-321"
Received x-api-key: 123-321
```

### Упрощение работы с кастомными заголовками с помощью макроса `headers!`
Вместо реализации типажа вручную, вы можете использовать макрос [`headers!`](https://docs.rs/volga/latest/volga/macro.headers.html):
```rust
use volga::{App, ok};
use volga::headers::{
    Header,
    headers
};

// Кастомные заголовки
headers! {
    (ApiKey, "x-api-key"),
    (CorrelationId, "x-corr-id")
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/hello", |api_key: Header<ApiKey>, corr_id: Header<CorrelationId>| async move {
        ok!("Received {api_key}; {corr_id}")
    });

    app.run().await
}
```
Пример запроса:
```bash
> curl "http://127.0.0.1:7878/hello" -H "x-api-key: 123-321" -H "x-corr-id: 456-654"
Received x-api-key: 123-321; correlation-id: 456-654
```

### Использование `HttpHeaders`
Альтернативный способ с помощью структуры [`HttpHeaders`](https://docs.rs/volga/latest/volga/headers/header/struct.HttpHeaders.html):
```rust
use volga::{App, ok};
use volga::headers::HttpHeaders;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/hello", |headers: HttpHeaders| async move {
        let api_key = headers.get_raw("x-api-key")
            .unwrap()
            .to_str()
            .unwrap();
        ok!("Received x-api-key: {api_key}")
    });

    app.run().await
}
```
Пример запроса:
```bash
> curl "http://127.0.0.1:7878/hello" -H "x-api-key: 123-321"
Received x-api-key: 123-321
```

### Использование `http_header`
Ещё один удобный способ работы с кастомными HTTP-заголовками — это атрибут [`http_header`](https://docs.rs/volga/latest/volga/headers/attr.http_header.html).
Он особенно полезен, когда вы хотите определить строго типизированные заголовки с чёткой семантикой.

Вот пример создания и использования такого заголовка:
```rust
use volga::{App, ok};
use volga::headers::{
    Header,
    HttpHeaders,
    http_header
};

// Определяем кастомный заголовок
#[http_header("x-api-key")]
struct ApiKey;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/hello", |headers: HttpHeaders| async move {
        let api_key: Header<ApiKey> = headers.try_get()?;
        ok!("Received {api_key}")
    });

    app.run().await
}
```
Пример запроса:
```bash
curl "http://127.0.0.1:7878/hello" -H "x-api-key: 123-321"
Received x-api-key: 123-321
```

:::info
Атрибут [`http_header`](https://docs.rs/volga/latest/volga/headers/attr.http_header.html) является частью дополнительной функции `macros`.
Убедитесь, что она включена в вашем `Cargo.toml`:
```toml
volga = { version = "...", features = ["macros"] }
```
:::

## Запись заголовков в ответ
Для добавления своих заголовков в ответ можно воспользоваться макросом [`ok!`](https://docs.rs/volga/latest/volga/macro.ok.html):
```rust
use volga::{App, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
   let mut app = App::new();

   app.map_get("/hello", || async {
       ok!("Hello World!", [
           ("Content-Type", "text/plain"),
           ("x-api-key", "some api key")
       ])
   });

   app.run().await
}
```

Пример запроса:
```bash
> curl -v "http://127.0.0.1:7878/hello"
```
Ответ:
```bash
< HTTP/1.1 200 OK
< content-type: text/plain
< x-api-key: some api key
Hello World!
```

Полные примеры доступны [здесь](https://github.com/RomanEmreis/volga/blob/main/examples/headers/src/main.rs) и [здесь](https://github.com/RomanEmreis/volga/blob/main/examples/custom_request_headers/src/main.rs).
