# Tracing & Logging

Volga's tracing and logging features are based on and support the [tracing framework](https://docs.rs/tracing/latest/tracing/index.html) to collect structured, event-based diagnostic information out of the box. 
In addition to that, you can configure the including of the span/request/correction id into response headers to improve your app's observability.

If you're not using the `full` feature set, ensure you enable the `tracing` feature in your `Cargo.toml`, additonally you need to install the [`tracing`](https://crates.io/crates/tracing) and [`tracing-subscriber`](https://crates.io/crates/tracing-subscriber) crates:

```toml
[dependencies]
volga = { version = "...", features = ["tracing"] }
tracing = "0.1"
tracing-subscriber = "0.3"
```

## Basic configuration
```rust
use volga::{App, tracing::TracingConfig};
use tracing::trace;
use tracing_subscriber::prelude::*;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    // Configuring tracing output to the stdout
    tracing_subscriber::registry()
        .with(tracing_subscriber::fmt::layer())
        .init();
    
    let mut app = App::new();

    app.map_get("/tracing", || async {
        trace!("handling the request!");
        "Done!"
    });

    app.run().await
}
```
The above code enables basic tracing configuration with output to stdout. After you run this code, in your terminal you should see the following:
```bash
2025-01-23T13:09:30.616257Z  INFO volga::app: listening on: http://127.0.0.1:7878
```
Then, if you'll hit the `GET http://127.0.0.1:7878/tracing` endpoint multiple times, and then turn off the server you should see something like this in your terminal:
```bash
2025-01-23T13:09:30.616257Z  INFO volga::app: listening on: http://127.0.0.1:7878
2025-01-23T13:09:37.633319Z TRACE request: tracing: handling the request!
2025-01-23T13:09:38.405932Z TRACE request: tracing: handling the request!
2025-01-23T13:09:39.084540Z TRACE request: tracing: handling the request!
2025-01-23T13:09:49.117861Z TRACE volga::app: shutdown signal received, not accepting new requests
2025-01-23T13:09:49.119618Z  INFO volga::app: shutting down the server...
```

## Enabling tracing middleware
With the above example, however, if you check the response headers, you won't find anything related to span id, etc.
To include it you may want to leverage the [`with_tracing()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.with_tracing) or [`set_tracing`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.set_tracing) methods that enable the low-level middleware that adds this header.
```rust
use volga::{App, tracing::TracingConfig};
use tracing::trace;
use tracing_subscriber::prelude::*;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    // Configuring tracing output to the stdout
    tracing_subscriber::registry()
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Configure tracing parameters
    let tracing = TracingConfig::new()
        .with_header();
    
    let mut app = App::new()
        .set_tracing(tracing);

    app.map_get("/tracing", || async {
        trace!("handling the request!");
        "Done!"
    });

    app.run().await
}
```
By default it adds the `request-id` HTTP response header, if you want to use your own header you can configure it with the [`with_header_name()`](https://docs.rs/volga/latest/volga/tracing/struct.TracingConfig.html#method.with_header_name) method from [`TracingConfig`](https://docs.rs/volga/latest/volga/tracing/struct.TracingConfig.html):
```rust
let tracing = TracingConfig::new()
    .with_header()
    .with_header_name("x-correlation-id");
```
Then you can test in with the `curl` command:
```bash
> curl -v --location "http://127.0.0.1:7878/tracing"
```
```bash
*   Trying 127.0.0.1:7878...
* Connected to 127.0.0.1 (127.0.0.1) port 7878
> GET /tracing HTTP/1.1
> Host: 127.0.0.1:7878
> User-Agent: curl/8.9.1
> Accept: */*
>
* Request completely sent off
< HTTP/1.1 200 OK
< server: Volga
< content-type: text/plain
< x-correlation-id: 2252074691592193
< content-length: 5
< date: Fri, 10 Jan 2025 14:14:37 GMT
<
Done!
```

Full example you can find [here](https://github.com/RomanEmreis/volga/blob/main/examples/tracing_example/src/main.rs)