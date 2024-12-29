# Заголовки (Headers)

Волга предоставляет удобные инструменты для управления заголовками HTTP: чтения из запросов и записи в ответы.

## Чтение заголовков запроса

Вы можете извлечь определённый заголовок из запроса с помощью [`Header<T>`](https://docs.rs/volga/latest/volga/app/endpoints/args/headers/struct.Header.html) или получить все заголовки в виде хеш-таблицы [`Headers`](https://docs.rs/volga/latest/volga/app/endpoints/args/headers/struct.Headers.html).

### Использование `Header<T>`
```rust
use volga::{App, ok};
use volga::headers::{Header, ContentType};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/hello", |content_type: Header<ContentType>| async move {
        ok!("Content-Type: {content_type}")
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
Если вам нужно прочитать свой HTTP-заголовок, создайте структуру и реализуйте для неё trait [`FromHeaders`](https://docs.rs/volga/latest/volga/app/endpoints/args/headers/trait.FromHeaders.html):
```rust
use volga::{App, ok};
use volga::headers::{Header, FromHeaders, HeaderMap, HeaderValue};

// Заголовок `x-api-key`
struct ApiKey;

// Реализация FromHeaders для ApiKey
impl FromHeaders for ApiKey {
    fn from_headers(headers: &HeaderMap) -> Option<&HeaderValue> {
        headers.get(Self::header_type())
    }

    fn header_type() -> &'static str {
        "x-api-key"
    }
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/hello", |api_key: Header<ApiKey>| async move {
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

### Упрощение работы с кастомными заголовками с помощью `custom_headers!`
Вместо реализации трейта вручную, вы можете использовать макрос [`custom_headers!`](https://docs.rs/volga/latest/volga/app/endpoints/args/headers/macro.custom_headers.html):
```rust
use volga::{App, ok};
use volga::headers::{
    Header,
    custom_headers
};

// Кастомные заголовки
custom_headers! {
    (ApiKey, "x-api-key"),
    (CorrelationId, "x-corr-id")
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/hello", |api_key: Header<ApiKey>, corr_id: Header<CorrelationId>| async move {
        ok!("Received x-api-key: {api_key}; correlation-id: {corr_id}")
    });

    app.run().await
}
```
Пример запроса:
```bash
> curl "http://127.0.0.1:7878/hello" -H "x-api-key: 123-321" -H "correlation-id: 456-654"
Received x-api-key: 123-321; correlation-id: 456-654
```

### Использование `Headers`
Альтернативный способ:
```rust
use volga::{App, ok};
use volga::headers::Headers;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/hello", |headers: Headers| async move {
        let api_key = headers.get("x-api-key")
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

## Запись заголовков в ответ
Для добавления своих заголовков в ответ создайте [`HeaderMap`](https://docs.rs/http/latest/http/header/struct.HeaderMap.html), добавьте заголовки, а затем оберните результат в [`ResponseContext`](https://docs.rs/volga/latest/volga/app/results/struct.ResponseContext.html):
```rust
use std::collections::HashMap;
use volga::{App, Results, ResponseContext};

#[tokio::main]
async fn main() -> std::io::Result<()> {
   let mut app = App::new();

   app.map_get("/hello", || async {
       let mut headers = HashMap::new();

       headers.insert(String::from("x-api-key"), String::from("some api key"));
       headers.insert(String::from("Content-Type"), String::from("text/plain"));
       
       Results::from(ResponseContext {
           status: 200,
           content: "Hello World!",
           headers
       })
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

## Упрощение при помощи макросов `headers!` и `ok!`
Волга предоставляет такие макросы как [`headers!`](https://docs.rs/volga/latest/volga/macro.headers.html) и [`ok!`](https://docs.rs/volga/latest/volga/macro.ok.html), которые так же помогают упростить работу с заголовками:
```rust
use volga::{App, Results, ResponseContext, headers};

#[tokio::main]
async fn main() -> std::io::Result<()> {
   let mut app = App::new();

   app.map_get("/hello", || async {
       let mut headers = headers![
           ("x-api-key", "some api key"),
           ("Content-Type", "text/plain")
       ];

       Results::from(ResponseContext {
           status: 200
           content: "Hello World!",
           headers
       })
   });

   app.run().await
}
```
При помощи макроса [`ok!`](https://docs.rs/volga/latest/volga/macro.ok.html) мы можем еще больше упростить код приведенный выше:
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
Полные примеры доступны [здесь](https://github.com/RomanEmreis/volga/blob/main/examples/headers.rs) и [здесь](https://github.com/RomanEmreis/volga/blob/main/examples/custom_request_headers.rs).