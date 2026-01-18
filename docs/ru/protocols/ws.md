# WebSockets & WebTransport

Волга обеспечивает встроенную поддержку как WebSockets, так и WebTransport с использованием единого гибкого API. Это позволяет осуществлять бесшовную обработку соединений на всех уровнях, от установления соединения до обработки отдельных сообщений, с возможностью внедрения зависимостей или доступа к метаданным HTTP.

## Переключение между WebSockets и WebTransport

При работе под HTTP/2, Волга использует WebTransport по-умолчанию и переключается на WebSockets, когда доступен только HTTP/1. Это поведение, так же, можно настроить с помощью флагов.

### WebSockets
```toml
[dependencies]
volga = { version = "...", features = ["ws"] }
```

### WebTransport
```toml
[dependencies]
volga = { version = "...", features = ["http2", "ws"] }
```

## Простой сервер

После обновления `Cargo.toml` с флагом `ws` вы можете реализовать базовый обработчик сообщений с помощью метода [`map_msg()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_msg). Следующий пример отвечает отформатированной строкой, содержащей полученное сообщение:

```rust
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

Это очень простой пример. Чтобы получить больше контроля над конкретным соединением, вы можете воспользоваться другим методом - [`map_ws()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_ws).

```rust
use volga::{App, ws::WebSocket};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // Простой обработчик WebSocket/WebTransport
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

```rust
use volga::{App, ws::WebSocket};
use futures_util::{SinkExt, StreamExt};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // Простой обработчик WebSocket/WebTransport
    app.map_ws("/ws", |ws: WebSocket| async move {
        // Разделяем сокет на отправителя и получателя, которые можно использовать отдельно
        let (mut sender, mut receiver) = ws.split();

        tokio::spawn(async move {
            let _ = sender.send("Hello from WebSockets server!".into()).await;
        });
        
        tokio::spawn(async move {
            while let Some(Ok(msg)) = receiver.next().await {
                println!("Received: {}", msg);
            }
        });
    });
    
    app.run().await
}
```

Этот пример отправляет одно сообщение при подключении, а затем, логгирует все входящие сообщения.

Для полного контроля, например, для настройки подключения или указания некоторых подпротоколов есть еще один метод - [`map_conn()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_conn), вы можете использовать его следующим образом:

```rust
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

Вы можете внедрить любую зависимость из контейнера DI, на любом уровне, используя [`Dc<T>`](https://docs.rs/volga/latest/volga/di/dc/struct.Dc.html) стандартным способом, описанным [здесь](/volga-docs/advanced/di.html).

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
