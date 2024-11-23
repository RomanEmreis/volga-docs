# Query Parameters

Volga supports extraction of query parameters similarly to route parameters. However, keep in mind that query parameters, which share names with route parameters, will be overwritten by the route parameters values in the same `HashMap` collection.

## Access Query Parameters

To demonstrate how to access query parameters, consider the following example:
```rust
use volga::{App, AsyncEndpointsMapping, Params, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::build("localhost:7878").await?;

    app.map_get("/hello", |request| async move {
        // Get parameters from the request
        let params = request.params().unwrap();
        // Access the 'name' parameter
        let name = params.get("name").unwrap();

        ok!("Hello {}!", name)
    });

    app.run().await
}
```
## Testing the API with Query Parameters
You can test the API by making requests with query parameters:
```bash
> curl http://localhost:7878/hello?name=world
Hello world!

> curl http://localhost:7878/hello?name=earth
Hello earth!

> curl http://localhost:7878/hello?name=sun
Hello sun!
```
## Handling Multiple Query Parameters
For APIs that require multiple query parameters, you can set them up similarly:
```rust
use volga::{App, AsyncEndpointsMapping, Params, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::build("localhost:7878").await?;

    app.map_get("/hello", |request| async move {
        // Get parameters from the request
        let params = request.params().unwrap();

        // Access the 'name' parameter
        let name = params.get("name").unwrap();
        // Access the 'descr' parameter
        let descr = params.get("descr").unwrap();

        ok!("Hello {} {}!", descr, name)
    });

    app.run().await
}
```
Testing this with multiple query parameters will yield:
```bash
> curl "http://localhost:7878/hello?descr=beautiful&name=world"
Hello beautiful world!
```
## Direct Access to Query Parameters
To directly access query parameters, bypassing the need to unwrap the `HashMap`, you can use the `param()` or `param_str()` methods as shown:
```rust
use volga::{App, AsyncEndpointsMapping, Params, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::build("localhost:7878").await?;

    // GET /hello?name=John&age=35
    app.map_get("/hello", |request| async move {
        // Access the 'name' parameter
        let name: &str = request.param_str("name")?;
        // Access the 'age' parameter
        let age: i32 = request.param("age")?;

        ok!("Hello {}! You're age is: {}!", name, age)
    });

    app.run().await
}
```
By using `param()` `param_str()`, you can avoid dealing with potential `None` values directly, streamlining your code and managing error responses more effectively.

This guide should provide you with the tools needed to efficiently utilize query parameters in your Volga-based web applications.

You can check out the full example [here](https://github.com/RomanEmreis/volga/blob/main/examples/query_params.rs)