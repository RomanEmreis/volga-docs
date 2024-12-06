# Route Parameters
Volga offers robust routing configurations allowing you to harness dynamic routes using parameters. By utilizing the function arguments that implement [`FromStr`](https://doc.rust-lang.org/std/str/trait.FromStr.html) trait you can pass them directly to your request handler.

## Example: Single Route Parameter

Here's how to set up a simple dynamic route that greets a user by name:
```rust
use volga::{App, Router, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/hello/{name}", |name: String| async move {
        ok!("Hello {}!", name)
    });

    app.run().await
}
```
## Testing the Route
In the curly brackets, we described the `GET` route with a `name` parameter, so if we run requests over the Web API it will call the desired handler and pass an appropriate `name` value as a function argument.

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
use volga::{App, Router, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/hello/{descr}/{name}", |descr: String, name: String| async move {
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
::: warning
It is important to keep the handler function's arguments order strictly the same as described in the route.
So for the `hello/{descr}/{name}` it supposed to be `|descr: String, name: String|`.
:::

## Using `Path<T>`
Alternatively, use the [`Path<T>`](https://docs.rs/volga/latest/volga/app/endpoints/args/path/struct.Path.html) to wrap the route parameters into dedicated struct. Where `T` should be either deserializable struct or `HashMap`. Make sure that you have also [serde](https://crates.io/crates/serde) installed:
```rust
use volga::{App, Router, Path, ok};
use serde::Deserialize;
 
#[derive(Deserialize)]
struct User {
    name: String,
    age: u32
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // GET /hello/John/35
    app.map_get("/hello/{name}/{age}", |user: Path<User>| async move {
        // Here you can directly access the user struct fields
        ok!("Hello {}! You're age is: {}!", user.name, user.age)
    });

    app.run().await
}
```

Using these examples, you can add dynamic routing to your Volga-based web server, enhancing the flexibility and functionality of your applications.

Check out the full example [here](https://github.com/RomanEmreis/volga/blob/main/examples/route_params.rs)