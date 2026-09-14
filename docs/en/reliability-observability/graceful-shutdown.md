# Graceful Shutdown

Volga always shuts down gracefully on an OS signal — `Ctrl+C` and `SIGTERM` on Unix, and their equivalents on Windows. When the signal arrives the listener stops accepting new connections, in-flight requests are allowed to finish, and only then does [`run()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.run) return.

Starting with **v0.9.3**, the same shutdown can be triggered from your own code with a [`ShutdownHandle`](https://docs.rs/volga/latest/volga/app/shutdown/struct.ShutdownHandle.html) — for an admin endpoint, a watchdog, a lease that expired, or a worker that finished the job the process was started for.

## Creating an App with a Handle

[`App::with_shutdown()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.with_shutdown) returns an app paired with a fresh handle:

```rust compile
use std::time::Duration;
use volga::App;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let (app, shutdown) = App::with_shutdown();

    tokio::spawn(async move {
        tokio::time::sleep(Duration::from_secs(60)).await;
        shutdown.shutdown();
    });

    app.run().await
}
```

The handle is cheap to clone and can be handed anywhere; calling [`shutdown()`](https://docs.rs/volga/latest/volga/app/shutdown/struct.ShutdownHandle.html#method.shutdown) from any clone starts the same graceful shutdown. It **composes** with the built-in signal handler rather than replacing it — whichever fires first wins.

## Registering an External Handle

If the handle is owned elsewhere — created during startup, stored in your application state, shared with background tasks — register it on an existing app with [`with_shutdown_signal()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.with_shutdown_signal):

```rust compile
use volga::{App, ShutdownHandle};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let handle = ShutdownHandle::new();
    let app = App::new().with_shutdown_signal(handle.clone());

    // `handle` can now live in your state, a supervisor, a CLI command...
    app.run().await
}
```

A [`ShutdownHandle`](https://docs.rs/volga/latest/volga/app/shutdown/struct.ShutdownHandle.html) is built on Tokio's [`CancellationToken`](https://docs.rs/tokio-util/latest/tokio_util/sync/struct.CancellationToken.html), so it can also adopt a token you already have with [`ShutdownHandle::from_token()`](https://docs.rs/volga/latest/volga/app/shutdown/struct.ShutdownHandle.html#method.from_token) (or the equivalent `From<CancellationToken>`), which lets the server join a cancellation tree the rest of your process already uses.

Two more methods let you observe the state rather than trigger it:

* [`is_shutdown_requested()`](https://docs.rs/volga/latest/volga/app/shutdown/struct.ShutdownHandle.html#method.is_shutdown_requested) — whether a shutdown has been requested;
* [`cancelled()`](https://docs.rs/volga/latest/volga/app/shutdown/struct.ShutdownHandle.html#method.cancelled) — a future that resolves when it is, so background tasks can wind down with the server.

## Shutting Down on a Future

[`shutdown_on()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.shutdown_on) triggers a graceful shutdown when the given future resolves — useful for anything that already signals itself asynchronously: a `oneshot` channel, an external watchdog, a config-reload notification, a lease renewal that gave up.

```rust compile
use volga::App;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let (tx, rx) = tokio::sync::oneshot::channel::<()>();

    let app = App::new()
        .bind("127.0.0.1:7878")
        .shutdown_on(async move { let _ = rx.await; });

    // sending on `tx` later triggers a graceful shutdown
    app.run().await
}
```

Multiple [`shutdown_on()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.shutdown_on) calls compose: any of the registered futures resolving triggers the shutdown, and all of them compose with the OS signal handler and with a [`ShutdownHandle`](https://docs.rs/volga/latest/volga/app/shutdown/struct.ShutdownHandle.html) registered earlier. If no handle was registered, one is created internally.

::: tip
The future is spawned onto the Tokio runtime when the app starts, so [`shutdown_on()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.shutdown_on) is safe to call before any runtime exists — including in front of [`run_blocking()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.run_blocking).
:::

## Shutting Down from a Handler

Since the handle is just a clonable value, injecting it through [dependency injection](/volga-docs/en/advanced-patterns/di.html) gives you an administrative shutdown endpoint:

```rust compile
use volga::{App, ShutdownHandle, di::Dc, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let handle = ShutdownHandle::new();

    let mut app = App::new().with_shutdown_signal(handle.clone());
    app.add_singleton(handle);

    app.map_post("/admin/shutdown", |handle: Dc<ShutdownHandle>| async move {
        handle.shutdown();
        ok!("shutting down")
    });

    app.run().await
}
```

The response is still delivered: the request that asked for the shutdown is in flight, and in-flight requests are what a graceful shutdown waits for.

::: warning
Guard an endpoint like this with [authentication and authorization](/volga-docs/en/security-access/auth.html) — it stops the server for everyone.
:::

## What `run()` Waits For

When the shutdown signal arrives, the accept loop stops taking new connections and `run()` waits for the open ones to finish what they are serving — up to **10 seconds**, after which it stops waiting and returns. The app's services, singletons included, are released once that wait is over. A TLS handshake still in progress is dropped rather than waited for: there is no request behind it yet.

::: warning Fixed in 0.10.1
Graceful shutdown was skipped for **every** open connection whenever a request happened to be in flight at the moment the accept loop stopped — the common case, since that is usually what a shutdown interrupts. `run()` returned while responses were still being written, and they were cut off by whatever dropped the runtime next, which under [`run_blocking()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.run_blocking) is the end of `main`.

Nothing in an app's code changes because of this; a rolling deploy simply stops losing the requests it was already serving.
:::

## Shutdown and Request Cancellation

The two are related but distinct. A shutdown lets in-flight requests **finish**; [request cancellation](/volga-docs/en/reliability-observability/cancellation.html) fires when a *client* disappears mid-request. A long-running handler should observe both: the per-request [`CancellationToken`](https://docs.rs/volga/latest/volga/app/endpoints/args/cancellation_token/type.CancellationToken.html) so it stops working for a client that left, and the shutdown handle so it does not hold the process open past the point of no return.
