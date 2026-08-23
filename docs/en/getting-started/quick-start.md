# Quick Start

Build a basic "Hello, World" HTTP API using Volga.

## Prerequisites

### Install Rust
If you haven't installed Rust yet, it is recommended to use the `rustup`. [Here](https://doc.rust-lang.org/book/ch01-01-installation.html) is the official guide where you can find how to do it.

Volga currently has a minimum supported Rust version (MSRV) of 1.90. Running `rustup update` will ensure you have the latest Rust version available.

### Create an app
Create a new binary-based app:
```bash
cargo new hello-world
cd hello-world
```

Add the following dependencies in your `Cargo.toml`:

```toml
[dependencies]
volga = { version = "..." }
tokio = { version = "...", features = ["full"] }
```
## Setup
Create your main application in `main.rs`:

```rust compile
use volga::{App, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    // Configure the server
    let mut app = App::new();

    // Example of a simple GET request handler
    app.map_get("/hello", || async {
        ok!("Hello, World!")
    });
    
    // Run the server
    app.run().await
}
```
## Detailed Walkthrough
When the [`App`](https://docs.rs/volga/latest/volga/app/struct.App.html) struct is instantiated, it represents your API. Unless [`bind()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.bind) says otherwise it listens on port `7878` on **every interface** (`0.0.0.0:7878`), and on `127.0.0.1:7878` on Windows:
```rust compile-fragment
let mut app = App::new();
```
Or if you need to bind it to another socket, you can use the [`bind()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.bind) method like this:
```rust compile-fragment
// Binds the server to http://localhost:5000
let mut app = App::new().bind("localhost:5000");
```
Since **v0.9.7**, [`bind()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.bind) accepts the full address grammar of [`tokio::net::TcpListener::bind`](https://docs.rs/tokio/latest/tokio/net/struct.TcpListener.html#method.bind):
```rust compile-fragment
let app = App::new().bind("127.0.0.1:7878");      // IPv4 literal
let app = App::new().bind("[::1]:7878");          // IPv6 literal
let app = App::new().bind("::1:7878");            // unbracketed IPv6 literal
let app = App::new().bind("[fe80::1%eth0]:7878"); // zone-scoped IPv6 literal
let app = App::new().bind("localhost:7878");      // host name
let app = App::new().bind(([127, 0, 0, 1], 7878)); // anything that converts into a SocketAddr
```
Host names are resolved when the server starts — asynchronously, so the runtime is never blocked. If a name resolves to several addresses, they are tried in resolution order and the first one that can be bound wins.

:::warning
Before **v0.9.7**, an address that could not be parsed as a `SocketAddr` was silently replaced with `0.0.0.0:7878` on non-Windows targets. That included `localhost:3000` and `::1:3000` — so a server meant to stay on loopback listened on *every* interface with no error and no log line.

An unusable address is now reported instead: [`run()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.run) returns an `io::Error`, and [`run_blocking()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.run_blocking) logs it and starts no server. If you rely on a loopback bind for security, upgrade.
:::
Next, map a specific handler to a route. For instance, mapping our handler to `GET /hello`:
```rust
app.map_get("/hello", || {
    ok!("Hello, World!")
});
```
Ensure routes are mapped before you start the server with:
```rust
app.run().await
```
## Testing the API

You can test your API using the `curl` command:
```bash
> curl -v "http://localhost:7878/hello"
```
Response expected:
```bash
* Host localhost:7878 was resolved.
* IPv6: ::1
* IPv4: 127.0.0.1
*   Trying [::1]:7878...
* Connected to localhost (::1) port 7878
> GET /hello HTTP/1.1
> Host: localhost:7878
> User-Agent: curl/8.9.1
> Accept: */*
>
* Request completely sent off
< HTTP/1.1 200 OK
< date: Sun, 6 Oct 2024 08:22:17 +0000
< server: Volga
< content-length: 12
< content-type: text/plain
<
* Connection #0 to host localhost left intact
Hello, World!
```

### Blocking Example
Volga also supports building an HTTP API without explicitly depending on `tokio`, using the [`run_blocking()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.run_blocking) method.

This allows you to simplify your `Cargo.toml` dependencies:

```toml
[dependencies]
volga = { version = "..." }
```

Your `main.rs` might then look like this:

```rust compile
use volga::{App, ok};

fn main() {
    // Create the application
    let mut app = App::new();

    // Define a simple GET handler
    app.map_get("/hello", || async {
        ok!("Hello, World!")
    });

    // Run the server in blocking mode
    app.run_blocking()
}
```

Although the `main` function appears synchronous, the server still runs asynchronously under the hood using the `tokio` runtime.

:::info
The [`run_blocking()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.run_blocking) approach is suitable for quick prototyping, simple tools, or learning scenarios where you want to avoid dealing with async setup.
However, using `#[tokio::main]` is generally recommended for **production** applications, as it gives you full control over the async runtime, allows more advanced configuration, and better supports integration with other async libraries and services.
:::

You can also check out the full example [here](https://github.com/RomanEmreis/volga/blob/main/examples/hello_world/src/main.rs)
