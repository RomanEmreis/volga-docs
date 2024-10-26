# Request cancellation

If a long-running task needs to be canceled upon a remote client closing the connection (e.g., closing a browser page), Volga supports tracking those scenarios by introducing a dedicated `CancellationToken` per HTTP request.

This is how it can be used:

```rust
use volga::{App, Results, AsyncEndpointsMapping, Cancel};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    // Start the server
    let mut server = App::build("localhost:7878").await?;

    // Example of long-running task
    server.map_get("/long-task", |request| async move {
        // Getting request cancellation token
        let cancellation_token = req.cancellation_token(); 
        
        // Running infinite loop until the remote client close the connection
        let mut interval = tokio::time::interval(Duration::from_millis(1000));
        while !cancellation_token.is_cancelled() {
            interval.tick().await;

            // Doing some long-running job...
        }
        Results::text("done")
    }).await;
    
    server.run().await
}
```
More robust version with using `tokio::select!`:
```rust
use volga::{App, Results, AsyncEndpointsMapping, Cancel};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    // Start the server
    let mut server = App::build("localhost:7878").await?;

    // Example of long-running task
    server.map_get("/long-task", |request| async move {
        // Getting request cancellation token
        let cancellation_token = req.cancellation_token();
        
        // Running infinite loop until the remote client close the connection
        tokio::select! {
            _ = cancellation_token.cancelled() => (),
            result = long_running_task() => ()
        }
        
        Results::text("done")
    }).await;
    
    server.run().await
}

async fn long_running_task() {
    let mut interval = tokio::time::interval(Duration::from_millis(100));
    loop {
        interval.tick().await;
        
        // Doing some long-running job...
    }
}
```
In the example above, when a remote client cancels the request the `cancellation_token.cancelled()` will be finished first, and then `tokio::select!` will cancel the `long_running_task()`.

This feature could help save a lot of computing resources, preventing long-running tasks from running for nothing, while fast small tasks that run faster than 300 ms won't be affected.

[Here](https://docs.rs/tokio-util/latest/tokio_util/sync/struct.CancellationToken.html) you can find some additional information about `CancellationToken`.