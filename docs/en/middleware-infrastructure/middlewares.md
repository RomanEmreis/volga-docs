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

Routing runs first and decides *what* answers a request. All three of its outcomes — the matched route, the fallback handler, and a `405` carrying its `Allow` header — travel through the same global chain.

Three things follow from that:

* **A short-circuiting global middleware decides unmatched requests too.** `filter`, a `with` that returns early, and `authorize` run before routing's answer is known, so a global authorization middleware answers `401` for a path that does not exist rather than `404` — which leaks less about what the service has. Per-route and per-group middleware are unaffected: those belong to a route that by definition matched.
* **Rate limiting counts requests that match no route.** A limiter's budget is spent by traffic that never reaches a handler, so size it against real traffic rather than against the route count.
* **The per-request scope is built for those requests.** [`ClientIp`](https://docs.rs/volga/latest/volga/struct.ClientIp.html), `CancellationToken`, `Config<T>`, `HostEnv` and `Dc<T>` work inside a fallback handler, and the configured request body limit applies there too.

### Telling the two apart

Middleware that should only do its work for a real endpoint reads [`matched_route()`](https://docs.rs/volga/latest/volga/middleware/struct.HttpContext.html#method.matched_route):

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

## .wrap() vs .with()
As you may have noticed, there are two similar methods for configuring the middleware pipeline. The [`wrap()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.wrap) method offers lower-level access and provides full control over the entire [`HttpRequest`](https://docs.rs/volga/latest/volga/http/request/struct.HttpRequest.html), including the [`HttpBody`](https://docs.rs/volga/latest/volga/http/body/struct.HttpBody.html). This makes it ideal for advanced use cases such as compression, decompression, encoding, or decoding. In contrast, the [`with()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.with) method is designed for convenience and covers around 80% of typical scenarios. It offers flexible access to dependency injection, [`HttpHeaders`](https://docs.rs/volga/latest/volga/headers/header/struct.HttpHeaders.html), and other request metadata, but does not expose the request body.

::: tip
As a general rule, prefer [`with()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.with) unless your use case specifically requires access to the request body.
:::

Here is the [full example](https://github.com/RomanEmreis/volga/blob/main/examples/middleware/src/main.rs).
