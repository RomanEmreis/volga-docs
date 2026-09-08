# Custom Handling of HEAD, OPTIONS, and TRACE Methods

Implementing HTTP methods such as `HEAD`, `OPTIONS`, and `TRACE` with the Volga can be streamlined using well-defined steps. This guide presents effective ways to handle these methods in your Volga application.

## HEAD Method
By default, a handler mapped to the `GET` method also answers `HEAD`: routing hands a `HEAD` request that has no route of its own to the `GET` route, and the body is dropped on the way out.

::: warning Changed in 0.10.0
`map_get` used to register a *second* route under `HEAD` carrying the handler and nothing else, so route middleware, group middleware and the route's CORS policy went to the `GET` alone. A route behind a group's `authorize` answered `403` to `GET /admin/report` and `200` to `HEAD /admin/report`, with rate limiting and filters skipped along with it.

There is no second route any more, so a `HEAD` request travels through everything its `GET` route travels through. **A `HEAD`-based health check against a route behind `authorize` is the likeliest thing to notice**: it now answers `401` / `403` where it answered `200`.

[`App::without_implicit_head`](https://docs.rs/volga/latest/volga/app/struct.App.html) is removed with it. There is no second route left to stop registering, and what it turned off was `HEAD` support, which RFC 9110 §9.1 requires of a general-purpose server. A service that wants `HEAD` on some path to fail can map one that says so.
:::

To customize the behavior for the `HEAD` method, explicitly define it using the [`map_head`](https://docs.rs/volga/latest/volga/app/router/trait.Router.html#tymethod.map_head) method. `map_head` still takes precedence and runs its own middleware and none of the `GET` route's:
```rust compile
use volga::{App, ok};

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
        ok!("Hello World!"; [
            ("x-custom-header", "some-value-get")
        ])
    });

    app.run().await
}
```
Here, the `HEAD` method returns headers without a body, often mirroring the headers that a `GET` request would have returned.

::: tip
A `GET` and a `HEAD` mapped for the same path describe one resource, so they must name their route parameters identically — `map_get("/file/{id}", ..)` beside `map_head("/file/{name}", ..)` panics at registration. See [Route Parameters](/volga-docs/en/getting-started/route-params.html#two-cases-that-panic-at-registration).
:::

## OPTIONS Method

For specifically handling `OPTIONS` requests, use the [`map_options`](https://docs.rs/volga/latest/volga/app/router/trait.Router.html#tymethod.map_options) method to map this HTTP method:
```rust compile
use volga::{App, ok};

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

```rust compile
use volga::{App, HttpRequest, stream};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // TRACE /
    app.map_trace("/", |req: HttpRequest| async move {
        let body = req.into_body().into_data_stream();
        stream!(body; [
            ("content-type", "message/http")
        ])
    });

    app.run().await
}
```
This handler captures the incoming request and sends it back in the response with the appropriate content type.

You can check th examples here:
* [HEAD](https://github.com/RomanEmreis/volga/blob/main/examples/head_request/src/main.rs)
* [OPTIONS](https://github.com/RomanEmreis/volga/blob/main/examples/options_request/src/main.rs)
* [TRACE](https://github.com/RomanEmreis/volga/blob/main/examples/trace_request/src/main.rs)
