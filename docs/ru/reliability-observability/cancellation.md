# Отмена запросов

Если необходимо отменить длительную задачу при закрытии соединения удаленным клиентом (например, при закрытии страницы браузера), Волга поддерживает отслеживание таких сценариев, вводя [`CancellationToken`](https://docs.rs/volga/latest/volga/app/endpoints/args/cancellation_token/type.CancellationToken.html) для каждого HTTP-запроса. Который работает поверх [`CancellationToken`](https://docs.rs/tokio-util/0.7.13/tokio_util/sync/struct.CancellationToken.html) среды [Tokio](https://tokio.rs/).

Вот как это можно использовать:

```rust
use std::time::Duration;
use volga::{App, CancellationToken, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // Пример длительной задачи
    app.map_get("/long-task", |cancellation_token: CancellationToken| async move {       
        // Запускаем бесконечный цикл, пока клиент не разорвет соединение
        let mut interval = tokio::time::interval(Duration::from_millis(1000));

        while !cancellation_token.is_cancelled() {
            interval.tick().await;

            // Выполняем длительную задачу...
        }

        ok!("done")
    });
    
    app.run().await
}
```
Более продвинутый вариант с использованием [`tokio::select!`](https://docs.rs/tokio/latest/tokio/macro.select.html):
```rust
use std::time::Duration;
use volga::{App, CancellationToken, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // Пример длительной задачи
    app.map_get("/long-task", |cancellation_token: CancellationToken| async move {
        // Запускаем бесконечный цикл, пока клиент не разорвет соединение
        tokio::select! {
            _ = cancellation_token.cancelled() => (),
            result = long_running_task() => ()
        }
        
        ok!("done")
    });
    
    app.run().await
}

async fn long_running_task() {
    let mut interval = tokio::time::interval(Duration::from_millis(100));
    loop {
        interval.tick().await;
        
        // Выполняем длительную задачу...
    }
}
```
В приведенном выше примере, когда удаленный клиент отменяет запрос, сначала будет завершен [`cancellation_token.cancelled()`](https://docs.rs/tokio-util/0.7.13/tokio_util/sync/struct.CancellationToken.html#method.cancelled), а затем [`tokio::select!`](https://docs.rs/tokio/latest/tokio/macro.select.html) отменит `long_running_task()`.

Эта функция может помочь сэкономить много вычислительных ресурсов, предотвращая бесполезное выполнение длительных задач, в то время как быстрые, небольшие задачи, которые выполняются быстрее 300 мс, не будут затронуты.

[Здесь](https://docs.rs/tokio-util/latest/tokio_util/sync/struct.CancellationToken.html) вы можете найти дополнительную информацию о `CancellationToken`.
