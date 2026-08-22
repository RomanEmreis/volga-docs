# Плавное завершение работы

Волга всегда завершается плавно по сигналу ОС — `Ctrl+C` и `SIGTERM` на Unix и их аналоги на Windows. Когда приходит сигнал, слушатель перестаёт принимать новые соединения, уже начатым запросам даётся возможность завершиться, и только после этого [`run()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.run) возвращает управление.

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

Поскольку хэндл — это обычное клонируемое значение, его можно передать через [внедрение зависимостей](/volga-docs/ru/advanced-patterns/di.html) и получить административный эндпоинт остановки:

```rust compile
use volga::{App, ShutdownHandle, di::Dc, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let handle = ShutdownHandle::new();

    let mut app = App::new().with_shutdown_signal(handle.clone());
    app.add_singleton(handle);

    app.map_post("/admin/shutdown", |handle: Dc<ShutdownHandle>| async move {
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

## Завершение и отмена запроса

Вещи связанные, но разные. Завершение работы даёт активным запросам **доработать**; [отмена запроса](/volga-docs/ru/reliability-observability/cancellation.html) срабатывает, когда *клиент* пропал посреди запроса. Долгоиграющий обработчик стоит писать с учётом обоих: следить за [`CancellationToken`](https://docs.rs/volga/latest/volga/app/endpoints/args/cancellation_token/type.CancellationToken.html) конкретного запроса, чтобы не работать на ушедшего клиента, и за хэндлом завершения, чтобы не удерживать процесс дольше, чем нужно.
