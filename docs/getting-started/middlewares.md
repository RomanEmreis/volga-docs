# Custom Middleware

Volga framework features a flexible middleware pipeline that allows you to process and modify HTTP requests and responses sequentially through middleware functions before reaching the final request handler.

## Overview of Middleware Behavior

Each middleware function in the pipeline must explicitly call a [`next`](https://docs.rs/volga/latest/volga/middleware/type.Next.html) closure to pass control to the next middleware or the request handler. Failing to invoke [`next`](https://docs.rs/volga/latest/volga/middleware/type.Next.html) results in shortcutting the rest of the pipeline, which can be useful for handling specific conditions before reaching further processing stages.

Having the ability to call the [`next`](https://docs.rs/volga/latest/volga/middleware/type.Next.html) closure gives you extensive control over the execution flow, enabling you to run code before or after subsequent middleware functions or the request handler.

## Configuring Middleware
First of all, if you're not using the `full` features, you need to enable the `middleware` feature in your `Cargo.toml`
```toml
[dependencies]
volga = { version = "0.4.4", features = ["middleware"] }
```

### Example: Sequential Middleware Execution

Here’s a practical example of how to configure sequential middleware in Volga:
```rust
use volga::{App, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    // Configure the server
    let mut app = App::new();

    // Middleware 1
    app.use_middleware(|context, next| async move {
        // Something can be done before the middleware 2
        println!("Before Middleware 2");

        let response = next(context).await;

        // Something can be done after the middleware 2 is completed
        println!("After Middleware 2");

        response
    });

    // Middleware 2
    app.use_middleware(|context, next| async move {
        // Something can be done before the request handler
        println!("Before Request Handler");

        let response = next(context).await;

        // Something can be done after the request handler is completed
        println!("After Request Handler");

        response
    });
    
    // Example of request handler
    app.map_get("/hello", || async {
        ok!("Hello World!")
    });
    
    // Run the server
    app.run().await
}
```
### Example: Middleware Short-Cutting Pipeline
The following example demonstrates how to shortcut the middleware pipeline to prevent the request handler from being executed. This approach can be particularly useful for implementing authorization filters or pre-request validations that may terminate the request early:
```rust
use volga::{App, ok, status};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    // Configure the server
    let mut app = App::new();

    // Middleware 1
    app.use_middleware(|context, next| async move {
        // Something can be done before the middleware 2
        println!("Processed by Middleware 1");

        let response = next(context).await;

        // Something can be done after the middleware 2 is completed
        println!("Back in Middleware 1");

        response
    });

    // Middleware 2
    app.use_middleware(|context, next| async move {
        // Directly returns without calling 'next', shortcutting the pipeline
        status!(400)
    });
    
    // Example of asynchronous request handler
    app.map_get("/hello", || async {
        // This will never executed
        ok!()
    });
    
    // Run the server
    app.run().await
}
```

Here is the [full example](https://github.com/RomanEmreis/volga/blob/main/examples/middleware.rs).
