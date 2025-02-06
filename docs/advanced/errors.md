# Global Error Handling

Volga provides a global error handling mechanism that catches all [`Errors`](https://doc.rust-lang.org/std/error/trait.Error.html) that may occur in request handlers and middleware. This can be easily achieved using the [`map_err`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_err) method of the [`App`](https://docs.rs/volga/latest/volga/app/struct.App.html) to register a function that handles errors.  

The function receives an [`Error`](https://docs.rs/volga/latest/volga/error/struct.Error.html) object and should return a response that implements the [`IntoResponse`](https://docs.rs/volga/latest/volga/http/response/into_response/trait.IntoResponse.html) trait.  

### Example:
```rust
use volga::{App, error::Error, status};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();
    
    app.map_get("/error", || async {
        std::io::IoError::other("some error")
    });

    // Enabling global error handler
    app.map_err(|error: Error| async move {
        status!(500, "{:?}", error)
    });

    app.run().await
}
```
In this example, we intentionally create a request handler that produces an error and define an error handler that generates an HTTP response with a `500` status code based on the error message.  

For convenience, the [`Error`](https://docs.rs/volga/latest/volga/error/struct.Error.html) struct includes a `status` field that covers common cases (400, 401, 403, 404, etc.), allowing the macro usage to be updated as follows:  
```rust
status!(error.status.as_u16(), "{:?}", error)
```
In fact, this is how the default error handler is implemented. If we remove the [`map_err`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_err) method, the response remains unchanged. However, defining a custom error handler offers greater flexibility for advanced logging and tracing.  

## Problem Details

Volga fully supports the [Problem Details](https://www.rfc-editor.org/rfc/rfc9457) format, which provides machine-readable error details in HTTP responses. This eliminates the need to define custom error formats for HTTP APIs.  

To enable this functionality, ensure that the `problem-details` feature is activated in your app's `Cargo.toml`:
```toml
[dependencies]
volga = { version = "0.5.0", features = ["problem-details"] }
```
Then, you can combine the [`problem!`](https://docs.rs/volga/latest/volga/macro.problem.html) macro with [`map_err`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_err):
```rust
use volga::{App, error::Error, problem};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();
    
    app.map_get("/error", || async {
        std::io::IoError::other("some error")
    });

    // Enabling global error handler
    app.map_err(|error: Error| async move {
        let (status, instance, err) = error.into_parts();
        problem! {
            "status": status.as_u16(),
            "detail": (err.to_string()),
            "instance": instance
        }
    });

    app.run().await
}
```
### Example Response:
```json
HTTP/1.1 500 Internal Server Error
Content-Type: application/problem+json

{
    "type": "https://tools.ietf.org/html/rfc9110#section-15.6.1",
    "title": "Internal Server Error",
    "status": 500,
    "detail": "some error",
    "instance": "/error"
}
```
The `type` and `title` fields are inferred from the status code but can be overridden:  
```rust
problem! {
    "type": "https://tools.ietf.org/html/rfc9110#section-15.6.1",
    "title": "Server Error",
    "status": status.as_u16(),
    "detail": (err.to_string()),
    "instance": instance
}
```
Additionally, you can include extra details if needed:  
```rust
problem! {
    "type": "https://tools.ietf.org/html/rfc9110#section-15.5.1",
    "title": "Bad Request",
    "status": 400,
    "details": "Your request parameters didn't validate.",
    "instance": "/some/resource/path",
    "invalid-params": [
        { "name": "id", "reason": "Must be a positive integer" }
    ]
};
```

For a complete example, see the full implementation [here](https://github.com/RomanEmreis/volga/blob/main/examples/global_error_handler.rs). 