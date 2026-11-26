# Dependency Injection

A handler that needs a database pool, a cache or a client takes it as an argument, `Dc<T>`, and Volga hands it over from a container. Services are registered on the `App` with one of three lifetimes, the same ones ASP.NET Core uses: **singleton**, **scoped** and **transient**. If you come from Go, this replaces passing shared state through closures or a context.

If you're not using the `full` feature set, enable the `di` feature in your `Cargo.toml`:

```toml
[dependencies]
volga = { version = "0.15", features = ["di"] }
```

## Lifetimes at a Glance

| Lifetime | Instance | Register with |
|---|---|---|
| Singleton | one for the whole application | `add_singleton(value)` |
| Scoped | one per request, shared by the handler and its middleware | `add_scoped_factory(f)`, `add_scoped_default::<T>()`, `add_scoped::<T>()` |
| Transient | a new one every time it is resolved | `add_transient_factory(f)`, `add_transient_default::<T>()`, `add_transient::<T>()` |

`T` must be [`Send`](https://doc.rust-lang.org/std/marker/trait.Send.html) and [`Sync`](https://doc.rust-lang.org/std/marker/trait.Sync.html), since one instance can serve several requests at once.

## Singleton

[`add_singleton`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.add_singleton) registers a value you have already built. Every request gets the same instance:

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

    app.add_singleton(InMemoryCache::default());

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

[`Dc<T>`](https://docs.rs/volga/latest/volga/di/dc/struct.Dc.html) is an [extractor](/volga-docs/en/getting-started/extractors.html) like `Json<T>` or `Query<T>`: it reads the service from the container before the handler runs.

## Scoped

A scoped service is built once per request, the first time something in that request asks for it. Register it with a **factory**, a closure that builds it. A factory's arguments are the services it needs, so the container learns its dependencies from the signature:

```rust compile
use volga::{App, di::Dc, ok};

struct Db {
    url: String,
}

#[derive(Clone)]
struct Repo {
    db: Dc<Db>,
}

impl Repo {
    fn describe(&self) -> String {
        format!("repo over {}", self.db.url)
    }
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.add_singleton(Db { url: "postgres://localhost/app".into() });

    // A new `Repo` for every request, built from the singleton `Db`
    app.add_scoped_factory(|db: Dc<Db>| Ok(Repo { db }));

    app.map_get("/repo", |repo: Dc<Repo>| async move {
        ok!(repo.describe())
    });

    app.run().await
}
```

### Factory rules

* **A factory without arguments returns `T`:** `add_scoped_factory(|| Cache::new())`.
* **A factory with arguments returns `Result<T, volga::di::error::Error>`**, so the example above wraps its value in `Ok(..)`. The arguments are resolved before the call, and building the service may still fail. Returning a plain `T` from such a factory does not compile, and the error does not mention the return type.
* **Up to five arguments.** An argument is anything the container can resolve, normally `Dc<T>`.
* **A `Container` argument declares nothing**, so a factory that takes it is left out of the [startup check](#the-graph-is-checked-at-startup). Take the services themselves as `Dc<T>` instead.

### A type with `Default`

A type that implements [`Default`](https://doc.rust-lang.org/std/default/trait.Default.html) needs no factory at all:

```rust compile-fragment
#[derive(Default, Clone)]
struct RequestLog {
    lines: std::sync::Arc<std::sync::Mutex<Vec<String>>>,
}

app.add_scoped_default::<RequestLog>();
```

### A hand-written `Inject`

When construction does not fit a closure, the type implements [`Inject`](https://docs.rs/volga/latest/volga/di/trait.Inject.html) and is registered with [`add_scoped::<T>()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.add_scoped). `inject` resolves what it needs from the container by hand, so it also has to declare those services in `dependencies()`, or the type drops out of the startup check:

```rust compile
use volga::{App, di::{Container, Dc, Dependencies, Inject, error::Error}, ok};

#[derive(Default, Clone)]
struct Clock;

#[derive(Clone)]
struct Session {
    clock: Clock,
}

impl Inject for Session {
    fn inject(container: &Container) -> Result<Self, Error> {
        Ok(Self { clock: container.resolve::<Clock>()? })
    }

    // Keep this list equal to what `inject` resolves
    fn dependencies(deps: &mut Dependencies) {
        deps.add::<Clock>();
    }
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.add_singleton(Clock);
    app.add_scoped::<Session>();

    app.map_get("/session", |_session: Dc<Session>| async { ok!() });

    app.run().await
}
```

Nothing compares `dependencies()` with what `inject` actually resolves, which is why a factory is the first choice.

## Transient

A transient service is built anew **every time it is resolved**, even twice in one request. It is registered the same three ways as a scoped one:

* [`add_transient_factory(f)`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.add_transient_factory), with the same [factory rules](#factory-rules)
* [`add_transient_default::<T>()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.add_transient_default)
* [`add_transient::<T>()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.add_transient) for a hand-written `Inject`

A transient resolved through [`Container::resolve`](https://docs.rs/volga/latest/volga/di/struct.Container.html#method.resolve) is moved out of the container rather than cloned, which is worth knowing for a type whose `Clone` or `Drop` has side effects.

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

## The Graph Is Checked at Startup

[`App::run()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.run) checks the dependency graph before it starts anything, and returns an `Err` naming every problem at once rather than the first one:

```text
dependency injection: dependency cycle: myapp::Repo -> myapp::Db -> myapp::Repo; `myapp::Api` depends on `myapp::Clock`, which is not registered
```

Nothing is bound, spawned or announced until that check passes — no background task, no HTTPS redirect listener, no greeter line — so a caller that handles the error and tries again finds the port free, and a service nobody registered is a startup failure rather than a `500` on one route.

What gets checked is what a registration **declares**. A [factory](#scoped) declares its arguments, so `add_scoped_factory(|db: Dc<Db>| Ok(Repo { db }))` says it resolves `Db`, with nothing to keep in sync. A [hand-written `Inject`](#a-hand-written-inject) declares what it resolves in `dependencies()`.

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

The check covers what handlers and middleware take as well. If a handler takes `Dc<T>` of a `T` nobody registered, `App::run()` does not start, and names the type and everything that takes it:

```text
dependency injection: `myapp::Db` is not registered, and is resolved by `GET /users/{id}`, `with` on group `/api`. Register a service with `add_singleton`, `add_scoped` or `add_transient` (or their `_factory` and `_default` forms), or take `Option<Dc<T>>` where it is optional
```

* **Checked:** route handlers, [`map_ws()`](/volga-docs/en/protocols-realtime/ws.html) and `map_msg()`, `map_err()`, `map_fallback()` of the app and of a group, and `with()`, `filter()`, `map_ok()`, `map_err()` and `tap_req()` of the app, a group or a route. Signed and private cookies count as taking their key.
* **Only what can still run is checked:** a route mapped again, a `map_err()` or a fallback replaced by a later call or by `map_problem()`, and group middleware attached to no route are left out.
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

An [extractor of your own](/volga-docs/en/advanced-patterns/custom-extractors.html#services-from-the-container) that resolves from the container takes part the way a service does: `FromRequestHead::dependencies()` declares what it resolves, and declares nothing by default.

## DI in middleware
If you need to request/inject a dependency in middleware, if you're using method [`with()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.with), `filter()`, `map_ok()`, `map_err()` or `tap_req()`, you may leverage the [`Dc`](https://docs.rs/volga/latest/volga/di/dc/struct.Dc.html) extractor similarly to request handlers. For the [`wrap()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.wrap) use either [`resolve::<T>()`](https://docs.rs/volga/latest/volga/middleware/http_context/struct.HttpContext.html#method.resolve) or [`resolve_shared::<T>`](https://docs.rs/volga/latest/volga/middleware/http_context/struct.HttpContext.html#method.resolve_shared) methods of [`HttpContext`](https://docs.rs/volga/latest/volga/middleware/http_context/struct.HttpContext.html).
The main difference between them is that the first one requires to implement the [`Clone`](https://doc.rust-lang.org/std/clone/trait.Clone.html) trait for `T` while the latter returns an [`Arc<T>`](https://doc.rust-lang.org/std/sync/struct.Arc.html).
A `Dc<T>` taken by these is part of the [startup check](#what-handlers-and-middleware-take); what `wrap()` resolves at run time is not.
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
