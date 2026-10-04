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

```rust compile
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
Ограничение на размер тела продолжает действовать: по умолчанию Волга отвечает `413 Content Too Large` на тело больше 5 МБ, как бы обработчик его ни читал. Как задать его для приложения, группы маршрутов или маршрута — в разделе [Ограничение размера тела](#ограничение-размера-тела).
:::

## Проброс тела дальше

[`HttpBody`](https://docs.rs/volga/latest/volga/http/body/struct.HttpBody.html) можно и возвращать, поэтому обработчик-транзит сводится к перемещению тела в ответ — ничего не буферизуется:

```rust compile
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

```rust compile
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

## Ограничение размера тела

У каждого тела запроса есть ограничение — 5 МБ, если не задано другое. На тело больше него Волга отвечает [`413 Content Too Large`](https://developer.mozilla.org/ru/docs/Web/HTTP/Status/413), каким бы способом обработчик его ни читал: [`Json<T>`](/volga-docs/ru/requests-responses/json-payload.html), [`Form<T>`](/volga-docs/ru/requests-responses/form.html), [`File`](/volga-docs/ru/requests-responses/files.html), [`Multipart`](/volga-docs/ru/requests-responses/files.html#загрузка-нескольких-фаилов), `HttpBody` или поток.

Ограничение для всего приложения задаётся через [`with_body_limit()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.with_body_limit) или ключом `body_limit_bytes` секции `[server]` в [файле конфигурации](/volga-docs/ru/middleware-infrastructure/config-files.html#встроенные-секции):

```rust compile
use volga::{App, Limit};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    // 1 МБ на любое тело запроса
    let app = App::new().with_body_limit(Limit::Limited(1024 * 1024));

    app.run().await
}
```

### Для группы и для маршрута

Начиная с **0.13.1** [группа маршрутов](/volga-docs/ru/getting-started/route-groups.html) и отдельный маршрут могут задать собственное ограничение через [`RouteGroup::with_body_limit()`](https://docs.rs/volga/latest/volga/app/router/struct.RouteGroup.html#method.with_body_limit) и [`Route::with_body_limit()`](https://docs.rs/volga/latest/volga/app/router/struct.Route.html#method.with_body_limit). Оно заменяет ограничение приложения, а значит, может как уменьшить его, так и увеличить — API держит жёсткий лимит для JSON-эндпоинтов и всё равно принимает файлы на том единственном маршруте, которому они нужны:

```rust compile
use futures_util::StreamExt;
use volga::{App, Json, Limit, http::HttpBodyStream, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.group("/api", |api| {
        // Всё, что нужно JSON API
        api.with_body_limit(Limit::Limited(64 * 1024));

        api.map_post("/messages", |Json(text): Json<String>| async move {
            ok!(text)
        });

        // Единственный маршрут, принимающий файл
        api.map_post("/attachments", |mut stream: HttpBodyStream| async move {
            let mut total = 0;
            while let Some(chunk) = stream.next().await {
                total += chunk?.len();
            }
            ok!(format!("stored {total} bytes"))
        })
        .with_body_limit(Limit::Limited(20 * 1024 * 1024));
    });

    app.run().await
}
```

Какое ограничение получит запрос, решается тем, куда он был смаршрутизирован:

* **Побеждает самое конкретное ограничение.** Собственное ограничение маршрута — над ограничением его группы, вложенной группы — над внешней, группы — над ограничением приложения. Где никто его не задал, действует ограничение приложения.
* **Ограничение группы распространяется на каждый зарегистрированный ею маршрут**, включая маршруты вложенных групп, независимо от порядка внутри замыкания — как и остальные [настройки группы](/volga-docs/ru/getting-started/route-groups.html#настроики-уровня-группы). Маршрут или вложенная группа, задавшие собственное ограничение, сохраняют его.
* **[Fallback группы](/volga-docs/ru/getting-started/route-groups.html#fallback-группы) получает ограничение группы.** Запрос, который не забрал ни один маршрут или группа, получает ограничение приложения.
* **`Limit::Default` — это значение фреймворка по умолчанию**, 5 МБ, а не ограничение окружающей группы или приложения. Чтобы унаследовать его, просто не задавайте ограничение.

[`HttpRequest::body_limit()`](https://docs.rs/volga/latest/volga/http/request/struct.HttpRequest.html#method.body_limit) возвращает ограничение, которое получил запрос, в байтах, или `None`, если его нет, — в обработчике или в [middleware](/volga-docs/ru/middleware-infrastructure/middleware.html).

### Снятие ограничения

[`without_body_limit()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.without_body_limit) снимает ограничение — для всего приложения или, начиная с **0.13.1**, для одной группы или одного маршрута. `Limit::Unlimited` делает то же самое. Это нужно обработчику, который читает тело потоком и сам следит за его размером, например прокси, пробрасывающему тело дальше:

```rust compile
use volga::{App, HttpBody, HttpResponse};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // Сколько принять, решает вышестоящий сервис
    app.map_post("/proxy", |body: HttpBody| async move {
        HttpResponse::builder()
            .status(200)
            .body(body)
    })
    .without_body_limit();

    app.run().await
}
```

::: warning
Без ограничения сколько прочитает сервер, решает клиент. Снимайте его только на маршруте, который сам считает байты или передаёт их тому, кто считает, — и никогда на маршруте, собирающем тело в память.
:::

### Когда отправляется `413`

Ограничение проверяется по мере чтения тела, поэтому обработчик, который тело не читает, оно не затрагивает. Если же читает:

* **Заявленная длина больше ограничения отклоняется до того, как прочитан хоть байт.** Если `Content-Length` уже говорит, что тело не поместится, первое же чтение завершается ошибкой `413` — даже у обработчика, которому нужны были лишь первые байты. Клиент, отправивший `Expect: 100-continue`, получает `413` вместо `100 Continue` и тело не отправляет вовсе.
* **Тело без заявленной длины** (chunked) отклоняется, как только пришло больше, чем помещается.
* **Отклонённое тело даёт одну ошибку и заканчивается.** Чтение, превысившее ограничение, возвращает ошибку `413`, а каждое следующее — конец тела, поэтому цикл, который логирует ошибку и читает дальше, не зацикливается и не вытягивает остаток загрузки. Верните ошибку через `?`, и она дойдёт до [обработчика ошибок](/volga-docs/ru/reliability-observability/errors.html), как любая другая, со статусом `413`.

::: tip
В HTTP/1 соединение нельзя переиспользовать, пока часть тела не прочитана, поэтому после такого ответа оно закрывается. Пока клиент может ещё отправлять данные, Волга продолжает читать и отбрасывать то, что приходит, — не дольше 2 секунд и не дольше 500 мс, если ничего не приходит, — чтобы клиент получил `413`, а не сброс соединения. [Плавное завершение](/volga-docs/ru/reliability-observability/graceful-shutdown.html) дожидается и такого соединения. HTTP/2 завершает только поток и сохраняет соединение.
:::

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
