# Плавное завершение работы

Волга всегда завершается плавно по сигналу ОС — `Ctrl+C` и `SIGTERM` на Unix и их аналоги на Windows. Когда приходит сигнал, слушатель перестаёт принимать новые соединения, уже начатым запросам даётся возможность завершиться в пределах [таймаута завершения](#таимаут-завершения), и только после этого [`run()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.run) возвращает управление.

Начиная с **v0.9.3**, то же самое завершение можно инициировать из своего кода с помощью [`ShutdownHandle`](https://docs.rs/volga/latest/volga/app/shutdown/struct.ShutdownHandle.html) — для административного эндпоинта, вотчдога, истёкшей аренды или воркера, доделавшего задачу, ради которой процесс и запускался.

## Приложение с хэндлом

[`App::with_shutdown()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.with_shutdown) возвращает приложение вместе со свежим хэндлом:

```rust compile
use std::time::Duration;
use volga::App;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let (app, shutdown) = App::with_shutdown();

    tokio::spawn(async move {
        tokio::time::sleep(Duration::from_secs(60)).await;
        shutdown.shutdown();
    });

    app.run().await
}
```

Хэндл дёшево клонируется и может быть передан куда угодно; вызов [`shutdown()`](https://docs.rs/volga/latest/volga/app/shutdown/struct.ShutdownHandle.html#method.shutdown) у любого клона запускает одно и то же плавное завершение. Он **дополняет** встроенный обработчик сигналов, а не заменяет его — срабатывает то, что произошло раньше.

## Регистрация внешнего хэндла

Если хэндл принадлежит другому коду — создан при старте, хранится в состоянии приложения, разделяется с фоновыми задачами — зарегистрируйте его на уже созданном приложении через [`with_shutdown_signal()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.with_shutdown_signal):

```rust compile
use volga::{App, ShutdownHandle};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let handle = ShutdownHandle::new();
    let app = App::new().with_shutdown_signal(handle.clone());

    // теперь `handle` может жить в состоянии, в супервизоре, в CLI-команде...
    app.run().await
}
```

[`ShutdownHandle`](https://docs.rs/volga/latest/volga/app/shutdown/struct.ShutdownHandle.html) построен поверх [`CancellationToken`](https://docs.rs/tokio-util/latest/tokio_util/sync/struct.CancellationToken.html) из Tokio, поэтому он может принять уже существующий токен через [`ShutdownHandle::from_token()`](https://docs.rs/volga/latest/volga/app/shutdown/struct.ShutdownHandle.html#method.from_token) (или эквивалентный `From<CancellationToken>`) — так сервер встраивается в дерево отмены, которое уже используется в остальном процессе.

Ещё два метода позволяют наблюдать за состоянием, а не инициировать его:

* [`is_shutdown_requested()`](https://docs.rs/volga/latest/volga/app/shutdown/struct.ShutdownHandle.html#method.is_shutdown_requested) — было ли запрошено завершение;
* [`cancelled()`](https://docs.rs/volga/latest/volga/app/shutdown/struct.ShutdownHandle.html#method.cancelled) — future, который завершается в этот момент, чтобы фоновые задачи сворачивались вместе с сервером.

## Завершение по future

[`shutdown_on()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.shutdown_on) инициирует плавное завершение, когда переданный future завершается. Это удобно для всего, что уже сигнализирует о себе асинхронно: канал `oneshot`, внешний вотчдог, уведомление о перезагрузке конфигурации, неудавшееся продление аренды.

```rust compile
use volga::App;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let (tx, rx) = tokio::sync::oneshot::channel::<()>();

    let app = App::new()
        .bind("127.0.0.1:7878")
        .shutdown_on(async move { let _ = rx.await; });

    // отправка в `tx` позже инициирует плавное завершение
    app.run().await
}
```

Несколько вызовов [`shutdown_on()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.shutdown_on) складываются: завершение любого из зарегистрированных future запускает остановку, и все они сочетаются с обработчиком сигналов ОС и с ранее зарегистрированным [`ShutdownHandle`](https://docs.rs/volga/latest/volga/app/shutdown/struct.ShutdownHandle.html). Если хэндл не регистрировался, он создаётся внутри автоматически.

::: tip
Future запускается в рантайме Tokio в момент старта приложения, поэтому [`shutdown_on()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.shutdown_on) безопасно вызывать до того, как рантайм вообще существует — в том числе перед [`run_blocking()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.run_blocking).
:::

## Завершение из обработчика

[`ShutdownHandle`](https://docs.rs/volga/latest/volga/app/shutdown/struct.ShutdownHandle.html) — ещё и экстрактор: обработчик или middleware, принимающие его, получают хэндл работающего сервера, независимо от того, передавался ли он приложению через [`with_shutdown()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.with_shutdown). Поэтому административный эндпоинт остановки умещается в несколько строк:

```rust compile
use volga::{App, ShutdownHandle, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_post("/admin/shutdown", |handle: ShutdownHandle| {
        handle.shutdown();
        ok!("shutting down")
    });

    app.run().await
}
```

Ответ при этом всё равно будет доставлен: запрос, инициировавший остановку, находится в обработке, а именно таких запросов и дожидается плавное завершение.

::: warning
Такой эндпоинт обязательно закрывайте [аутентификацией и авторизацией](/volga-docs/ru/security-access/auth.html) — он останавливает сервер для всех.
:::

## Таймаут завершения

Когда начинается завершение, цикл приёма перестаёт принимать новые соединения, а открытым соединениям сообщается, что после текущего ответа их нужно закрыть. `run()` ждёт их в пределах **таймаута завершения** — по умолчанию 10 секунд. Соединение, которое всё ещё открыто, когда таймаут истёк, закрывается: [`CancellationToken`](/volga-docs/ru/reliability-observability/cancellation.html) его запроса отменяется, а ответ обрывается там, где он есть. `run()` возвращает управление, когда не остаётся ни одного соединения, включая соединения [слушателя HTTPS-редиректа](/volga-docs/ru/protocols-realtime/https.html), а сервисы приложения, включая синглтоны, освобождаются уже после этого. Незавершённое TLS-рукопожатие не ждут, а обрывают: запроса за ним ещё нет.

Таймаут задаётся методом [`with_shutdown_timeout()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.with_shutdown_timeout):

```rust compile
use std::time::Duration;
use volga::App;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let app = App::new().with_shutdown_timeout(Duration::from_secs(30));

    app.run().await
}
```

или ключом `shutdown_timeout_secs` секции `[server]` [конфигурационного файла](/volga-docs/ru/middleware-infrastructure/config-files.html#встроенные-секции):

```toml
[server]
shutdown_timeout_secs = 30
```

`Duration::ZERO` закрывает открытые соединения сразу.

## Завершение долгих ответов

Ответ, который сам по себе не заканчивается, — поток [SSE](/volga-docs/ru/protocols-realtime/sse.html), проксируемый поток, — держит соединение открытым весь таймаут завершения. Вместо этого он может завершиться сам, как только началась остановка: примите `ShutdownHandle` и оборвите поток по [`cancelled()`](https://docs.rs/volga/latest/volga/app/shutdown/struct.ShutdownHandle.html#method.cancelled), который возвращает `'static` future:

```rust compile
use std::time::Duration;
use futures_util::StreamExt;
use volga::{App, ShutdownHandle, http::sse::{Message, SseStream}, sse_stream};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/events", |shutdown: ShutdownHandle| async move {
        let events = sse_stream! {
            loop {
                yield Message::new().data("tick");
                tokio::time::sleep(Duration::from_secs(1)).await;
            }
        };
        SseStream::new(events.take_until(shutdown.cancelled()))
    });

    app.run().await
}
```

## Завершение и отмена запроса

Это разные сигналы. Только что начавшееся завершение даёт активным запросам **доработать**, поэтому [`CancellationToken`](https://docs.rs/volga/latest/volga/app/endpoints/args/cancellation_token/type.CancellationToken.html) запроса в этот момент не отменяется: обработчик, прервавший работу по нему, провалил бы запросы без всякой причины. Токен говорит о том, что ответ больше не нужен: клиент ушёл или таймаут завершения истёк и соединение закрывается.

Долгоиграющий обработчик стоит писать с учётом обоих: следить за `CancellationToken`, чтобы не работать над ответом, который никто не прочитает, и за `ShutdownHandle`, чтобы не задерживать завершение до таймаута.
