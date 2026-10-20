# Dependency Injection

Volga supports robust dependency injection (DI) with three lifetimes: **Singleton**, **Scoped**, and **Transient**. These lifetimes allow you to manage the lifecycle of your dependencies effectively.

If you're not using the `full` feature set, ensure you enable the `di` feature in your `Cargo.toml`:

```toml
[dependencies]
volga = { version = "...", features = ["di"] }
```

## Dependency Lifetimes

### Singleton
A **Singleton** ensures a single instance of a dependency is created and shared for the entire lifetime of your web application. This instance is thread-safe and reused concurrently across threads.

#### Example: Singleton Dependency

```rust compile
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
        let user = cache.inner.lock().unwrap().get(&id).cloned();
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
`T` must be [`Send`](https://doc.rust-lang.org/std/marker/trait.Send.html) and [`Sync`](https://doc.rust-lang.org/std/marker/trait.Sync.html).
:::

### Scoped
A **Scoped** dependency creates a new instance for each HTTP request. The instance persists for the duration of the request, ensuring isolation between requests.

#### Example: Scoped Dependency

```rust compile
use volga::{App, di::{Container, Dc, Inject, error::Error}, ok, not_found};
use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
};

#[derive(Clone)]
struct InMemoryCache {
    inner: Arc<Mutex<HashMap<String, String>>>,
}

impl Inject for InMemoryCache {
    fn inject(_container: &Container) -> Result<Self, Error> {
        Ok(Self { inner: Default::default() })
    }
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // Register a scoped service
    app.add_scoped::<InMemoryCache>();

