# Request cancellation

If a long-running task needs to be canceled upon a remote client closing the connection (e.g., closing a browser page), Volga supports tracking those scenarios by introducing a dedicated [`CancellationToken`](https://docs.rs/volga/latest/volga/app/endpoints/args/cancellation_token/type.CancellationToken.html) per HTTP request. Which is powered by [Tokio's](https://tokio.rs/) [`CancellationToken`](https://docs.rs/tokio-util/0.7.13/tokio_util/sync/struct.CancellationToken.html).

This is how it can be used:

```rust
use std::time::Duration;
use volga::{App, Router, CancellationToken, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // Example of long-running task
    app.map_get("/long-task", |cancellation_token: CancellationToken| async move {       
        // Running infinite loop until the remote client close the connection
        let mut interval = tokio::time::interval(Duration::from_millis(1000));

        while !cancellation_token.is_cancelled() {
            interval.tick().await;

            // Doing some long-running job...
        }

        ok!("done")
    });
    
    app.run().await
}
```
More robust version with using [`tokio::select!`](https://docs.rs/tokio/latest/tokio/macro.select.html):
```rust
use std::time::Duration;
use volga::{App, Router, CancellationToken, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // Example of long-running task
    app.map_get("/long-task", |cancellation_token: CancellationToken| async move {
        // Running infinite loop until the remote client close the connection
        tokio::select! {
            _ = cancellation_token.cancelled() => (),
            result = long_running_task() => ()
        }
        
        ok!("done")
    });
    
    app.run().await
}

async fn long_running_task() {
    let mut interval = tokio::time::interval(Duration::from_millis(100));
    loop {
        interval.tick().await;
        
        // Doing some long-running job...
    }
}
```
In the example above, when a remote client cancels the request, the [`cancellation_token.cancelled()`](https://docs.rs/tokio-util/0.7.13/tokio_util/sync/struct.CancellationToken.html#method.cancelled) will be finished first, and then [`tokio::select!`](https://docs.rs/tokio/latest/tokio/macro.select.html) will cancel the `long_running_task()`.

This feature could help save a lot of computing resources, preventing long-running tasks from running for nothing, while fast, small tasks that run faster than 300 ms won't be affected.

[Here](https://docs.rs/tokio-util/latest/tokio_util/sync/struct.CancellationToken.html) you can find some additional information about `CancellationToken`.
