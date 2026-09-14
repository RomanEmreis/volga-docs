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
