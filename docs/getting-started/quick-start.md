# Quick Start

Build a basic Web API using Volga.

## Prerequisites

Ensure you have the following dependencies in your `Cargo.toml`:

```toml
[dependencies]
volga = "0.3.2"
tokio = "1.41.1"
```
## Setup
Create your main application in `main.rs`:

```rust
use volga::{App, Results, AsyncEndpointsMapping};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    // Start the server
    let mut app = App::build("localhost:7878").await?;

    // Example of asynchronous GET request handler
    app.map_get("/hello", |request| async {
        Results::text("Hello World!")
    });
    
    app.run().await
}
```
## Using Synchronous Handlers
The more general and recommended way to use asynchronous versions all the way, however, if it's redundant for your project you can use the sync version explicitly.

Enable the `sync` feature first:
```toml
[dependencies]
volga = { version = "0.3.1", features = ["default", "sync"] }
```
Then adjust `main.rs` as follows:
```rust
use volga::{App, Results, SyncEndpointsMapping};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    // Start the server
    let mut app = App::build("localhost:7878").await?;
    
    // Example of synchronous GET request handler
    app.map_get("/hello", |request| {
        Results::text("Hello World!")
    });
    
    app.run().await
}
```
## Detailed Walkthrough
When the `App` struct is instantiated, it represents your API and binds to the specified address:
```rust
let mut app = App::build("localhost:7878").await?;
```
Next, map a specific handler to a route. For instance, mapping our handler to `GET http://localhost:7878/hello`:
```rust
app.map_get("/hello", |request| {
    Results::text("Hello World!")
});
```
Or just use the `ok!` macro for a simplified text response:
```rust
app.map_get("/hello", |request| {
    ok!("Hello World!")
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
Hello World!
```
You can also check out the full example [here](https://github.com/RomanEmreis/volga/blob/main/examples/hello_world.rs)