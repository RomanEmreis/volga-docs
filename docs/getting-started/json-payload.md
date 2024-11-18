# JSON payload

To configure a `POST` request that takes a JSON body and then deserializes it to strongly typed struct, we can use the `payload<T>()` method:
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
And then to run the following command:
```bash
curl -X POST "http://127.0.0.1:7878/hello" -H "Content-Type: application/json" -d "{ "name": "John", "age": 35 }"
Hello John!
```
!> Reading JSON payload only works with asynchronous request handlers.

!> To use the JSON deserialization/serialization it is required to install also [serde](https://crates.io/crates/serde_json/).

To respond with JSON body the `Results::from()` method can be used which has been described earlier and the struct instance passed will be automatically serialized to JSON. 
However, if we don't need custom headers or any specific Content-Type, the more convenient way could be using a dedicated method `Results::json()`:
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
Then the following command will return the JSON:
```bash
> curl http://127.0.0.1:7878/hello
{"name":"John","age":35}
```
Alternative usage with `ok!` macro which uses the `Results::json()` under the hood:
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
And with the `status!` macro that works in a similar way:
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
The JSON body can be used with `200`, `400`, `401` and `403` statuses.