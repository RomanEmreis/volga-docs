# Route Parameters
Volga offers robust routing configurations allowing you to harness dynamic routes using parameters. By utilizing the function arguments that implement the [`FromStr`](https://doc.rust-lang.org/std/str/trait.FromStr.html) trait, you can pass them directly to your request handler.

## Example: Single Route Parameter

Here's how to set up a simple dynamic route that greets a user by name:
```rust compile
use volga::{App, ok};

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
In the curly brackets, we described the `GET` route with a `name` parameter, so if we run requests over the HTTP API, it will call the desired handler and pass an appropriate `name` value as a function argument.

Using the `curl` command, you can test the above configuration:
```bash
> curl "http://localhost:7878/hello/world"
Hello world!

> curl "http://localhost:7878/hello/earth"
Hello earth!

> curl "http://localhost:7878/hello/sun"
Hello sun!
```
## Example: Multiple Route Parameters
You can also configure multiple parameters in a route. Here’s an example:
```rust compile
use volga::{App, ok};

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
It is important to strictly keep the order of the arguments for the handler function as described in the route.
So for the `hello/{descr}/{name}` it is supposed to be `|descr: String, name: String|`.
:::

## Using `NamedPath<T>`
Alternatively, use the [`NamedPath<T>`](https://docs.rs/volga/latest/volga/http/endpoints/args/path/struct.NamedPath.html) to wrap the route parameters into a dedicated struct. Where `T` should be either deserializable struct or `HashMap`. Make sure that you also have [serde](https://crates.io/crates/serde) installed:
```rust compile
use volga::{App, NamedPath, ok};
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
    app.map_get("/hello/{name}/{age}", |user: NamedPath<User>| async move {
        // Here you can directly access the user struct fields
        ok!("Hello {}! Your age is: {}!", user.name, user.age)
    });

    app.run().await
}
```

## Parameter Names Are Per-Route

Since **0.10.0** every endpoint carries the parameter names its own pattern was written with, and the request reaching it is labelled from those.

```rust compile
use volga::{App, NamedPath, HttpResult, ok};
use std::collections::HashMap;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/users/{id}", by_id);
    app.map_post("/users/{name}", by_name); // binds `name`, not `id`

    app.run().await
}

async fn by_id(NamedPath(p): NamedPath<HashMap<String, String>>) -> HttpResult {
    ok!("{:?}", p.get("id"))
}

async fn by_name(NamedPath(p): NamedPath<HashMap<String, String>>) -> HttpResult {
    ok!("{:?}", p.get("name"))
}
```

::: warning Fixed in 0.10.0
A node in the route tree holds a single dynamic child, because a parameter is matched by the position it sits at and not by what it is called — and that child used to hold the name as well, the one whichever route reached the position first was written with. Every other route through that position was then labelled with that name: the `POST /users/{name}` above answered correctly but bound its parameter as `id`, so `NamedPath<T>` and everything else reading a parameter by name read a key nobody wrote, and the startup route listing printed `POST /users/{id}`.

**A handler written around the old behaviour — reading `id` from a route that says `{name}` — now reads nothing.** Positional extractors (`id: i32`, `Path<(A, B)>`) never looked at the name and are unaffected.
:::

### Two cases that panic at registration

Two spellings cannot be told apart that way, so they are reported where they are written instead of being swallowed. Both panic at registration, naming the two patterns with their verbs and what to write instead:

* **One verb naming its own route twice** — `map_get("/users/{id}", ..)` followed by `map_get("/users/{name}", ..)`. The second registration replaces the first and takes its middleware with it: one route ends up mapped rather than two, and the differing name says that was not the intention.
* **A `GET` and a `HEAD` disagreeing.** A `HEAD` request with no route of its own is answered by the `GET` route (RFC 9110 §9.3.2), so the two describe one resource and cannot name what identifies it differently.

Any other verb may name the position whatever it likes, and two routes on one verb that part at a position — `/users/{id}/posts` beside `/users/{name}/comments` — never meet at an endpoint and keep their own names too. A group prefix counts the same way, being a route pattern like any other.

Using these examples, you can add dynamic routing to your Volga-based web server, enhancing the flexibility and functionality of your applications.

Check out the full example [here](https://github.com/RomanEmreis/volga/blob/main/examples/route_params/src/main.rs)
