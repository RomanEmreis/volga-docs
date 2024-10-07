# Custom middleware

Volga features a middleware pipeline in which middleware functions are sequentially called, culminating in the request handler.
To ensure this behavior, a special closure named `next` must be invoked within each middleware; otherwise to do so will result in the pipeline being shortcutted. 
While shortcutting the pipeline can be advantageous, particularly for implementing request filters, the presence of the next closure also provides greater control, enabling the execution of specific code before or after subsequent middleware functions. 
Below is an example illustrating how to configure middleware:
```rust
use volga::{App, Results, AsyncEndpointsMapping, AsyncMiddlewareMapping};

#[tokio::main]
async fn main() -> tokio::io::Result<()> {
    // Start the server
    let mut app = App::build("localhost:7878").await?;

    // Middleware 1
    app.use_middleware(|context, next| async move {
        // Something can be done before the middleware 2

        let response = next(context).await;

        // Something can be done after the middleware 2 is completed

        response
    }).await;

    // Middleware 2
    app.use_middleware(|context, next| async move {
        // Something can be done before the request handler

        let response = next(context).await;

        // Something can be done after the request handler is completed

        response
    }).await;
    
    // Example of asynchronous request handler
    app.map_get("/hello", |request| async {
        Results::text("Hello World!")
    }).await;
    
    app.run().await
}
```