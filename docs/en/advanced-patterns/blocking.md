# Blocking Work

A synchronous handler that genuinely **blocks** — `std::fs`, a synchronous database driver, a long computation — should not run on a runtime worker: while it does, that worker polls nothing else. Wrap it in [`blocking`](https://docs.rs/volga/latest/volga/fn.blocking.html), and its body runs on Tokio's blocking pool instead:

```rust compile
use volga::{App, HttpResult, blocking, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/reports/{id}", blocking(|id: u32| -> HttpResult {
        let report = std::fs::read_to_string(format!("reports/{id}.txt"))?;
        ok!(report)
    }));

    app.run().await
}
```

* The extractors still run on the worker; only the body is moved to [`spawn_blocking`](https://docs.rs/tokio/latest/tokio/task/fn.spawn_blocking.html) and awaited.
* `blocking` takes a synchronous handler. An asynchronous one already yields, has nothing to offload, and is rejected at compile time.
* The handler is shared between requests rather than cloned for each one, so what it captures does not have to be `Clone`.
* A panic in the body is resumed on the task awaiting it, just as if the handler had run inline.
* A hand-off to another thread costs far more than a short body does, so use `blocking` only when the body actually blocks.

## Cancellation

The offloaded call is **not** cancelled together with the request: once started, it runs to completion, and its result is discarded if the client has gone. A long body that should stop early takes a [`CancellationToken`](/volga-docs/en/reliability-observability/cancellation.html) and checks it as it goes:

```rust compile
use std::time::Duration;
use volga::{App, CancellationToken, blocking};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/blocking-task", blocking(|token: CancellationToken| {
        for _ in 0..5 {
            if token.is_cancelled() {
                break;
            }
            std::thread::sleep(Duration::from_secs(1));
        }
        "done"
    }));

    app.run().await
}
```

Check out the full example [here](https://github.com/RomanEmreis/volga/blob/main/examples/long_running_task/src/main.rs).
