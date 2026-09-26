# WebSockets

Волга обеспечивает встроенную поддержку WebSockets с использованием единого гибкого API. Это позволяет осуществлять бесшовную обработку соединений на всех уровнях, от установления соединения до обработки отдельных сообщений, с возможностью внедрения зависимостей или доступа к метаданным HTTP.

## Переключение между WebSockets и WebSocket-over-HTTP/2

При работе под HTTP/2, Волга использует WebSocket-over-HTTP/2 по-умолчанию и переключается на WebSockets, когда доступен только HTTP/1. Это поведение, так же, можно настроить с помощью флагов.

### WebSockets
```toml
[dependencies]
volga = { version = "...", features = ["ws"] }
```

### WebSocket-over-HTTP/2
```toml
[dependencies]
volga = { version = "...", features = ["http2", "ws"] }
```

## Простой сервер

После обновления `Cargo.toml` с флагом `ws` вы можете реализовать базовый обработчик сообщений с помощью метода [`map_msg()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_msg). Следующий пример отвечает отформатированной строкой, содержащей полученное сообщение:

```rust compile
use volga::App;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // Простой обработчик входящих сообщений
    app.map_msg("/ws", |msg: String| async move {
        format!("Received: {}", msg)
    });
    
    app.run().await
}
```

Обработчик сообщений, которому нечего ждать, начиная с **v0.11.0** может возвращать ответ напрямую:

```rust compile-fragment
app.map_msg("/ws", |msg: String| format!("echo: {msg}"));
```

### JSON-сообщения

Обработчик сообщений может принимать и возвращать [`Json<T>`](https://docs.rs/volga/latest/volga/struct.Json.html). `Json<T>` принимается из текстового или бинарного фрейма, а отправляется **текстовым** фреймом — и ответ обработчика `map_msg`, и [`WebSocket::send`](https://docs.rs/volga/latest/volga/ws/websocket/struct.WebSocket.html), и `WsSink::send`, — поэтому браузерный клиент читает его из `event.data` как строку и передаёт в `JSON.parse`:

```rust compile
use volga::{App, Json};
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
struct Request {
    text: String,
}

#[derive(Serialize)]
struct Reply {
    echo: String,
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_msg("/ws", |msg: Json<Request>| {
        Json(Reply { echo: msg.text.clone() })
    });

    app.run().await
}
```

### Собственные типы сообщений

Сообщение — это всё, что реализует `TryFrom<`[`Message`](https://docs.rs/volga/latest/volga/ws/args/struct.Message.html)`>`, а ответ — всё, что реализует `TryInto<Message>`. Начиная с **0.12.0** ошибкой их преобразования может быть любой тип, который превращается в `Error` из Volga, — `serde_json::Error`, пара `(StatusCode, E)`, ваш собственный тип, реализующий [`IntoError`](/volga-docs/ru/reliability-observability/errors.html#собственные-типы-ошибок), — а не только сам `Error`. То же верно для `WebSocket::on_msg`, `WebSocket::recv` и `send`, `WsStream::recv` и `WsSink::send`.

```rust compile
use serde::Deserialize;
use volga::{App, ws::Message};

#[derive(Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
enum Command {
    Ping,
    Echo { text: String },
}

impl TryFrom<Message> for Command {
    type Error = serde_json::Error;

    fn try_from(msg: Message) -> Result<Self, Self::Error> {
        serde_json::from_slice(&msg.into_inner().into_data())
    }
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // {"type":"ping"}                  -> pong
    // {"type":"echo","text":"hello"}   -> hello
    app.map_msg("/ws", |cmd: Command| match cmd {
        Command::Ping => "pong".to_string(),
        Command::Echo { text } => text,
    });

    // `Message` тоже годится как ответ: это эхо оставляет текстовые кадры текстовыми, а бинарные — бинарными
    app.map_msg("/echo", |msg: Message| msg);

