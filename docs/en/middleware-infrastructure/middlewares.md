# Custom Middleware

Volga framework features a flexible middleware pipeline that allows you to process and modify HTTP requests and responses sequentially through middleware functions before reaching the final request handler.

## Overview of Middleware Behavior

Each middleware function in the pipeline must explicitly call a [`next`](https://docs.rs/volga/latest/volga/middleware/type.NextFn.html) closure to pass control to the next middleware or the request handler. Failing to invoke [`next`](https://docs.rs/volga/latest/volga/middleware/type.NextFn.html) results in shortcutting the rest of the pipeline, which can be useful for handling specific conditions before reaching further processing stages.

Having the ability to call the [`next`](https://docs.rs/volga/latest/volga/middleware/type.NextFn.html) closure gives you extensive control over the execution flow, enabling you to run code before or after subsequent middleware functions or the request handler.

## Configuring Middleware
First of all, if you're not using the `full` features, you need to enable the `middleware` feature in your `Cargo.toml`
```toml
[dependencies]
volga = { version = "...", features = ["middleware"] }
```

### Example: Sequential Middleware Execution

Here’s a practical example of how to configure sequential middleware in Volga:
```rust compile
use volga::{App, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    // Configure the server
    let mut app = App::new();

    // Middleware 1
    app.wrap(|context, next| async move {
        // Something can be done before the middleware 2
        println!("Before Middleware 2");

        let response = next(context).await;

        // Something can be done after the middleware 2 is completed
        println!("After Middleware 2");

        response
    });

    // Middleware 2
    app.with(|next| async move {
        // Something can be done before the request handler
        println!("Before Request Handler");

        let response = next.await;

        // Something can be done after the request handler is completed
        println!("After Request Handler");

        response
    });
    
    // Example of request handler
    app.map_get("/hello", || async {
        ok!("Hello World!")
    });
    
    // Run the server
    app.run().await
}
```
### Example: Middleware Short-Cutting Pipeline
The following example demonstrates how to shortcut the middleware pipeline to prevent the request handler from being executed. This approach can be particularly useful for implementing authorization filters or pre-request validations that may terminate the request early:
```rust compile
use volga::{App, ok, status};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    // Configure the server
    let mut app = App::new();

    // Middleware 1
    app.wrap(|context, next| async move {
        // Something can be done before the middleware 2
        println!("Processed by Middleware 1");

        let response = next(context).await;

        // Something can be done after the middleware 2 is completed
        println!("Back in Middleware 1");

        response
    });

    // Middleware 2
    app.with(|_| async {
        // Directly returns without calling 'next', shortcutting the pipeline
        status!(400)
    });
    
    // Example of asynchronous request handler
    app.map_get("/hello", || async {
        // This will never executed
        ok!()
    });
    
    // Run the server
    app.run().await
}
```

## Requests That Match No Route

::: warning Changed in 0.10.0
Global middleware used to be entered from a single arm of the dispatcher, so a request that matched no route — and one that matched a path but not a method — skipped the pipeline entirely. `wrap`, `with`, `filter` and `map_ok` never ran, CORS headers were not emitted, compression and tracing were absent, and **rate limiting did not apply at all**: a global `use_token_bucket(by::ip())` was bypassed completely by asking for a path that does not exist, which is what a scanner or a naive flood does by default.

Routing still runs first and still decides *what* answers a request. What changed is that all three of its outcomes — the matched route, the fallback handler, and a `405` carrying its `Allow` header — now travel through the same global chain.
:::

Three consequences are worth planning for:

* **A short-circuiting global middleware now decides unmatched requests too.** `filter`, a `with` that returns early, and `authorize` run before routing's answer is known, so a global authorization middleware answers `401` where the router alone used to answer `404`. That leaks less about which paths exist, but it is a change in what a client sees. Per-route and per-group middleware are unaffected — those belong to a route that by definition matched.
* **Rate limiting counts requests that match no route.** This is the point of the change: a limiter's budget is now spent by traffic that previously did not touch it, so a service sized against its own routes may see clients hit the limit sooner than before.
* **The per-request scope is built for those requests.** [`ClientIp`](https://docs.rs/volga/latest/volga/struct.ClientIp.html), `CancellationToken`, `Config<T>`, `HostEnv` and `Dc<T>` now work inside a fallback handler instead of failing it with a `500`, and the configured request body limit applies there too.

### Telling the two apart

Middleware that should only do its work for a real endpoint reads [`matched_route()`](https://docs.rs/volga/latest/volga/middleware/struct.HttpContext.html#method.matched_route), added in 0.10.0:

```rust compile
use volga::App;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.wrap(|ctx, next| async move {
        if !ctx.matched_route() {
            // nothing to meter for a request no route will answer
            return next(ctx).await;
        }

        next(ctx).await
    });

    app.run().await
}
```

It answers `true` when routing matched an endpoint for this request, and `false` for the requests answered by the fallback or by a `405`. It answers the same at every layer: a route's or a group's own middleware runs after the route pipeline has been taken and still sees `true`. The CORS middleware is the first caller — it gates the preflight short-circuit on it.

::: tip Faster in 0.10.1, with nothing to change
The chain no longer allocates for stages that only pass the request on, and a handler with no captured state no longer touches a reference count. Routing, chain and handler, measured in-process: no middleware 274 ns → 215 ns, one global middleware 368 ns → 257 ns. The CORS middleware clones the applicable policy once per request instead of twice.
:::

## .wrap() vs .with()
As you may have noticed, there are two similar methods for configuring the middleware pipeline. The [`wrap()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.wrap) method offers lower-level access and provides full control over the entire [`HttpRequest`](https://docs.rs/volga/latest/volga/http/request/struct.HttpRequest.html), including the [`HttpBody`](https://docs.rs/volga/latest/volga/http/body/struct.HttpBody.html). This makes it ideal for advanced use cases such as compression, decompression, encoding, or decoding. In contrast, the [`with()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.with) method is designed for convenience and covers around 80% of typical scenarios. It offers flexible access to dependency injection, [`HttpHeaders`](https://docs.rs/volga/latest/volga/headers/header/struct.HttpHeaders.html), and other request metadata, but does not expose the request body.

::: tip
As a general rule, prefer [`with()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.with) unless your use case specifically requires access to the request body.
:::

Here is the [full example](https://github.com/RomanEmreis/volga/blob/main/examples/middleware/src/main.rs).
