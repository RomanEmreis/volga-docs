# Server-Sent Events (SSE)

Volga includes built-in support for [Server-Sent Events (SSE)](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events), allowing you to implement real-time, one-way communication from the server to the client in your web applications. This feature is available by default and is compatible with both HTTP/1 and HTTP/2 protocols.

## Basic Usage

The example below demonstrates how to create a simple SSE endpoint. It maps a `GET` request to `/events`, sets the `text/event-stream` content type, and continuously sends the message `"Hello, world!"` once per second until the client disconnects:

```rust
use volga::{App, http::sse::Message, sse_stream};
use std::time::Duration;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/events", || async {
        // Create a stream of messages sent every second
        sse_stream! {
            loop {
                yield Message::new().data("Hello, world!");
            
                tokio::time::sleep(Duration::from_secs(1)).await;
            }
        }
    });

    app.run().await
}
```

## Customizing Messages

Volga provides the [`Message`](https://docs.rs/volga/latest/volga/http/endpoints/args/sse/struct.Message.html) struct to help you build and customize SSE messages.

For simple text messages, use the [`data()`](https://docs.rs/volga/latest/volga/http/endpoints/args/sse/struct.Message.html#method.data) method as shown above. If you need to send structured data, such as JSON, use the [`json()`](https://docs.rs/volga/latest/volga/http/endpoints/args/sse/struct.Message.html#method.json) method, which accepts any type that implements the [`serde::Serialize`](https://docs.rs/serde/1.0.219/serde/ser/trait.Serialize.html) trait:

```rust
use volga::http::sse::Message;
use serde::Serialize;

#[derive(Serialize)]
struct SseData {
    data: String,
}

let payload = SseData { data: "Hello, world!".into() };
Message::new().json(payload);
```

In addition to setting the message data, the `Message` builder also supports customization of the event name, ID, comments, and client reconnection retry interval. For details on the SSE message format, refer to [MDN's guide](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events#event_stream_format).


You may also find a full example [here](https://github.com/RomanEmreis/volga/blob/main/examples/sse/src/main.rs).
