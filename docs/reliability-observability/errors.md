# Global Error Handling

Volga provides a global error handling mechanism that catches all [`Error`](https://doc.rust-lang.org/std/error/trait.Error.html) values that may occur in request handlers and middleware. This can be easily achieved using the [`map_err`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_err) method of the [`App`](https://docs.rs/volga/latest/volga/app/struct.App.html) to register a function that handles errors.  

The function receives an [`Error`](https://docs.rs/volga/latest/volga/error/struct.Error.html) object and should return a response that implements the [`IntoResponse`](https://docs.rs/volga/latest/volga/http/response/into_response/trait.IntoResponse.html) trait.  

### Example:
```rust
use volga::{App, error::Error, status};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();
    
    app.map_get("/error", || async {
        std::io::Error::other("some error")
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
volga = { version = "...", features = ["problem-details"] }
```
Then, you may return the [`Problem`](https://docs.rs/volga/latest/volga/error/problem/struct.Problem.html) from request handler:
```rust
use volga::{App, error::Problem};
use serde::Serialize;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/problem", || async {
        // Always producing the problem

        Problem::new(400)
            .with_detail("Missing Parameter")
            .with_instance("/problem")
            .with_extensions(ValidationError {
                invalid_params: vec![InvalidParam { 
                    name: "id".into(), 
                    reason: "The ID must be provided".into()
                }]
            })
    }); 

    app.run().await
}

#[derive(Default, Serialize)]
struct ValidationError {
    #[serde(rename = "invalid-params")]
    invalid_params: Vec<InvalidParam>,
}

#[derive(Default, Serialize)]
struct InvalidParam {
    name: String,
    reason: String,
}
```
### Example Response:
```json
HTTP/1.1 400 Bad Request
Content-Type: application/problem+json

{
    "type": "https://tools.ietf.org/html/rfc9110#section-15.5.1",
    "title": "Bad Request",
    "status": 400,
    "detail": "Missing Parameter",
    "instance": "/problem",
    "invalid-params": [
        { "name": "id", "reason": "The ID must be provided" }
    ]
}
```

## Global Error Handling With Problem Details

Moreover, you can combine the [`Problem`](https://docs.rs/volga/latest/volga/error/problem/struct.Problem.html) with [`map_err`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_err) by using the [`use_problem_details()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.use_problem_details) method:
```rust
use volga::{App, error::Error};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();
    
    app.map_get("/error", || async {
        // Always producing the error 
        // that will be converted into Problem Details

        std::io::Error::other("some error")
    });

    // Enabling global error handler that produces
    // error responses in Problem details format
    app.use_problem_details();  

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
Problem::new(400)
    .with_type("https://tools.ietf.org/html/rfc9110#section-15.6.1")
    .with_title("Server Error");
```
Additionally, you can include extra details if needed:  
```rust
Problem::new(400)
    .with_detail("Missing Parameter")
    .with_instance("/problem")
    .with_extensions(ValidationError {
        invalid_params: vec![InvalidParam { 
            name: "id".into(), 
            reason: "The ID must be provided".into()
        }]
    })
```
or
```rust
Problem::new(400)
    .with_detail("Missing Parameter")
    .with_instance("/problem")
    .add_param("reason", "The ID must be provided");
```

For a complete example, see the full implementation:
- [Global Error Handling](https://github.com/RomanEmreis/volga/blob/main/examples/global_error_handler/src/main.rs).
- [Problem Details](https://github.com/RomanEmreis/volga/blob/main/examples/problem_details/src/main.rs)
