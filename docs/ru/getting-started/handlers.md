# Обработчики

Обработчик запроса — это функция или замыкание, сопоставленные маршруту. Его аргументы — [экстракторы](/volga-docs/ru/getting-started/route-params.html): параметры маршрута и строки запроса, заголовки, JSON-тело, сервисы из [DI](/volga-docs/ru/advanced-patterns/di.html), — а то, что он возвращает, превращается в ответ. Волга принимает обработчик в двух формах и определяет, какая из них перед ней, по сигнатуре.

## Асинхронные обработчики

`async fn` или замыкание, возвращающее future. Это форма для обработчика, которому есть что ждать: запроса к базе данных, HTTP-вызова, чтения файла через `tokio::fs`.

```rust compile
use volga::{App, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/hello/{name}", |name: String| async move {
        ok!("Hello, {name}!")
    });

    app.map_get("/users/{id}", get_user);

    app.run().await
}

async fn get_user(id: u32) -> String {
    // например, `db.find_user(id).await`
    format!("user #{id}")
}
```

## Синхронные обработчики

Начиная с **v0.11.0** обработчик, которому нечего ждать, — форматирование, арифметика, поиск в памяти, проверка заголовка, — может быть обычной `fn` или замыканием, которое возвращает ответ напрямую:

```rust compile
use volga::{App, HttpResult, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/sum/{x}/{y}", |x: i32, y: i32| x + y);
    app.map_get("/hello/{name}", |name: String| ok!("Hello, {name}!"));
    app.map_get("/health", health);

    app.run().await
}

fn health() -> HttpResult {
    ok!("healthy")
}
```

Всё остальное — как у асинхронной формы: экстракторы выполняются до обработчика, поэтому `Json<T>`, `Form<T>`, `Query<T>` и `Dc<T>` приходят с уже прочитанным телом; возвращать можно всё, что реализует [`IntoResponse`](https://docs.rs/volga/latest/volga/http/response/into_response/trait.IntoResponse.html), включая `HttpResult` и [`Result<T, E>`](#возврат-ошибок); в OpenAPI маршрут описывается так же.

```rust compile
use volga::{App, Json, ok};
use serde::Deserialize;

#[derive(Deserialize)]
struct User {
    name: String,
    age: u32,
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_post("/users", |user: Json<User>| {
        ok!("{} is {} years old", user.name, user.age)
    });

    app.run().await
}
```

Синхронный обработчик выполняется на том воркере рантайма, который опрашивает запрос, — ровно так же, как `async`-обработчик без единого `.await` внутри, и стоит столько же. Это подходящая форма для короткой работы, не нагружающей процессор.

### Где принимаются обе формы

* `map_get`, `map_post`, `map_put`, `map_patch`, `map_delete`, `map_head`, `map_options`, `map_trace`, `map_query` и `map` — у [`App`](https://docs.rs/volga/latest/volga/app/struct.App.html) и у [`RouteGroup`](https://docs.rs/volga/latest/volga/app/router/struct.RouteGroup.html);
* [`map_fallback`](/volga-docs/ru/reliability-observability/errors.html#fallback-обработчик) и [`map_err`](/volga-docs/ru/reliability-observability/errors.html);
* WebSocket-методы [`map_conn`](/volga-docs/ru/protocols-realtime/ws.html) и [`map_msg`](/volga-docs/ru/protocols-realtime/ws.html#простои-сервер);
* middleware [`filter`, `map_ok`, `map_err` и `tap_req`](/volga-docs/ru/middleware-infrastructure/middleware.html#синхронные-middleware).

`wrap`, `with` и `attach` принимают только асинхронные middleware: они существуют ради того, чтобы дождаться `next`.

## Возврат ошибок

Обработчик, который может завершиться неудачей, возвращает `Result<T, E>`: `Ok` — это ответ, а начиная с **0.12.0** `Err` — ошибка, которая передаётся [обработчику ошибок](/volga-docs/ru/reliability-observability/errors.html#возврат-ошибок-из-обработчика) и никогда не становится самостоятельным ответом. `E` — это `Error` из Volga, `StatusCode`, пара `(StatusCode, сообщение)`, `std::io::Error` или любой тип, реализующий [`IntoError`](https://docs.rs/volga/latest/volga/error/trait.IntoError.html), — и все они преобразуются через `?`.

```rust compile
use volga::{App, HttpResult, http::StatusCode, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/users/{id}", |id: u32| -> Result<String, StatusCode> {
        match id {
            1 => Ok("admin".into()),
            _ => Err(StatusCode::NOT_FOUND),
        }
    });

    app.map_get("/config", read_config);

    app.run().await
}

async fn read_config() -> HttpResult {
    // Отсутствующий файл — это 404, нечитаемый — 403
    let text = tokio::fs::read_to_string("app_config.toml").await?;
    ok!(text)
}
```

::: warning
Голое сообщение — `Err("not found")`, `Err(format!(..))` — не несёт статуса и отвечает `500`. Дайте ему статус: `Err((StatusCode::NOT_FOUND, "not found"))`.
:::

## Блокирующая работа

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

### Отмена

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

## Явные generic-параметры

В коде обработчика форма нигде не называется: её несёт тип-маркер, [`marker::Async`](https://docs.rs/volga/latest/volga/marker/struct.Async.html) или [`marker::Immediate`](https://docs.rs/volga/latest/volga/marker/struct.Immediate.html), который выводит компилятор. Это последний generic-параметр каждого метода, регистрирующего обработчик, поэтому там, где generic-параметры указаны явно, для него оставляют `_`:

```rust compile-fragment
app.map_get::<_, _, (i32, i32), _>("/sum/{x}/{y}", |x: i32, y: i32| x + y);
```

В собственном ограничении `F: GenericHandler<Args>` означает асинхронную форму, поскольку маркер по умолчанию — `marker::Async`; `F: GenericHandler<Args, M>` с обобщённым `M` принимает обе.

Тип, который одновременно является `Future` и `IntoResponse`, подходит под обе формы и не компилируется как тип результата обработчика. В самой Волге таких типов нет.

Полные примеры доступны [здесь](https://github.com/RomanEmreis/volga/blob/main/examples/hello_world/src/main.rs) и [здесь](https://github.com/RomanEmreis/volga/blob/main/examples/long_running_task/src/main.rs).
