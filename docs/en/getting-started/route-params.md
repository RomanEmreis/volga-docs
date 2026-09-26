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

Every endpoint carries the parameter names **its own pattern** was written with, and the request reaching it is labelled from those. Two routes through the same position may name it differently — a parameter is matched by position, and only the name a handler reads by is its own route's.

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

### Two cases that panic at registration

Two spellings cannot be told apart that way, so they are reported where they are written. Both panic at registration, naming the two patterns with their verbs and what to write instead:

* **One verb naming its own route twice** — `map_get("/users/{id}", ..)` followed by `map_get("/users/{name}", ..)`. The second registration replaces the first and takes its middleware with it: one route ends up mapped rather than two, and the differing name says that was not the intention.
* **A `GET` and a `HEAD` disagreeing.** A `HEAD` request with no route of its own is answered by the `GET` route (RFC 9110 §9.3.2), so the two describe one resource and cannot name what identifies it differently.

Any other verb may name the position whatever it likes, and two routes on one verb that part at a position — `/users/{id}/posts` beside `/users/{name}/comments` — never meet at an endpoint and keep their own names too. A group prefix counts the same way, being a route pattern like any other.

### In the OpenAPI document

OpenAPI 3.0 allows one templated path per position, so since **0.11.2** routes that name a position differently are described under one path in each [OpenAPI document](/volga-docs/en/middleware-infrastructure/openapi.html): the one most of the routes there are written with, the first in alphabetical order on a tie. `GET /users/{id}` and `POST /users/{name}` become `/users/{id}` with two operations, and the `POST` operation's parameter is named `id` there.

The client does not notice — a path parameter is sent and read by position — but the document no longer shows the name the handler reads by, so debug builds report each renamed route at startup.

::: tip
Name the parameter alike on every route through a position, and every route is described under its own names. Different names are worth keeping only where the handlers really read different things.
:::

## A Literal Never Hides a Parameter

Routes are matched segment by segment, and a literal segment wins over a parameter wherever both could match. What that does *not* mean is that a literal which leads nowhere wins: when the path it starts does not reach a route, the lookup goes back to the nearest parameter it passed over and carries on from there.

```rust compile-fragment
app.map_get("/files/{name}", || async { ok!("by name") });
app.map_get("/files/shared/latest", || async { ok!("the shared one") });
```

`GET /files/shared/latest` is the literal route. `GET /files/shared` is not — `/files/shared` names no route of its own — so the lookup backtracks and the request is answered by `/files/{name}` with `name = "shared"`.

A literal still takes precedence wherever it *does* lead to a route, and a literal that carries a handler for another method still answers `405` rather than falling through to a parameter. A lookup visits each node at most once, so nothing pays for backtracking in the shapes where it never happens.

## Catch-all Parameters

Since **v0.11.0** a route's last segment can be a catch-all parameter, `{*name}`, which binds the rest of the path as one value:

```rust compile
use volga::{App, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // GET /files/docs/2026/report.pdf -> path = "docs/2026/report.pdf"
    app.map_get("/files/{*path}", |path: String| async move {
        ok!("file: {path}")
    });

    app.run().await
}
```

* **It reads at least one segment.** `/files/{*path}` does not answer `/files` or `/files/`, so that position can carry a route of its own.
* **The value is the path as the request wrote it**, from the first segment the catch-all reads to the end, separators and a trailing `/` included: `GET /files/a/b/` binds `"a/b/"`. It is decoded the way any parameter is — `String` and `Path<T>` read it undecoded, `NamedPath<T>` decodes its percent-escapes.
* **It comes last in precedence.** At every position a literal is read first, a parameter second and a catch-all last, and the first position two routes differ at decides between them, whatever order they were mapped in.
* **It is the last segment.** A route continuing past one — a route mapped inside a group whose prefix ends in one included — panics where it is mapped.
* **It is named like any other parameter**, and the [two cases that panic at registration](#two-cases-that-panic-at-registration) apply to it the same way.

```rust compile-fragment
app.map_get("/api/users/{id}", |id: u32| async move { id.to_string() });
app.map_get("/assets/{*path}", |path: String| async move { path });
app.map_get("/{lang}/{page}", |lang: String, page: String| async move { format!("{lang}/{page}") });
app.map_get("/{*path}", |path: String| async move { path });

// GET /api/users/7        -> /api/users/{id}
// GET /assets/app.js      -> /assets/{*path}, not /{lang}/{page}
// GET /en/home            -> /{lang}/{page}
// GET /api/users/7/extra  -> /{*path}, since nothing else reads all of it
```

::: warning A catch-all is not a safe file system path
Nothing in the value is normalized, so a `..` segment reaches the handler as it was sent: `GET /files/../../etc/passwd` binds `"../../etc/passwd"`. A handler that joins the value onto a directory has to reject `..`, a root and a drive prefix itself, or resolve the joined path and check that it is still under that directory. For serving files from disk, use [`use_static_files()`](/volga-docs/en/middleware-infrastructure/static-files.html), which does this for you.
:::

In an OpenAPI document a catch-all is described as the path parameter `{name}`. A catch-all beside a parameter route for the same verb at the same position — `/files/{name}` and `/files/{*path}` — would be the same templated path there, so where both are bound to one document the parameter route is described and the catch-all is left out, with a warning at startup in debug builds. Under different verbs — `GET /files/{*path}` beside `POST /files/{id}` — both are described, under one path, as [above](#in-the-openapi-document).

## How Parameter Values Are Decoded

A positional extractor — `String`, a `FromStr` type, [`Path<T>`](https://docs.rs/volga/latest/volga/http/endpoints/args/path/struct.Path.html) — reads the value as the request wrote it, percent-escapes included. [`NamedPath<T>`](https://docs.rs/volga/latest/volga/http/endpoints/args/path/struct.NamedPath.html) decodes percent-escapes, and keeps every other character as written: `&` and `+` are literal characters in a path, so `/files/C++` reads as `"C++"` and `/users/a&admin=true` as the single value `"a&admin=true"`.

Using these examples, you can add dynamic routing to your Volga-based web server, enhancing the flexibility and functionality of your applications.

Check out the full example [here](https://github.com/RomanEmreis/volga/blob/main/examples/route_params/src/main.rs)
