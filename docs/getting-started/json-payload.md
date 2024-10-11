# JSON payload

To configure a `POST` request that takes a JSON body and then deserializes it to strongly typed struct, we can use the `patload<T>()` method:
```rust
use volga::{App, AsyncEndpointsMapping, Results, Payload};
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
    app.map_post("/hello", |req| async move {
        let params: User = req.payload()?;

        Results::text(&format!("Hello {}!", user.name))
    }).await;

    app.run().await
}
```
And then to run the following command:
```bash
curl -X POST "http://127.0.0.1:7878/hello" -H "Content-Type: application/json" -d "{ "name": "John", "age": 35 }"
Hello John!
```
!> To use the JSON deserialization/serialization it is required to install also [serde](https://crates.io/crates/serde_json/).

To respond with JSON body the `Resultes::from()` method can be used which has been described earlier and the struct instance passed will be automatically serialized to JSON. 
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

    app.map_get("/hello", |req| async move {
        let user: User = User {
            name: String::from("John"),
            age: 35
        };

        Results::json(&user)
    }).await;

    app.run().await
}
```
Then the following command will return the JSON:
```bash
> curl http://127.0.0.1:7878/hello
{"name":"John","age":35}
```