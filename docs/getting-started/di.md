# Dependency Injection

Volga provides robust **Dependency Injection (DI)** support with flexible lifetimes. You can register your dependencies as **Singleton**, **Scoped**, or **Transient**, depending on your application's needs.

If you're not using the `full` features of Volga, ensure the `di` feature is enabled in your `Cargo.toml` file:

```toml
[dependencies]
volga = { version = "0.4.4", features = ["di"] }
```

## **Singleton**

A **Singleton** ensures that an instance of a dependency persists throughout the entire lifecycle of the application. This instance is shared across threads and used concurrently.

### Example: In-Memory Cache

```rust
use volga::{App, di::Dc, ok, not_found};
use std::{
    collections::HashMap,
    sync::{Arc, Mutex}
};

#[derive(Clone, Default)]
struct InMemoryCache {
    inner: Arc<Mutex<HashMap<String, String>>>
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // Register a globally available singleton service
    app.register_singleton(InMemoryCache::default());

    // Inject the cache instance into the handler
    app.map_get("/user/{id}", |id: String, cache: Dc<InMemoryCache>| async move {
        let user = cache.inner.lock().unwrap().get(&id);
        match user { 
            Some(user) => ok!(user),
            None => not_found!("User not found")
        }
    });

    app.map_post("/user/{id}/{name}", |id: String, name: String, cache: Dc<InMemoryCache>| async move {
        cache.inner
            .lock()
            .unwrap()
            .insert(id, name);
        ok!()
    });

    app.run().await
}
```

- **Registration:** Use `register_singleton()` to register a Singleton service.
- **Injection:** Handlers receive the dependency via `Dc<T>` (Dependency Container), which resolves the dependency. It functions like [`Json<T>`](https://docs.rs/volga/latest/volga/app/endpoints/args/json/struct.Json.html) or [`Query<T>`](https://docs.rs/volga/latest/volga/app/endpoints/args/query/struct.Query.html), but resolves services instead of HTTP request data.
- **Requirements:** The service type `T` must implement [`Clone`](https://doc.rust-lang.org/std/clone/trait.Clone.html), [`Default`](https://doc.rust-lang.org/std/default/trait.Default.html), [`Send`](https://doc.rust-lang.org/std/marker/trait.Send.html), and [`Sync`](https://doc.rust-lang.org/std/marker/trait.Sync.html). You can simplify this by using the `Inject` trait alias (`use volga::di::Inject`).

Since this is a Singleton, data stored in the cache persists across requests, allowing shared state.

## **Scoped**

A **Scoped** service creates an instance of the dependency that lasts for the duration of an HTTP request. 

### Example: Per-Request Cache

```rust
use volga::{App, di::Dc, ok, not_found};
use std::{
    collections::HashMap,
    sync::{Arc, Mutex}
};

#[derive(Clone, Default)]
struct InMemoryCache {
    inner: Arc<Mutex<HashMap<String, String>>>
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // Register a scoped service (created per request)
    app.register_scoped::<InMemoryCache>();

    app.map_get("/user/{id}", |id: String, cache: Dc<InMemoryCache>| async move {
        let user = cache.inner.lock().unwrap().get(&id);
        match user { 
            Some(user) => ok!(user),
            None => not_found!("User not found")
        }
    });

    app.map_post("/user/{id}/{name}", |id: String, name: String, cache: Dc<InMemoryCache>| async move {
        cache.inner
            .lock()
            .unwrap()
            .insert(id, name);
        ok!()
    });

    app.run().await
}
```

- **Registration:** Use `register_scoped::<T>()` to define a scoped service. It creates the instance lazily on the first request, using the type’s [`Default`](https://doc.rust-lang.org/std/default/trait.Default.html) implementation.
- **Lifetime:** Each HTTP request receives a fresh instance of the service, isolated from other requests. 

This behavior is ideal for services that need unique state per request, such as temporary computations.

## **Transient**

A **Transient** service creates a new instance every time it is requested. This provides the most granular control over object lifetimes.

### Registration

```rust
app.register_transient::<InMemoryCache>();
```

Whenever the `Dc<InMemoryCache>` is injected into a handler, a new instance is created using its `Default` implementation.

::: tip
- **Manual Control:** Implementing custom [`Clone`](https://doc.rust-lang.org/std/clone/trait.Clone.html) and [`Default`](https://doc.rust-lang.org/std/default/trait.Default.html) behaviors gives you fine-grained control over service instantiation.
- **Choosing Lifetime:** Use:
  - **Singleton** for shared resources or global states.
  - **Scoped** for per-request services with request-bound state.
  - **Transient** for stateless or short-lived dependencies.
:::

### More Examples

For advanced scenarios, check out [this example](https://github.com/RomanEmreis/volga/blob/main/examples/dependency_injection.rs).
