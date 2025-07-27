# Handling Form Data

Volga can help to easily handle a form data in your web applications, both for ingesting incoming data in requests and sending form data responses.

## Receiving Form Data
To accept a form data body in a request and deserialize it into a strongly-typed entity, use the [`Form<T>`](https://docs.rs/volga/latest/volga/http/endpoints/args/form/struct.Form.html) struct. Where `T` should be a deserializable struct or [`HashMap`](https://doc.rust-lang.org/std/collections/struct.HashMap.html). For the struct ensure it derives from [`Deserialize`](https://docs.rs/serde/latest/serde/trait.Deserialize.html) from [serde](https://crates.io/crates/serde):
```rust
use volga::{App, Form, ok};
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
    // name=John&age=35
    app.map_post("/hello", |user: Form<User>| async move {
        ok!("Hello {}!", user.name)
    });

    app.run().await
}
```
To test this endpoint, you can use the `curl` command like this:
```bash
curl -X POST "http://127.0.0.1:7878/hello" -H "Content-Type: application/x-www-form-urlencoded" --data-urlencode name=John&age=35
Hello John!
```
::: tip
Similarly to [`Json<T>`](https://docs.rs/volga/latest/volga/http/endpoints/args/json/struct.Json.html) you can wrap your struct fields into [`Option<T>`](https://doc.rust-lang.org/std/option/) to make them optional.
:::

## Sending Form Data
To send a form data response you can leverage the [`form!`](https://docs.rs/volga/latest/volga/macro.form.html) macro:
```rust
use volga::{App, Form, form};
use serde::Serialize;
 
#[derive(Serialize)]
struct User {
    name: String,
    age: i32
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/user/{name}", |name: String| async move {
        let user: User = User {
            name,
            age: 35
        };
        form!(user)
    });

    app.run().await
}
```
Alternatively, by specifying a [`Form<T>`](https://docs.rs/volga/latest/volga/http/endpoints/args/form/struct.Form.html) as a return type you can return a struct of your type directly, thanks to [`IntoResponse`](https://docs.rs/volga/latest/volga/http/response/into_response/trait.IntoResponse.html) trait:

```rust
use volga::{App, Form};
use serde::Serialize;
 
#[derive(Serialize)]
struct User {
    name: String,
    age: i32
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/user/{name}", get_user);

    app.run().await
}

async fn get_user(name: String) -> Form<User> {
    let user: User = User {
        name,
        age: 35
    };
    user.into() //or Form(user)
}
```

Here is the [full example](https://github.com/RomanEmreis/volga/blob/main/examples/form/src/main.rs)