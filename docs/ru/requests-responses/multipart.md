# Multipart-ответы

Начиная с версии `0.9.2`, [`Multipart`](https://docs.rs/volga/latest/volga/http/endpoints/args/multipart/struct.Multipart.html) в Волге работает в обе стороны: помимо использования в качестве экстрактора входящего запроса (см. [Работа с файлами](./files.md)), он реализует [`IntoResponse`](https://docs.rs/volga/latest/volga/http/response/trait.IntoResponse.html) и может возвращаться из обработчиков, формируя ответ с типом `multipart/*`.

Это удобно, когда нужно:
* Вернуть в одном ответе несколько связанных блобов (в стиле `form-data`).
* Отдать частичное содержимое для HTTP-запроса с заголовком `Range` как `multipart/byteranges`.
* Вернуть разнородный набор частей как `multipart/mixed`.
* Проксировать или переслать входящий multipart обратно клиенту.

Как и парсинг входящих multipart-запросов, отправка multipart-ответов закрыта за фичей `multipart`. Если вы не используете набор `full`, её нужно явно включить в `Cargo.toml`:
```toml
[dependencies]
volga = { version = "...", features = ["multipart"] }
```

## Возврат multipart-ответа

Самый простой способ собрать исходящий multipart — функция [`Multipart::from_parts`](https://docs.rs/volga/latest/volga/http/endpoints/args/multipart/struct.Multipart.html#method.from_parts), принимающая любой `IntoIterator<Item = Part>`:
```rust
use volga::{App, Multipart, multipart::Part};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // GET /form
    app.map_get("/form", || async {
        Multipart::from_parts([
            Part::text("greeting", "hello"),
            Part::text("name", "world"),
        ])
    });

    app.run().await
}
```

В ответе будет проставлен заголовок `Content-Type: multipart/form-data; boundary=...` со сгенерированным boundary, а каждая часть [`Part`](https://docs.rs/volga/latest/volga/http/endpoints/args/multipart/struct.Part.html) кодируется со своим заголовком `Content-Disposition` и (если уместно) `Content-Type`.

## Создание частей

[`Part`](https://docs.rs/volga/latest/volga/http/endpoints/args/multipart/struct.Part.html) предоставляет небольшой builder API для типичных случаев:

| Метод | Когда использовать |
| --- | --- |
| [`Part::text(name, value)`](https://docs.rs/volga/latest/volga/http/endpoints/args/multipart/struct.Part.html#method.text) | Простое текстовое поле `text/plain; charset=utf-8`. |
| [`Part::bytes(name, bytes)`](https://docs.rs/volga/latest/volga/http/endpoints/args/multipart/struct.Part.html#method.bytes) | Бинарное поле с типом `application/octet-stream`. |
| [`Part::file(name, filename, bytes)`](https://docs.rs/volga/latest/volga/http/endpoints/args/multipart/struct.Part.html#method.file) | Файл, целиком находящийся в памяти. `Content-Type` определяется по имени файла через `mime_guess`. |
| [`Part::stream(name, filename, ct, stream)`](https://docs.rs/volga/latest/volga/http/endpoints/args/multipart/struct.Part.html#method.stream) | Файловая часть с потоковым телом — данные отправляются лениво, чанк за чанком. |
| [`Part::new(body)`](https://docs.rs/volga/latest/volga/http/endpoints/args/multipart/struct.Part.html#method.new) | Часть без `Content-Disposition`; заголовки навешиваются методами `with_*`. |

У каждого билдера есть отказоустойчивый аналог `try_*` (`try_text`, `try_bytes`, `try_file`, `try_stream`, `try_with_disposition`) — конструкторы для статических входных данных паникуют при некорректных байтах в заголовках, а варианты `try_*` стоит использовать, когда имя поля или имя файла приходят из недоверенных источников.

Типичный пример со смешанным содержимым — текстовое поле и файл в памяти:
```rust
use bytes::Bytes;
use volga::{App, Multipart, multipart::Part};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/report", || async {
        Multipart::from_parts(vec![
            Part::text("greeting", "hello"),
            Part::file("logo", "logo.bin", Bytes::from_static(b"\x01\x02\x03")),
        ])
    });

    app.run().await
}
```

## Потоковые части

Если тело части большое или формируется постепенно, используйте [`Part::stream`](https://docs.rs/volga/latest/volga/http/endpoints/args/multipart/struct.Part.html#method.stream) — оно отправится без буферизации. Тело должно быть `Stream<Item = Result<Bytes, volga::error::Error>>`:
```rust
use bytes::Bytes;
use futures_util::stream;
use volga::{App, Multipart, multipart::Part};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/stream", || async {
        let chunks = stream::iter(vec![
            Ok::<_, volga::error::Error>(Bytes::from_static(b"alpha-")),
            Ok(Bytes::from_static(b"beta-")),
            Ok(Bytes::from_static(b"gamma")),
        ]);
        let part = Part::stream(
            "log",
            "log.txt",
            volga::headers::ContentType::text_utf_8(),
            chunks,
        );
        Multipart::from_parts(vec![part])
    });

    app.run().await
}
```

Если сами части формируются лениво (например, при перечислении файлов или вычислении байтовых диапазонов по требованию), используйте [`Multipart::from_stream`](https://docs.rs/volga/latest/volga/http/endpoints/args/multipart/struct.Multipart.html#method.from_stream) — она принимает любой `Stream<Item = Part>` и отправляет каждую часть по мере поступления.

## Выбор подтипа

По умолчанию исходящий multipart использует подтип `multipart/form-data`. Чтобы переключиться на `mixed`, `byteranges` или любой другой подтип из RFC 2046, вызовите [`Multipart::with_subtype`](https://docs.rs/volga/latest/volga/http/endpoints/args/multipart/struct.Multipart.html#method.with_subtype):
```rust
use bytes::Bytes;
use volga::{App, Multipart, multipart::{MultipartSubtype, Part}};
use volga::headers::{ContentType, HeaderName, HeaderValue};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/ranges", || async {
        let part1 = Part::new(b"first" as &[u8])
            .with_content_type(ContentType::text_utf_8())
            .with_header_raw(
                HeaderName::from_static("content-range"),
                HeaderValue::from_static("bytes 0-4/10"),
            );
        let part2 = Part::new(b"five!" as &[u8])
            .with_content_type(ContentType::text_utf_8())
            .with_header_raw(
                HeaderName::from_static("content-range"),
                HeaderValue::from_static("bytes 5-9/10"),
            );

        Multipart::from_parts(vec![part1, part2])
            .with_subtype(MultipartSubtype::ByteRanges)
    });

    app.run().await
}
```

Поддерживаемые варианты:
* [`MultipartSubtype::FormData`](https://docs.rs/volga/latest/volga/http/endpoints/args/multipart/enum.MultipartSubtype.html#variant.FormData) — значение по умолчанию; канонический подтип для форм и загрузки файлов.
* [`MultipartSubtype::Mixed`](https://docs.rs/volga/latest/volga/http/endpoints/args/multipart/enum.MultipartSubtype.html#variant.Mixed) — разнородные части.
* [`MultipartSubtype::ByteRanges`](https://docs.rs/volga/latest/volga/http/endpoints/args/multipart/enum.MultipartSubtype.html#variant.ByteRanges) — ответы с частичным содержимым на HTTP-запросы с заголовком `Range`.
* [`MultipartSubtype::Custom(s)`](https://docs.rs/volga/latest/volga/http/endpoints/args/multipart/enum.MultipartSubtype.html#variant.Custom) — любой другой подтип, например `alternative` или `related`.

## Свой boundary

Boundary генерируется автоматически и соответствует RFC 2046 §5.1.1. Чтобы зафиксировать его (полезно в тестах или при работе со строгими клиентами), используйте [`Multipart::with_boundary`](https://docs.rs/volga/latest/volga/http/endpoints/args/multipart/struct.Multipart.html#method.with_boundary). Метод проверяет значение и возвращает ошибку, если boundary некорректен:
```rust
use volga::{App, Multipart, multipart::Part};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/fixed", || async {
        Multipart::from_parts([Part::text("k", "v")])
            .with_boundary("MY-FIXED-BOUNDARY")
    });

    app.run().await
}
```

## Проксирование входящего multipart

Когда нужно проксировать или переслать входящее multipart-тело обратно клиенту, используйте [`Multipart::into_outgoing`](https://docs.rs/volga/latest/volga/http/endpoints/args/multipart/struct.Multipart.html#method.into_outgoing). Метод перекодирует входящий multipart в исходящий потоковый — каждое поле превращается в `Part` с потоковым телом:
```rust
use volga::{App, Multipart};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // POST /echo — отдаёт входящий multipart обратно клиенту
    app.map_post("/echo", |multipart: Multipart| async move {
        multipart.into_outgoing()
    });

    app.run().await
}
```

> Внимание: `into_outgoing` **не побайтово точен** — boundary перегенерируется, порядок заголовков может отличаться. Для побайтовой передачи без изменений пропустите экстрактор `Multipart` и пробрасывайте сырое [`HttpBody`](https://docs.rs/volga/latest/volga/http/body/struct.HttpBody.html).

На стороне запроса Волга также принимает любой подтип `multipart/*` (не только `multipart/form-data`), поэтому пересылка `multipart/byteranges`, `multipart/mixed` и других подтипов работает «из коробки».

## OpenAPI

Если вы используете интеграцию с OpenAPI, метод [`OpenApiRouteConfig::produces_multipart(status)`](https://docs.rs/volga/latest/volga/struct.OpenApiRouteConfig.html#method.produces_multipart) описывает ответ с типом `multipart/form-data` для указанного HTTP-статуса в сгенерированной спецификации.

Подробный рабочий пример доступен [здесь](https://github.com/RomanEmreis/volga/blob/main/examples/multipart/src/main.rs).
