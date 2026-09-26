# WebSockets

Volga provides built-in support for WebSockets using a single, flexible API. This allows seamless connection handling at all levels, from establishing a connection to processing individual messages, with the ability to inject dependencies or access HTTP metadata.

## Switching Between WebSockets and WebSocket-over-HTTP/2

If running under HTTP/2, Volga uses WebSocket-over-HTTP/2 by default and falls back to WebSockets when only an HTTP/1 connection is available. This behavior can be configured using feature flags.

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

## Simple Server

After updating `Cargo.toml` with the `ws` feature flag, you can implement a basic message handler using the [`map_msg()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_msg) method. The following example responds with a formatted string containing the received message:

```rust compile
use volga::App;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // Simple string message handler
    app.map_msg("/ws", |msg: String| async move {
        format!("Received: {}", msg)
    });
    
    app.run().await
}
```

A message handler with nothing to await can also return its reply directly, since **v0.11.0**:

```rust compile-fragment
app.map_msg("/ws", |msg: String| format!("echo: {msg}"));
```

### JSON Messages

A message handler can take and return [`Json<T>`](https://docs.rs/volga/latest/volga/struct.Json.html). A `Json<T>` is received from a text or a binary frame, and is sent as a **text** frame — the reply of a `map_msg` handler as well as [`WebSocket::send`](https://docs.rs/volga/latest/volga/ws/websocket/struct.WebSocket.html) and `WsSink::send` — so a browser client reads it from `event.data` as a string and passes it to `JSON.parse`:

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

### Message Types of Your Own

A message is anything implementing `TryFrom<`[`Message`](https://docs.rs/volga/latest/volga/ws/args/struct.Message.html)`>`, and a reply anything implementing `TryInto<Message>`. Since **0.12.0** their conversion error can be any type that converts into volga's `Error` — `serde_json::Error`, a `(StatusCode, E)` pair, a type of your own implementing [`IntoError`](/volga-docs/en/reliability-observability/errors.html#error-types-of-your-own) — rather than `Error` itself. The same holds for `WebSocket::on_msg`, `WebSocket::recv` and `send`, `WsStream::recv` and `WsSink::send`.

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

    // A `Message` is a reply too: this echo keeps text frames text and binary frames binary
    app.map_msg("/echo", |msg: Message| msg);

    app.run().await
}
```

::: tip
A frame that does not convert into the handler's message type is skipped, and the connection stays open; with the `tracing` feature on, it is logged as an error. Where a client has to learn that its message was rejected, take a type that accepts any frame — `Message`, `Bytes` — and reply with the error yourself, or read the socket with `recv()`, which hands the conversion error to you.
:::

These are simple examples; to get more control over a particular connection you may choose another method - [`map_ws()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_ws).

```rust compile
use volga::{App, ws::WebSocket};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // Simple WebSocket handler
    app.map_ws("/ws", |mut ws: WebSocket| async move {
        // Do something when a connection established

        ws.on_msg(|msg: String| async move {
            // Do something with a message

            format!("Received: {}", msg)
        }).await;
    });
    
    app.run().await
}
```

This example functions similarly to the first but offers greater control over the connection.

For advanced use cases, you can split the WebSocket into separate sender and receiver components using [`split()`](https://docs.rs/volga/latest/volga/ws/websocket/struct.WebSocket.html#method.split):

```rust compile
use volga::{App, ws::{WebSocket, WsEvent}};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // Simple WebSocket handler
    app.map_ws("/ws", |ws: WebSocket| async move {
        // Split socket into sender and receiver that can be used separately
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

This example sends a single message upon connection and logs incoming messages.

For full control, for instance, to configure a connection or specify some sub-protocols, there is another method - [`map_conn()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_conn), you may use it like this:

```rust compile-fragment
use volga::{App, ws::{WebSocketConnection, WebSocket}};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_conn("/ws", handle);

    app.run().await
}

async fn handle(conn: WebSocketConnection) -> HttpResult {
    // Here can be configured a connection and extract something from DI or HTTP metadata
    conn.with_protocols(["foo-ws"]).on(handle_socket)
}

async fn handle_socket(mut ws: WebSocket) {
    ws.on_msg(handle_message).await;
}

async fn handle_message(msg: String) -> String {
    format!("Received: {msg}")
}
```

## Dependency Injection

You can inject any dependency from the DI container by using the [`Dc<T>`](https://docs.rs/volga/latest/volga/di/dc/struct.Dc.html) at any layer in a regular way described [here](/volga-docs/en/advanced-patterns/di.html).

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

You can find a complete example [here](https://github.com/RomanEmreis/volga/blob/main/examples/websockets/src/main.rs).
