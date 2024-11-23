# Route Parameters
Volga offers robust routing configurations allowing you to harness dynamic routes using parameters. By utilizing the `params()` method, you can fetch all request parameters as a `HashMap` collection.

## Example: Single Route Parameter

Here's how to set up a simple dynamic route that greets a user by name:
```rust
use volga::{App, AsyncEndpointsMapping, Params, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::build("localhost:7878").await?;

    app.map_get("/hello/{name}", |request| async move {
        // Get parameters from the request
        let params = request.params().unwrap();
        // Access the 'name' parameter
        let name = params.get("name").unwrap();

        ok!("Hello {}!", name)
    });

    app.run().await
}
```
## Testing the Route
In the curly brackets, we described the `GET` route with a `name` parameter, so if we run requests over the Web API it will call the desired handler and pass an appropriate `name` as a route parameter.

Using the `curl` command, you can test the above configuration:
```bash
> curl http://localhost:7878/hello/world
Hello world!

> curl http://localhost:7878/hello/earth
Hello earth!

> curl http://localhost:7878/hello/sun
Hello sun!
```
## Example: Multiple Route Parameters
You can also configure multiple parameters in a route. Here’s an example:
```rust
use volga::{App, AsyncEndpointsMapping, Params, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::build("localhost:7878").await?;

    app.map_get("/hello/{descr}/{name}", |request| async move {
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
When you run the following curl command, it will return:
```bash
> curl "http://localhost:7878/hello/beautiful/world"
Hello beautiful world!
```
## Using `param()` for More Direct Access
Alternatively, use `param()` or `param_str()` for a more convenient and direct way to access route parameters:
```rust
use volga::{App, AsyncEndpointsMapping, Params, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::build("localhost:7878").await?;

    // GET /hello/John/35
    app.map_get("/hello/{name}/{age}", |request| async move {
        // Access the 'name' parameter
        let name: &str = request.param_str("name")?;
        // Access the 'age' parameter
        let age: u32 = request.param("age")?;

        ok!("Hello {}! You're age is: {}!", name, age)
    });

    app.run().await
}
```
This method simplifies parameter access, but note that if parameters are missing, a `Bad Request 400` status will be returned.

Using these examples, you can add dynamic routing to your Volga-based web server, enhancing the flexibility and functionality of your applications.

Check out the full example [here](https://github.com/RomanEmreis/volga/blob/main/examples/route_params.rs)