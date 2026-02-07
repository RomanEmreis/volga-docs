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

```rust
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

This is a very simple example, to get more control over a particular connection you may choose another method - [`map_ws()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_ws).

```rust
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

```rust
use volga::{App, ws::WebSocket, WsEvent};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // Simple WebSocket handler
    app.map_ws("/ws", |ws: WebSocket| async move {
        // Split socket into sender and receiver that can be used separately
        let (mut sender, mut receiver) = ws.split();

        tokio::spawn(async move {
            let _ = sender.send("Hello from WebSockets server!".into()).await;
        });
        
        tokio::spawn(async move {
            while let Some(Ok(msg)) = receiver.recv::<String>().await {
                match msg { 
                    WsEvent::Data(msg) => println!("received: {msg}; msg #{value}"),
                    WsEvent::Close(frame) => println!("close: {frame:?}"),
                }
            }
        });
    });
    
    app.run().await
}
```

This example sends a single message upon connection and logs incoming messages.

For full control, for instance, to configure a connection or specify some sub-protocols, there is another method - [`map_conn()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_conn), you may use it like this:

```rust
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

You can inject any dependency from the DI container by using the [`Dc<T>`](https://docs.rs/volga/latest/volga/di/dc/struct.Dc.html) at any layer in a regular way described [here](/volga-docs/advanced-patterns/di.html).

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
