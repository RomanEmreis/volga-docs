# Handling JSON

Volga simplifies the process of dealing with JSON data in your web applications, both for ingesting incoming JSON payloads in `POST` requests and sending JSON responses.

## Receiving JSON Data
To accept a JSON body in a `POST` request and deserialize it into a strongly-typed struct, use the `payload<T>()` method. First, ensure your struct derives from `Deserialize`:

```rust
use volga::{App, AsyncEndpointsMapping, Payload, ok};
use serde::Deserialize;
 
#[derive(Deserialize)]
struct User {
    name: String,
    age: i32
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::build("localhost:7878").await?;

    // POST /hello
    // { name: "John", age: 35 }
    app.map_post("/hello", |request| async move {
        let params: User = request.payload().await?;

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

!> To use JSON deserialization, you'll need to add [`serde`](https://crates.io/crates/serde) as a dependency in your project.
## Sending JSON Responses
To send responses as JSON, Volga provides a couple of convenient methods:

### Using Results::from()
The `Results::from()` method can be used which has been described earlier and the struct instance passed will be automatically serialized to JSON.

### Using Results::json()
This method directly serializes Rust structs into JSON output. Ensure your struct implements Serialize:
```rust
use volga::{App, AsyncEndpointsMapping, Results, Payload};
use serde::Serialize;
 
#[derive(Serialize)]
struct User {
    name: String,
    age: i32
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::build("localhost:7878").await?;

    app.map_get("/hello", |request| async move {
        let user: User = User {
            name: String::from("John"),
            age: 35
        };

        Results::json(&user)
    });

    app.run().await
}
```
To see the JSON response in action:
```bash
> curl http://127.0.0.1:7878/hello
{"name":"John","age":35}
```
### Simplified Version with ok! Macro
For a more streamlined approach, the `ok!` macro automatically uses `Results::json()` under the hood when passing a serializable object:
```rust
use volga::{App, AsyncEndpointsMapping, ok, Payload};
use serde::Serialize;
 
#[derive(Serialize)]
struct User {
    name: String,
    age: i32
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::build("localhost:7878").await?;

    app.map_get("/hello", |request| async move {
        let user: User = User {
            name: String::from("John"),
            age: 35
        };

        ok!(&user)
    });

    app.run().await
}
```
### Using Status with JSON
You can also include HTTP status codes in your JSON responses using the `status!` macro:
```rust
use volga::{App, AsyncEndpointsMapping, status, Payload};
use serde::Serialize;
 
#[derive(Serialize)]
struct User {
    name: String,
    age: i32
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::build("localhost:7878").await?;

    app.map_get("/hello", |request| async move {
        let user: User = User {
            name: String::from("John"),
            age: 35
        };

        status!(200, &user)
    });

    app.run().await
}
```
The JSON body can be coupled with standard HTTP statuses such as `200`, `400`, `401`, `403` and others to provide clear client-side messages.

Here is the [full example](https://github.com/RomanEmreis/volga/blob/main/examples/json.rs)