    app.run().await
}
```

::: tip
Кадр, который не преобразуется в тип сообщения обработчика, пропускается, а соединение остаётся открытым; с включённой фичей `tracing` это логируется как ошибка. Если клиент должен узнать, что его сообщение отклонено, принимайте тип, подходящий для любого кадра, — `Message`, `Bytes` — и отвечайте ошибкой сами, либо читайте сокет через `recv()`, который отдаёт ошибку преобразования вам.
:::

Это простые примеры. Чтобы получить больше контроля над конкретным соединением, вы можете воспользоваться другим методом - [`map_ws()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_ws).

```rust compile
use volga::{App, ws::WebSocket};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // Простой обработчик WebSocket
    app.map_ws("/ws", |mut ws: WebSocket| async move {
        // Делаем что-нибудь с соединением

        ws.on_msg(|msg: String| async move {
            // Делаем что-нибудь с сообщением

            format!("Received: {}", msg)
        }).await;
    });
    
    app.run().await
}
```

Данный пример работает аналогично первому, но обеспечивает больший контроль над соединением.

Для продвинутых вариантов использования вы можете разделить WebSocket на отдельные компоненты отправителя и получателя с помощью функции [`split()`](https://docs.rs/volga/latest/volga/ws/websocket/struct.WebSocket.html#method.split):

```rust compile
use volga::{App, ws::{WebSocket, WsEvent}};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // Простой обработчик WebSocket
    app.map_ws("/ws", |ws: WebSocket| async move {
        // Разделяем сокет на отправителя и получателя, которые можно использовать отдельно
        let (mut sender, mut receiver) = ws.split();

        tokio::spawn(async move {
            // `Message: TryFrom<&str>`, so the string goes in as it is
            let _ = sender.send("Hello from WebSockets server!").await;
        });

        tokio::spawn(async move {
            while let Some(Ok(msg)) = receiver.recv::<String>().await {
                match msg {
                    WsEvent::Data(msg) => println!("received: {msg}"),
                    WsEvent::Close(frame) => println!("close: {frame:?}"),
                    _ => (),
                }
            }
        });
    });
    
    app.run().await
}
```

Этот пример отправляет одно сообщение при подключении, а затем, логгирует все входящие сообщения.

Для полного контроля, например, для настройки подключения или указания некоторых подпротоколов есть еще один метод - [`map_conn()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_conn), вы можете использовать его следующим образом:

```rust compile-fragment
use volga::{App, ws::{WebSocketConnection, WebSocket}};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_conn("/ws", handle);

    app.run().await
}

async fn handle(conn: WebSocketConnection) -> HttpResult {
    // Здесь можно настроить соединение и извлечь что-нибудь из DI или метаданных HTTP.
    conn.with_protocols(["foo-ws"]).on(handle_socket)
}

async fn handle_socket(mut ws: WebSocket) {
    ws.on_msg(handle_message).await;
}

async fn handle_message(msg: String) -> String {
    format!("Received: {msg}")
}
```

## Внедрение зависимостей

Вы можете внедрить любую зависимость из контейнера DI, на любом уровне, используя [`Dc<T>`](https://docs.rs/volga/latest/volga/di/dc/struct.Dc.html) стандартным способом, описанным [здесь](/volga-docs/en/advanced-patterns/di.html).

```rust
use volga::{App, ws::{WebSocketConnection, WebSocket}};
use std::sync::{Arc, RwLock};

type Counter = Arc<RwLock<i32>>;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.add_singleton(Counter::default());
    app.map_conn("/ws", handle);

    app.run().await
}

async fn handle(conn: WebSocketConnection, counter: Dc<Counter>) -> HttpResult {
    conn.with_protocols(["foo-ws"]).on(|ws| handle_socket(ws, counter))
}

async fn handle_socket(mut ws: WebSocket, counter: Dc<Counter>) {
    ws.on_msg(move |msg: String| handle_message(msg, counter.clone())).await;
}

async fn handle_message(msg: String, counter: Dc<Counter>) -> String {
    let mut value = counter.write().expect("Failed to lock counter");
    *value += 1;
    format!("Received: {msg}; Message #{value}")
}
```

Полный пример можно найти [здесь](https://github.com/RomanEmreis/volga/blob/main/examples/websockets/src/main.rs).
