# Dependency Injection

Volga supports robust dependency injection (DI) with three lifetimes: **Singleton**, **Scoped**, and **Transient**. These lifetimes allow you to manage the lifecycle of your dependencies effectively.

If you're not using the `full` feature set, ensure you enable the `di` feature in your `Cargo.toml`:

```toml
[dependencies]
volga = { version = "0.4.5", features = ["di"] }
```

## Dependency Lifetimes

### Singleton
A **Singleton** ensures a single instance of a dependency is created and shared for the entire lifetime of your web application. This instance is thread-safe and reused concurrently across threads.

#### Example: Singleton Dependency

```rust
use volga::{App, di::Dc, ok, not_found};
use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
};

#[derive(Clone, Default)]
struct InMemoryCache {
    inner: Arc<Mutex<HashMap<String, String>>>,
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // Register a singleton service globally
    app.add_singleton(InMemoryCache::default());

    // Inject the shared cache instance into the route handlers
    app.map_get("/user/{id}", |id: String, cache: Dc<InMemoryCache>| async move {
        let user = cache.inner.lock().unwrap().get(&id);
        match user {
            Some(user) => ok!(user),
            None => not_found!("User not found"),
        }
    });

    app.map_post("/user/{id}/{name}", |id: String, name: String, cache: Dc<InMemoryCache>| async move {
        cache.inner.lock().unwrap().insert(id, name);
        ok!()
    });

    app.run().await
}
```

In this example:
- The [`add_singleton`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.add_singleton) method registers an `InMemoryCache` instance as a singleton.
- The [`Dc<T>`](https://docs.rs/volga/latest/volga/di/dc/struct.Dc.html) extractor provides access to the dependency container, resolving the dependency as needed.
- The [`Dc<T>`](https://docs.rs/volga/latest/volga/di/dc/struct.Dc.html) behaves similarly to other Volga extractors, such as [`Json<T>`](https://docs.rs/volga/latest/volga/http/endpoints/args/json/struct.Json.html) or [`Query<T>`](https://docs.rs/volga/latest/volga/http/endpoints/args/query/struct.Query.html).

::: info
`T` must be [`Send`](https://doc.rust-lang.org/std/marker/trait.Send.html), [`Sync`](https://doc.rust-lang.org/std/marker/trait.Sync.html) and either [`Default`](https://doc.rust-lang.org/std/default/trait.Default.html) or [`Singleton`](https://docs.rs/volga/latest/volga/di/derive.Singleton.html) if it doesn't depend on anything or if we're using an already created instance.
:::

### Scoped
A **Scoped** dependency creates a new instance for each HTTP request. The instance persists for the duration of the request, ensuring isolation between requests.

#### Example: Scoped Dependency

```rust
use volga::{App, di::Dc, ok, not_found};
use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
};

#[derive(Clone, Default)]
struct InMemoryCache {
    inner: Arc<Mutex<HashMap<String, String>>>,
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // Register a scoped service
    app.add_scoped::<InMemoryCache>();

    // Inject a request-specific cache instance
    app.map_get("/user/{id}", |id: String, cache: Dc<InMemoryCache>| async move {
        let user = cache.inner.lock().unwrap().get(&id);
        match user {
            Some(user) => ok!(user),
            None => not_found!("User not found"),
        }
    });

    app.map_post("/user/{id}/{name}", |id: String, name: String, cache: Dc<InMemoryCache>| async move {
        cache.inner.lock().unwrap().insert(id, name);
        ok!()
    });

    app.run().await
}
```

Key differences from Singleton:
- The [`add_scoped::<T>()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.add_scoped) method registers a dependency that is instantiated lazily for each request.
- Each request gets its own, unique instance of `InMemoryCache`.

### Transient
A **Transient** dependency creates a new instance whenever requested, regardless of the request or context. You can register a transient service using the [`add_transient::<T>()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.add_transient) method. The behavior is similar to Scoped, but a new instance is created on every injection request.

::: tip
By implementing [`Default`](https://doc.rust-lang.org/std/default/trait.Default.html) manually, you can control the instantiation behavior for **Scoped** and **Transient** services. For the more advanced scenarios, especially when you need to construct your service by injecting other dependencies you need to use the [`Inject`](https://docs.rs/volga/latest/volga/di/inject/trait.Inject.html) trait.
:::

## DI in middleware
If you need to request/inject a dependency in middleware, if you're using method [`with()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.with), you may leverage the [`Dc`](https://docs.rs/volga/latest/volga/di/dc/struct.Dc.html) extractor similarly to request handlers. For the [`wrap()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.wrap) use either [`resolve::<T>()`](https://docs.rs/volga/latest/volga/middleware/http_context/struct.HttpContext.html#method.resolve) or [`resolve_shared::<T>`](https://docs.rs/volga/latest/volga/middleware/http_context/struct.HttpContext.html#method.resolve_shared) methods of [`HttpContext`](https://docs.rs/volga/latest/volga/middleware/http_context/struct.HttpContext.html).
The main difference between them is that the first one requires to implement the [`Clone`](https://doc.rust-lang.org/std/clone/trait.Clone.html) trait for `T` while the latter returns an [`Arc<T>`](https://doc.rust-lang.org/std/sync/struct.Arc.html).
```rust
// using .wrap()
app.wrap(|ctx: HttpContext, next: NextFn| async move {
    let cache = ctx.resolve::<InMemoryCache>()?;
    // do something....
    next(ctx).await
});

// using .with()
app.with(|cache: Dc<InMemoryCache>, next: Next| async move {
    // do something....
    next.await
});
```

## Summary
- **Singleton**: Shared instance across the entire application lifecycle.
- **Scoped**: New instance for each HTTP request.
- **Transient**: New instance for every injection request.

For more advanced examples, check out the [this](https://github.com/RomanEmreis/volga/blob/main/examples/dependency_injection/src/main.rs).
