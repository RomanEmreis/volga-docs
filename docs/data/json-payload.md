# Handling JSON

Volga simplifies the process of dealing with JSON data in your web applications, both for ingesting incoming JSON payloads in requests and sending JSON responses.

## Receiving JSON Data
To accept a JSON body in a request and deserialize it into a strongly-typed entity, use the [`Json<T>`](https://docs.rs/volga/latest/volga/http/endpoints/args/json/struct.Json.html) struct. Where `T` should be a deserializable struct, so ensure it derives from [`Deserialize`](https://docs.rs/serde/latest/serde/trait.Deserialize.html) from [serde](https://crates.io/crates/serde):
```rust
use volga::{App, Json, ok};
use serde::Deserialize;
 
#[derive(Deserialize)]
struct User {
    name: String,
    age: i32
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // POST /hello
    // { name: "John", age: 35 }
    app.map_post("/hello", |user: Json<User>| async move {
        ok!("Hello {}!", user.name)
    });

    app.run().await
}
```
To test this endpoint, you can use the `curl` command like this:
```bash
curl -X POST "http://127.0.0.1:7878/hello" -H "Content-Type: application/json" -d "{ "name": "John", "age": 35 }"
Hello John!
```
::: tip
You can wrap your struct fields into [`Option<T>`](https://doc.rust-lang.org/std/option/) as similar as described for [Optional Query Params](/volga-docs/basics/query-params.html#handle-optional-params)
:::

## Sending JSON Responses
To send responses as JSON, Volga provides a couple of convenient methods:

### Using `Results::from()`
The [`Results::from()`](https://docs.rs/volga/latest/volga/http/response/struct.Results.html#method.from) method can be used, which has been described earlier, and the struct instance passed will be automatically serialized to JSON.

### Using `Results::json()`
The [`Results::json()`](https://docs.rs/volga/latest/volga/http/response/struct.Results.html#method.json) method directly serializes Rust structs into JSON output. Ensure your struct implements [`Serialize`](https://docs.rs/serde/latest/serde/trait.Serialize.html):
```rust
use volga::{App, Results};
use serde::Serialize;
 
#[derive(Serialize)]
struct User {
    name: String,
    age: i32
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/hello", || async {
        let user: User = User {
            name: "John".into(),
            age: 35
        };

        Results::json(user)
    });

    app.run().await
}
```
To see the JSON response in action:
```bash
> curl http://127.0.0.1:7878/hello
{"name":"John","age":35}
```
### Simplified Version with `ok!` Macro
For a more streamlined approach, the [`ok!`](https://docs.rs/volga/latest/volga/macro.ok.html) macro automatically compiles into [`Results::json()`](https://docs.rs/volga/latest/volga/http/response/struct.Results.html#method.json) under the hood when passing a serializable object:
```rust
use volga::{App, ok};
use serde::Serialize;
 
#[derive(Serialize)]
struct User {
    name: String,
    age: i32
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/hello", || async {
        let user: User = User {
            name: "John".into(),
            age: 35
        };

        ok!(user)
    });

    app.run().await
}
```
Moreover, with the [`ok!`](https://docs.rs/volga/latest/volga/macro.ok.html) macro you can also use the untyped JSON:
```rust
use volga::{App, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/hello", || async {
        ok!({ name: "John", age: 35 })
    });

    app.run().await
}
```
### Using Status with JSON
You can also include HTTP status codes in your JSON responses using the [`status!`](https://docs.rs/volga/latest/volga/macro.status.html) macro:
```rust
use volga::{App, status};
use serde::Serialize;
 
#[derive(Serialize)]
struct User {
    name: String,
    age: i32
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/hello", || async {
        let user: User = User {
            name: "John".into(),
            age: 35
        };

        status!(200, user)
    });

    app.run().await
}
```
The JSON body can be coupled with standard HTTP statuses such as `200`, `400`, `401`, `403` and others to provide clear client-side messages.

Here is the [full example](https://github.com/RomanEmreis/volga/blob/main/examples/json.rs)
