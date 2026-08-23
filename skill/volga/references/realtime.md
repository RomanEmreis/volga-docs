# WebSockets and Server-Sent Events

## WebSockets (feature `ws`)

With `http2` also enabled, volga serves WebSocket-over-HTTP/2 where possible
and falls back to plain WebSockets on HTTP/1. Nothing in the handler code
changes between the two.

Three levels of control, from least to most:

### `map_msg` — message in, message out

```rust
app.map_msg("/ws", |msg: String| async move {
    format!("Received: {msg}")
});
```

### `map_ws` — the socket

```rust
use volga::{App, ws::WebSocket};

app.map_ws("/ws", |mut ws: WebSocket| async move {
    // connection established
    ws.on_msg(|msg: String| async move { format!("Received: {msg}") }).await;
});
```

Split it when send and receive need to run independently:

<!-- snippet: skip -->
```rust
use volga::ws::{WebSocket, WsEvent};

app.map_ws("/ws", |ws: WebSocket| async move {
    let (mut sender, mut receiver) = ws.split();

    tokio::spawn(async move {
        // `Message: TryFrom<&str>` — no `.into()`, which is ambiguous here
        let _ = sender.send("hello from the server").await;
    });

    tokio::spawn(async move {
        while let Some(Ok(event)) = receiver.recv::<String>().await {
            match event {
                WsEvent::Data(msg) => println!("received: {msg}"),
                WsEvent::Close(frame) => println!("closed: {frame:?}"),
            }
        }
    });
});
```

`WsEvent` is `#[non_exhaustive]` — always include a catch-all arm.

### `map_conn` — configure the handshake

```rust
use volga::{HttpResult, ws::{WebSocket, WebSocketConnection}};

app.map_conn("/ws", handle);

async fn handle(conn: WebSocketConnection) -> HttpResult {
    conn.with_protocols(["foo-ws"]).on(handle_socket)
}

async fn handle_socket(mut ws: WebSocket) {
    ws.on_msg(|msg: String| async move { format!("Received: {msg}") }).await;
}
```

`with_accept_unmasked_frames()` and `without_accept_unmasked_frames()` take
no arguments.

### Dependency injection

`Dc<T>` resolves at every layer — the connection handler, the socket
handler and the message handler:

```rust
use volga::{App, HttpResult, di::Dc, ws::{WebSocket, WebSocketConnection}};
use std::sync::{Arc, RwLock};

type Counter = Arc<RwLock<i32>>;

app.add_singleton(Counter::default());
app.map_conn("/ws", handle);

async fn handle(conn: WebSocketConnection, counter: Dc<Counter>) -> HttpResult {
    conn.with_protocols(["foo-ws"]).on(|ws| handle_socket(ws, counter))
}

async fn handle_socket(mut ws: WebSocket, counter: Dc<Counter>) {
    ws.on_msg(move |msg: String| handle_message(msg, counter.clone())).await;
}

async fn handle_message(msg: String, counter: Dc<Counter>) -> String {
    let mut value = counter.write().expect("counter poisoned");
    *value += 1;
    format!("Received: {msg}; message #{value}")
}
```

A `std::sync::RwLock` guard must be dropped before any `.await` in the same
scope, or the future stops being `Send`.

## Server-Sent Events

Built in, no feature flag, works over HTTP/1 and HTTP/2.

```rust
use std::time::Duration;
use volga::{App, http::sse::Message, sse_stream};

app.map_get("/events", || async {
    sse_stream! {
        loop {
            yield Message::new().data("Hello, world!");
            tokio::time::sleep(Duration::from_secs(1)).await;
        }
    }
});
```

`sse_stream!` sets `Content-Type: text/event-stream` and ends the stream
when the client disconnects.

`Message` builds each event:

<!-- snippet: skip -->
```rust
Message::new().data("plain text");
Message::new().json(payload);                // any Serialize (infallible)
Message::new().event("update").id("42").retry(Duration::from_secs(5));
Message::new().comment("keep-alive");
```

For work that should stop when the browser tab closes, combine the stream
with the `CancellationToken` extractor — see `operations.md`.
