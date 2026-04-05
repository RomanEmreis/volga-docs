# Parameterized Middleware

In addition to inline closure-based middleware registered via [`wrap()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.wrap) and [`with()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.with), Volga also supports registering middleware as reusable, configurable types through the [`attach()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.attach) method.

This approach is ideal when your middleware needs its own state, configuration, or is meant to be reused across multiple applications.

## Overview

A parameterized middleware is a regular Rust type (typically a `struct`) that implements the [`Middleware`](https://docs.rs/volga/latest/volga/middleware/handler/trait.Middleware.html) trait. The type holds any configuration or shared state the middleware needs, and its [`call()`](https://docs.rs/volga/latest/volga/middleware/handler/trait.Middleware.html#tymethod.call) method contains the middleware logic.

This is very similar to middleware patterns found in other ecosystems (for example, Tower layers, ASP.NET Core middleware, or Express.js classes).

## The `Middleware` Trait

The trait is defined as follows:
```rust
pub trait Middleware: Send + Sync + 'static {
    fn call(
        &self,
        ctx: HttpContext,
        next: NextFn,
    ) -> impl Future<Output = HttpResult> + Send + 'static;
}
```

Any type implementing this trait can be passed to [`attach()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.attach).

## Example: A `Timeout` Middleware

Here is a small middleware that adds an artificial delay before the request is processed further. Its duration is configurable at registration time:
```rust
use std::time::Duration;
use volga::{App, HttpResult, middleware::{HttpContext, NextFn, Middleware}};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // Register the parameterized middleware
    app.attach(Timeout {
        duration: Duration::from_secs(1),
    });

    app.map_get("/hello", || async { "Hello, World!" });

    app.run().await
}

struct Timeout {
    duration: Duration,
}

impl Middleware for Timeout {
    fn call(&self, ctx: HttpContext, next: NextFn) -> impl Future<Output = HttpResult> + 'static {
        let duration = self.duration;
        async move {
            tokio::time::sleep(duration).await;
            next(ctx).await
        }
    }
}
```

The `Timeout` struct carries its configuration (`duration`) and implements the middleware logic inside `call()`. You can instantiate it multiple times with different durations, or share the same instance across routes.

## .wrap() vs .attach()

Both methods register middleware operating on the full [`HttpContext`](https://docs.rs/volga/latest/volga/middleware/http_context/struct.HttpContext.html), but they target different use cases:

- [`wrap()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.wrap) is optimized for short, inline closures. No type annotations on `ctx` and `next` are required.
- [`attach()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.attach) is intended for reusable, parameterized middleware types — typically `struct`s that implement the [`Middleware`](https://docs.rs/volga/latest/volga/middleware/handler/trait.Middleware.html) trait.

::: tip
Use [`wrap()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.wrap) for quick inline middleware and [`attach()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.attach) when you want to package middleware as a named, configurable type you can reuse.
:::

`attach()` also accepts closures, but type annotations on the arguments are required:
```rust
use volga::{App, middleware::{HttpContext, NextFn}};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.attach(|ctx: HttpContext, next: NextFn| async move {
        next(ctx).await
    });

    app.run().await
}
```

## Registering on Routes and Route Groups

Parameterized middleware can also be attached to individual routes and [route groups](../getting-started/route-groups.md), not just to the entire application:
```rust
use std::time::Duration;
use volga::{App, HttpResult, middleware::{HttpContext, NextFn, Middleware}};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // Attach to a single route
    app
        .map_get("/hello", || async { "Hello, World!" })
        .attach(Timeout { duration: Duration::from_secs(1) });

    // Attach to a route group
    app.group("/api", |api| {
        api.attach(Timeout { duration: Duration::from_secs(2) });
        api.map_get("/ping", || async { "pong" });
    });

    app.run().await
}

struct Timeout {
    duration: Duration,
}

impl Middleware for Timeout {
    fn call(&self, ctx: HttpContext, next: NextFn) -> impl Future<Output = HttpResult> + 'static {
        let duration = self.duration;
        async move {
            tokio::time::sleep(duration).await;
            next(ctx).await
        }
    }
}
```

## When to Prefer Parameterized Middleware

Reach for [`attach()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.attach) and a dedicated type when:

- The middleware needs **configuration** at registration time (timeouts, limits, feature flags, etc.).
- The middleware should be **reusable** across projects or crates.
- The middleware holds **shared state**, counters, or handles to external systems.
- You want to **unit test** the middleware independently of a running application.

For simple, one-off transformations, keeping the logic inline with [`wrap()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.wrap) or [`with()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.with) is typically more concise.

Built-in features such as [CORS](./cors.md), [authentication](../security-access/auth.md) and [rate limiting](./rate-limiting.md) are themselves implemented as parameterized middleware on top of [`attach()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.attach).
