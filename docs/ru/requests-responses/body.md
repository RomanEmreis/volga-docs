# Сырое тело запроса

Большинство обработчиков используют типизированные экстракторы — [`Json<T>`](/volga-docs/ru/requests-responses/json-payload.html), [`Form<T>`](/volga-docs/ru/requests-responses/form.html), [`Multipart`](/volga-docs/ru/requests-responses/multipart.html) — и никогда не работают с байтами напрямую. Но когда байты всё же нужны (прокси, вебхук, подпись которого покрывает точное содержимое, свой бинарный формат), Волга даёт доступ к телу запроса как есть.

## Чтение тела в байты

Начиная с **v0.9.4**, [`HttpBody`](https://docs.rs/volga/latest/volga/http/body/struct.HttpBody.html) является экстрактором — достаточно объявить его аргументом обработчика, чтобы получить сырое тело запроса:

```toml
[dependencies]
volga = { version = "..." }
tokio = { version = "...", features = ["full"] }
http-body-util = "0.1"
```

```rust
use http_body_util::BodyExt;
use volga::{App, HttpBody, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_post("/raw", |body: HttpBody| async move {
        let bytes = body.collect().await?.to_bytes();
        ok!(format!("received {} bytes", bytes.len()))
    });

    app.run().await
}
```

Для сборки тела нужны методы трейта [`Body`](https://docs.rs/http-body/latest/http_body/trait.Body.html), которые приходят из расширяющего трейта [`BodyExt`](https://docs.rs/http-body-util/latest/http_body_util/trait.BodyExt.html) крейта `http-body-util` — Волга его не реэкспортирует.

::: warning
Тело запроса — это поток, который можно прочитать лишь однажды, поэтому [`HttpBody`](https://docs.rs/volga/latest/volga/http/body/struct.HttpBody.html) нельзя комбинировать с другим экстрактором тела в одном обработчике. Экстракторы, читающие только заголовочную часть запроса — [`Path<T>`](/volga-docs/ru/getting-started/route-params.html), [`Query<T>`](/volga-docs/ru/getting-started/query-params.html), [`HttpHeaders`](/volga-docs/ru/requests-responses/headers.html), [`Dc<T>`](/volga-docs/ru/advanced-patterns/di.html) — сочетаются с ним свободно.
:::

::: tip
Ограничение на размер тела продолжает действовать: по умолчанию Волга отклоняет тела больше 5 МБ. Настроить его можно через [`with_body_limit()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.with_body_limit) или полностью снять через [`without_body_limit()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.without_body_limit).
:::

## Проброс тела дальше

[`HttpBody`](https://docs.rs/volga/latest/volga/http/body/struct.HttpBody.html) можно и возвращать, поэтому обработчик-транзит сводится к перемещению тела в ответ — ничего не буферизуется:

```rust
use volga::{App, HttpBody, HttpResponse, headers::ContentType};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_post("/trace", |body: HttpBody| async move {
        HttpResponse::builder()
            .status(200)
            .header(ContentType::multipart_form_data("X-BOUNDARY"))
            .body(body)
    });

    app.run().await
}
```

## Потоковая обработка тела

Чтобы обрабатывать тело по мере поступления, а не собирать его целиком, используйте [`HttpBodyStream`](https://docs.rs/volga/latest/volga/http/body/type.HttpBodyStream.html) — это [`ByteStream`](https://docs.rs/volga/latest/volga/http/endpoints/args/byte_stream/struct.ByteStream.html) поверх тела запроса, реализующий [`Stream<Item = Result<Bytes, Error>>`](https://docs.rs/futures-core/latest/futures_core/stream/trait.Stream.html):

```toml
[dependencies]
volga = { version = "..." }
tokio = { version = "...", features = ["full"] }
futures-util = "0.3"
```

```rust
use futures_util::StreamExt;
use volga::{App, http::HttpBodyStream, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_post("/count", |mut stream: HttpBodyStream| async move {
        let mut total = 0;
        while let Some(chunk) = stream.next().await {
            total += chunk?.len();
        }
        ok!(format!("received {total} bytes"))
    });

    app.run().await
}
```

Такой подход подходит для тел, которые не хочется держать в памяти целиком: подсчёт хеша загрузки, пересылка чанков в хранилище, разбор построчного потока.

## Создание тела

Тот же тип используется и для построения тел ответа — именно это делают макросы семейства [`ok!`](https://docs.rs/volga/latest/volga/macro.ok.html) под капотом:

| Конструктор | Что создаёт |
|---|---|
| [`HttpBody::full`](https://docs.rs/volga/latest/volga/http/body/struct.HttpBody.html#method.full) | готовое тело в памяти из всего, что преобразуется в `Bytes` |
| [`HttpBody::empty`](https://docs.rs/volga/latest/volga/http/body/struct.HttpBody.html#method.empty) | пустое тело |
| [`HttpBody::json`](https://docs.rs/volga/latest/volga/http/body/struct.HttpBody.html#method.json) / [`form`](https://docs.rs/volga/latest/volga/http/body/struct.HttpBody.html#method.form) | сериализованное тело JSON или формы |
| [`HttpBody::file`](https://docs.rs/volga/latest/volga/http/body/struct.HttpBody.html#method.file) | потоковое тело поверх открытого файла |
| [`HttpBody::stream`](https://docs.rs/volga/latest/volga/http/body/struct.HttpBody.html#method.stream) / [`stream_bytes`](https://docs.rs/volga/latest/volga/http/body/struct.HttpBody.html#method.stream_bytes) | потоковое тело поверх любого `Stream` |

## Примеры

Проброс сырого тела можно посмотреть в [примере с multipart](https://github.com/RomanEmreis/volga/blob/main/examples/multipart/src/main.rs).
