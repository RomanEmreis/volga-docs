# Блокирующая работа

Синхронный обработчик, который действительно **блокирует**, — `std::fs`, синхронный драйвер базы данных, долгое вычисление, — не должен выполняться на воркере рантайма: пока он работает, этот воркер больше ничего не опрашивает. Оберните его в [`blocking`](https://docs.rs/volga/latest/volga/fn.blocking.html), и его тело будет выполняться в блокирующем пуле Tokio:

```rust compile
use volga::{App, HttpResult, blocking, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/reports/{id}", blocking(|id: u32| -> HttpResult {
        let report = std::fs::read_to_string(format!("reports/{id}.txt"))?;
        ok!(report)
    }));

    app.run().await
}
```

* Экстракторы по-прежнему выполняются на воркере; в [`spawn_blocking`](https://docs.rs/tokio/latest/tokio/task/fn.spawn_blocking.html) переносится и там ожидается только тело.
* `blocking` принимает синхронный обработчик. Асинхронному переносить нечего — он и так уступает управление, — и компилятор его отклонит.
* Обработчик разделяется между запросами, а не клонируется для каждого, поэтому захваченное им не обязано быть `Clone`.
* Паника в теле возобновляется в задаче, которая его ожидает, — так же, как если бы обработчик выполнялся на месте.
* Передача работы в другой поток стоит гораздо больше, чем короткое тело, поэтому используйте `blocking` только тогда, когда тело действительно блокирует.

## Отмена

Вынесенный вызов **не** отменяется вместе с запросом: начавшись, он выполняется до конца, а его результат отбрасывается, если клиент уже ушёл. Долгое тело, которое должно останавливаться раньше, принимает [`CancellationToken`](/volga-docs/ru/reliability-observability/cancellation.html) и проверяет его по ходу работы:

```rust compile
use std::time::Duration;
use volga::{App, CancellationToken, blocking};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/blocking-task", blocking(|token: CancellationToken| {
        for _ in 0..5 {
            if token.is_cancelled() {
                break;
            }
            std::thread::sleep(Duration::from_secs(1));
        }
        "done"
    }));

    app.run().await
}
```

Полный пример доступен по [ссылке](https://github.com/RomanEmreis/volga/blob/main/examples/long_running_task/src/main.rs).
