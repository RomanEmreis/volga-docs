# Quick start

A basic minimal Web API with Volga.

First of all, let's add all necessary crates in `Cargo.toml`:
```toml
[dependencies]
volga = "0.1.11"
tokio = "1.40.0"
```
Then, in `main.rs`:

```rust
use volga::{App, Results, AsyncEndpointsMapping};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    // Start the server
    let mut server = App::build("localhost:7878").await?;

    // Example of asynchronous GET request handler
    server.map_get("/hello", |request| async {
        Results::text("Hello World!")
    }).await;
    
    server.run().await
}
```
The more general and recommended way to use asynchronous versions all the way but if it's redundant for your project you can use the sync version explicitly:
```rust
use volga::{App, Results, SyncEndpointsMapping};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    // Start the server
    let mut app = App::build("localhost:7878").await?;
    
    // Example of synchronous GET request handler
    app.map_get("/hello", |request| {
        Results::text("Hello World!")
    }).await;
    
    app.run().await
}
```
Let's take a look at the code in detail.
The first line creates an instance of the `App` struct representing our API and bounds it to the specified address.
```rust
let mut app = App::build("localhost:7878").await?;
```
Next, we're mapping a dedicated handler to the specific route, in that case, it's the `GET http://localhost7878/hello`:
```rust
app.map_get("/hello", |request| {
    Results::text("Hello World!")
}).await;
```
It is important to place the mapping before the last line:
```rust
app.run().await
```
That runs the server and starts listening for HTTP requests.

Lastly we can test our API using, for example, the `curl` command:
```bash
> curl -v "http://localhost:7878/hello"
```
That would return something like this:
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