    // Inject a request-specific cache instance
    app.map_get("/user/{id}", |id: String, cache: Dc<InMemoryCache>| async move {
        let user = cache.inner.lock().unwrap().get(&id).cloned();
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

#### Registering with `Default` or a Factory

To use the [`add_scoped::<T>()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.add_scoped) method, the type must implement the [`Inject`](https://docs.rs/volga/latest/volga/di/trait.Inject.html) trait. This is a convenient and powerful approach when your type depends on other services registered in the DI container.

However, if the type has **no dependencies**, you can register it more directly using a factory:

```rust
#[derive(Clone)]
struct InMemoryCache {
    inner: Arc<Mutex<HashMap<String, String>>>,
}

// Register a scoped service using a factory
app.add_scoped_factory(|| InMemoryCache {
    inner: Default::default(),
});
```
::: tip
You may use the [`Dc<T>`](https://docs.rs/volga/latest/volga/di/dc/struct.Dc.html) or [`Container`](https://docs.rs/volga/latest/volga/di/struct.Container.html) as a factory arguments for better control on dependency resolution.
:::

If the type implements [`Default`](https://doc.rust-lang.org/std/default/trait.Default.html), you can simplify this further by using [`add_scoped_default::<T>()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.add_scoped_default):

```rust
#[derive(Default, Clone)]
struct InMemoryCache {
    inner: Arc<Mutex<HashMap<String, String>>>,
}

app.add_scoped_default::<InMemoryCache>();
```

### Transient

A **Transient** dependency creates a **new instance every time it is resolved**, regardless of the request scope or context. You can register a transient service using one of:

* [`add_transient::<T>()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.add_transient)
* [`add_transient_factory::<T>()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.add_transient_factory)
* [`add_transient_default::<T>()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.add_transient_default)

The behavior is similar to **Scoped**, with the key difference that **a new instance is created for every injection**, not once per request or scope. A transient resolved through [`Container::resolve`](https://docs.rs/volga/latest/volga/di/struct.Container.html#method.resolve) is moved out of the container rather than cloned, which is worth knowing for a type whose `Clone` or `Drop` has side effects.

## Changing a Dependency

A [`Dc<T>`](https://docs.rs/volga/latest/volga/di/dc/struct.Dc.html) is a handle on an instance the container shares, so it gives `&T` and never `&mut T`. A **singleton** is shared by every request the app serves, and a **scoped** service by everything that resolves it during one request — the handler and its middleware alike. State that handlers change lives inside `T`, behind interior mutability, and `T`'s methods change it through `&self`:

```rust compile
use volga::{App, di::Dc, ok};
use std::{
    collections::HashMap,
    sync::{RwLock, atomic::{AtomicU64, Ordering}},
};

#[derive(Default)]
struct Users {
    names: RwLock<HashMap<String, String>>,
    writes: AtomicU64,
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();
    app.add_singleton(Users::default());

    app.map_put("/user/{id}/{name}", |id: String, name: String, users: Dc<Users>| async move {
        users.names.write().unwrap().insert(id, name);
        users.writes.fetch_add(1, Ordering::Relaxed);
        ok!()
    });

    app.map_get("/user/writes", |users: Dc<Users>| async move {
        ok!(users.writes.load(Ordering::Relaxed))
    });

    app.run().await
}
```

* A [`Mutex`](https://doc.rust-lang.org/std/sync/struct.Mutex.html) or an [`RwLock`](https://doc.rust-lang.org/std/sync/struct.RwLock.html) around the data — an `RwLock` where reads outnumber writes.
* An atomic, such as [`AtomicU64`](https://doc.rust-lang.org/std/sync/atomic/struct.AtomicU64.html), for a counter or a flag.
* A [`tokio::sync::Mutex`](https://docs.rs/tokio/latest/tokio/sync/struct.Mutex.html) only where the guard is held across an `.await`; a `std::sync` guard is dropped before one.

`T` needs no `Arc` of its own around that state, since the container already shares the instance. It does when `T` is `Clone` and is also resolved by value — by [`Container::resolve`](https://docs.rs/volga/latest/volga/di/struct.Container.html#method.resolve), [`Dc::cloned()`](https://docs.rs/volga/latest/volga/di/dc/struct.Dc.html#method.cloned) or into a field of another service — so that every clone reaches the same state. That is why the `Clone` caches above keep an `Arc<Mutex<..>>`.

A handler that wants a copy of its own to change takes `Dc::cloned()`; the registered instance stays as it was. A clone of the `Dc<T>` itself is another handle on the same instance, and is available for every `T`.

::: warning Upgrading from 0.13
Before 0.14.0, `Dc<T>` implemented `DerefMut`, and a write through it — `counter.hits += 1` — changed a private copy: the container holds a handle on every singleton, and on a scoped service until its request ends, so the first write cloned the value. No other request saw it. Such a write no longer compiles:

```text
error[E0594]: cannot assign to data in dereference of `Dc<Counter>`
  = help: trait `DerefMut` is required to modify through a dereference, but it is not implemented for `Dc<Counter>`
```

Move the state behind a `Mutex`, an `RwLock` or an atomic inside the service, or take `Dc::cloned()` where a private copy is what the handler meant.
:::

## The Graph Is Checked at Startup

[`App::run()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.run) checks the dependency graph before it starts anything, and returns an `Err` naming every problem at once rather than the first one:

```text
dependency injection: dependency cycle: myapp::Repo -> myapp::Db -> myapp::Repo; `myapp::Api` depends on `myapp::Clock`, which is not registered
```

Nothing is bound, spawned or announced until that check passes — no background task, no HTTPS redirect listener, no greeter line — so a caller that handles the error and tries again finds the port free, and a service nobody registered is a startup failure rather than a `500` on one route.

What gets checked is what a registration **declares**. A factory declares its arguments, so the container already knows what this resolves:

```rust
// says it resolves `Db`
app.add_scoped_factory(|db: Dc<Db>| Repo { db });
```

A hand-written [`Inject`](https://docs.rs/volga/latest/volga/di/trait.Inject.html) resolves from the container by hand, so it declares what it resolves by hand too:

```rust compile
use volga::di::{Container, Dependencies, Inject, error::Error};

#[derive(Default, Clone)]
struct Clock;

struct Session {
    clock: Clock,
}

impl Inject for Session {
    fn inject(container: &Container) -> Result<Self, Error> {
        Ok(Self { clock: container.resolve::<Clock>()? })
    }

    // Without this, `Session` is left out of the check
    fn dependencies(deps: &mut Dependencies) {
        deps.add::<Clock>();
    }
}
```

[`dependencies()`](https://docs.rs/volga/latest/volga/di/trait.Inject.html#method.dependencies) is a provided method whose default declares nothing, which keeps a type out of the startup check without making it wrong. Declare exactly what `inject` resolves — a dependency declared here but never resolved is checked all the same.

A type that declares nothing is checked when it is constructed instead: a cycle reached while resolving panics naming the path it found, `A -> B -> A`.

The same check runs on [`ContainerBuilder`](https://docs.rs/volga/latest/volga/di/struct.ContainerBuilder.html) directly, for a container built outside an `App`:

```rust compile
use volga::di::ContainerBuilder;

fn main() {
    let mut builder = ContainerBuilder::new();
    builder.register_singleton(42u32);

    assert!(builder.validate().is_ok());

    let container = builder.build();
    let _ = container;
}
```

### What Handlers and Middleware Take

Since **0.14.0** the check covers what handlers and middleware take as well. A route whose handler takes `Dc<T>` of a `T` nobody registered used to start and answer `500` on every request to it. Now `App::run()` does not start, and names the type and everything that takes it:

```text
dependency injection: `myapp::Db` is not registered, and is resolved by `GET /users/{id}`, `with` on group `/api`. Register a service with `add_singleton`, `add_scoped` or `add_transient` (or their `_factory` and `_default` forms), or take `Option<Dc<T>>` where it is optional
```

* **Checked:** route handlers, [`map_ws()`](/volga-docs/en/protocols-realtime/ws.html) and `map_msg()`, `map_err()`, `map_fallback()` of the app and of a group, and `with()`, `filter()`, `map_ok()`, `map_err()` and `tap_req()` of the app, a group or a route. Signed and private cookies count as taking their key.
* **Only what can still run is checked:** a route mapped again, a `map_err()` or a fallback replaced by a later call or by `use_problem_details()`, and group middleware attached to no route are left out.
* **`Option<Dc<T>>` opts out.** It says the service is optional, and is `None` when nothing is registered. `Result<Dc<T>, Error>` does not: it only hands the failure to the handler.
* **Not checked:** services resolved at run time — through `wrap()`, a `Middleware` passed to `attach()`, [`HttpContext::resolve()`](https://docs.rs/volga/latest/volga/middleware/http_context/struct.HttpContext.html#method.resolve) or the `Container` itself. A missing one there still fails the request.

```rust compile
use volga::{App, di::Dc, ok};

struct Metrics;

impl Metrics {
    fn record(&self, _route: &str) {}
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // Starts whether `Metrics` is registered or not
    app.map_get("/", |metrics: Option<Dc<Metrics>>| async move {
        if let Some(metrics) = metrics {
            metrics.record("/");
        }
        ok!()
    });

    app.run().await
}
```

An extractor of your own that resolves from the container takes part the way a service does: [`FromContainer`](https://docs.rs/volga/latest/volga/di/trait.FromContainer.html), [`FromRequestRef`](https://docs.rs/volga/latest/volga/http/endpoints/args/trait.FromRequestRef.html) and [`FromRequestParts`](https://docs.rs/volga/latest/volga/http/endpoints/args/trait.FromRequestParts.html) have a `dependencies()` method that declares what it resolves, and declares nothing by default.

## DI in middleware
If you need to request/inject a dependency in middleware, if you're using method [`with()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.with), you may leverage the [`Dc`](https://docs.rs/volga/latest/volga/di/dc/struct.Dc.html) extractor similarly to request handlers. For the [`wrap()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.wrap) use either [`resolve::<T>()`](https://docs.rs/volga/latest/volga/middleware/http_context/struct.HttpContext.html#method.resolve) or [`resolve_shared::<T>`](https://docs.rs/volga/latest/volga/middleware/http_context/struct.HttpContext.html#method.resolve_shared) methods of [`HttpContext`](https://docs.rs/volga/latest/volga/middleware/http_context/struct.HttpContext.html).
The main difference between them is that the first one requires to implement the [`Clone`](https://doc.rust-lang.org/std/clone/trait.Clone.html) trait for `T` while the latter returns an [`Arc<T>`](https://doc.rust-lang.org/std/sync/struct.Arc.html).
A `Dc<T>` taken by `with()` is part of the [startup check](#what-handlers-and-middleware-take); what `wrap()` resolves at run time is not.
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
