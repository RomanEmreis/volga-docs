# Query Parameters

Volga supports extraction of query parameters into dedicated struct by using [`Query<T>`](https://docs.rs/volga/latest/volga/http/endpoints/args/query/struct.Query.html). Where `T` should be either deserializable struct or [`HashMap`](https://doc.rust-lang.org/std/collections/struct.HashMap.html). 
If you'd like to use a struct, similarly to [`Path<T>`](https://docs.rs/volga/latest/volga/http/endpoints/args/path/struct.Path.html) for route params, make sure that you also have [serde](https://crates.io/crates/serde) installed.

## Access Query Parameters

To demonstrate how to access query parameters, consider the following example:
```rust
use volga::{App, Query, ok};
use serde::Deserialize;

#[derive(Deserialize)]
struct Params {
    name: String,
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/hello", |params: Query<Params>| async move {
        ok!("Hello {}!", params.name)
    });

    app.run().await
}
```
## Testing the API with Query Parameters
You can test the API by making requests with query parameters:
```bash
> curl "http://localhost:7878/hello?name=John"
Hello John!

> curl "http://localhost:7878/hello?name=Jane"
Hello Jane!

> curl "http://localhost:7878/hello?name=World"
Hello World!
```
## Handling Multiple Query Parameters
For APIs that require multiple query parameters, you can set them up similarly:
```rust
use volga::{App, Query, ok};
use serde::Deserialize;

#[derive(Deserialize)]
struct Params {
    name: String,
    age: u32,
    email: String,
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/hello", |params: Query<Params>| async move {
        // Here you can directly access the params struct fields
        ok!("Hello {} (email: {})! Your age is: {}", params.name, params.email, params.age)
    });

    app.run().await
}
```
Testing this with multiple query parameters will yield:
```bash
> curl "http://localhost:7878/hello?name=John&age=33&email=john@email.com"
Hello John (email: john@email.com)! Your age is: 33
```
## Handle optional params
For the example above if we run the `curl` command by ignoring some parameter, e.g. `email` we'll get the `400 BAD REQUEST` response:
```bash
> curl "http://localhost:7878/hello?name=John&age=33"

< HTTP/1.1 400 BAD REQUEST
Query parsing error: missing field `name`
```
However, if we want to keep some of the parameters as optional, we can wrap them in [`Option<T>`](https://doc.rust-lang.org/std/option/) as follows:
```rust
use volga::{App, Query, ok};
use serde::Deserialize;

#[derive(Deserialize)]
struct Params {
    name: String,
    age: u32,
    email: Option<String>, // making email as optional parameter
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/hello", |params: Query<Params>| async move {
        if let Some(email) = params.email {
            ok!("Hello {} (email: {})! Your age is: {}", params.name, params.email, params.age)
        } else {
            ok!("Hello {}! Your age is: {}", params.name, params.age)
        }
    });

    app.run().await
}
```

This guide should provide you with the tools needed to efficiently utilize query parameters in your Volga-based web applications.

You can check out the full example [here](https://github.com/RomanEmreis/volga/blob/main/examples/query_params.rs)