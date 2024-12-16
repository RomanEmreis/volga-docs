# Custom Handling of HEAD, OPTIONS, and TRACE Methods

Implementing HTTP methods such as `HEAD`, `OPTIONS`, and `TRACE` with the Volga can be streamlined using well-defined steps. This guide presents effective ways to handle these methods in your Volga application.

## HEAD Method
By default, when you map a handler to the `GET` method, Volga also maps it to the `HEAD` method. 
The `HEAD` method will return the headers without the body.

To customize the behavior for the `HEAD` method, explicitly define it using the [`map_head`](https://docs.rs/volga/latest/volga/app/router/trait.Router.html#tymethod.map_head) method provided by the [`Router`](https://docs.rs/volga/latest/volga/app/router/trait.Router.html) trait:
```rust
use volga::{App, Router, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // HEAD /resource
    app.map_head("/resource", || async {
        ok!([
            ("x-custom-header", "some-value-get")
        ])
    });

    // GET /resource
    app.map_get("/resource", || async {
        ok!("Hello World!", [
            ("x-custom-header", "some-value-get")
        ])
    });

    app.run().await
}
```
Here, the `HEAD` method returns headers without a body, often mirroring the headers that a `GET` request would have returned.

## OPTIONS Method

For specifically handling `OPTIONS` requests, use the [`map_options`](https://docs.rs/volga/latest/volga/app/router/trait.Router.html#tymethod.map_options) method to map this HTTP method:
```rust
use volga::{App, Router, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // OPTIONS /resource
    app.map_options("/resource", || async {
        ok!([
            ("Allow", "GET, OPTIONS")
        ])
    });

    // GET /resource
    app.map_get("/resource", || async {
        ok!("Hello World!")
    });

    app.run().await
}
```
The example above includes the `Allow` header to indicate supported HTTP methods for the resource. The response body is optional, based on the specific needs of your API.

## TRACE Method

The `TRACE` method is useful for debugging, as it enables tracing the request path to the server and returns the request message for diagnostic purposes:

```rust
use volga::{App, Router, HttpRequest, stream};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // TRACE /
    app.map_trace("/", |req: HttpRequest| async move {
        let boxed_body = req.into_boxed_body();
        stream!(boxed_body, [
            ("content-type", "message/http")
        ])
    });

    app.run().await
}
```
This handler captures the incoming request and sends it back in the response with the appropriate content type.

You can check th examples here:
* [HEAD](https://github.com/RomanEmreis/volga/blob/main/examples/head_request.rs)
* [OPTIONS](https://github.com/RomanEmreis/volga/blob/main/examples/options_request.rs)
* [TRACE](https://github.com/RomanEmreis/volga/blob/main/examples/trace_request.rs)
