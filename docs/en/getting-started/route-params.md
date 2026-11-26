# Route Parameters

A route can declare parameters in curly brackets, `/users/{id}`, and the handler receives their values as arguments. Built-in types are read straight from the path: the primitives, `String`, the `std::net` addresses, `PathBuf` and, with the `uuid` feature, [`Uuid`](#uuid). A value that does not parse into the argument's type answers `400` before the handler runs.

## A Single Parameter

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

```bash
> curl "http://localhost:7878/hello/world"
Hello world!
```

## Several Parameters

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

```bash
> curl "http://localhost:7878/hello/beautiful/world"
Hello beautiful world!
```

::: warning Parameters are read by position
Each argument takes the next parameter the route declares, whatever it is called. For `/hello/{descr}/{name}` the handler is `|descr: String, name: String|`; swapping the arguments swaps the values. A handler that reads more parameters than its route declares [panics where it is mapped](/volga-docs/en/reference/routing.html#a-handler-reads-only-what-its-route-declares).
:::

## Using `Path<T>`

[`Path<T>`](https://docs.rs/volga/latest/volga/http/endpoints/args/path/struct.Path.html) reads the parameters by position into one value: a tuple, in the order the route declares them, or a single type on a route that declares exactly one parameter:

```rust compile
use volga::{App, Path, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // GET /hello/beautiful/world
    app.map_get("/hello/{descr}/{name}", |Path((descr, name)): Path<(String, String)>| {
        ok!("Hello {descr} {name}!")
    });

    // GET /users/42
    app.map_get("/users/{id}", |Path(id): Path<u32>| ok!("user {id}"));

    app.run().await
}
```

::: warning `Path<T>` of a single type reads exactly one parameter
`Path<u32>` on a route that declares two parameters is refused where it is mapped: it never picks the first of several, so a `Path<OrderId>` on `/users/{user_id}/orders/{order_id}` cannot read the user's id as the order's. Read such a route as a tuple, `Path<(u64, OrderId)>`, or by name with [`NamedPath<T>`](#using-namedpath-t).
:::

A struct with named fields is not a `Path<T>`. It goes into `NamedPath<T>`, and the compile error for `Path<MyStruct>` says so.

## Using `NamedPath<T>`

[`NamedPath<T>`](https://docs.rs/volga/latest/volga/http/endpoints/args/path/struct.NamedPath.html) reads the parameters by name into a struct, or into a `HashMap`. The struct derives `Deserialize`, so the project needs [serde](https://crates.io/crates/serde):

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
        ok!("Hello {}! Your age is: {}!", user.name, user.age)
    });

    app.run().await
}
```

A handler reads its route's parameters in one of these ways. Positional arguments next to `Path<T>` or `NamedPath<T>` do not compile.

## An Optional Segment

`Option<T>` reads `None` where the route has no parameter left, so one handler can serve a route with and without the segment:

```rust compile-fragment
let posts = |page: Option<u32>| ok!("{page:?}");
app.map_get("/posts", posts);        // None
app.map_get("/posts/{page}", posts); // Some(3)
```

## Parameters of Your Own Types

Any type becomes a path parameter by implementing [`FromPathArg`](https://docs.rs/volga/latest/volga/http/endpoints/args/trait.FromPathArg.html). [`PathArg::parse`](https://docs.rs/volga/latest/volga/http/endpoints/args/struct.PathArg.html#method.parse) reads the value through `FromStr` and answers `400` if it does not parse, so a newtype takes one line:

```rust compile
use volga::{App, Path, error::Error, ok};
use volga::http::endpoints::args::{FromPathArg, PathArg};

struct OrderId(u64);

impl FromPathArg for OrderId {
    fn from_path_arg(arg: &PathArg) -> Result<Self, Error> {
        arg.parse().map(OrderId)
    }
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // GET /orders/42
    app.map_get("/orders/{id}", |Path(id): Path<OrderId>| ok!("order {}", id.0));

    // GET /users/7/orders/42
    app.map_get(
        "/users/{user_id}/orders/{order_id}",
        |Path((user, order)): Path<(u64, OrderId)>| ok!("order {} of user {user}", order.0),
    );

    app.run().await
}
```

Such a type is read through `Path<T>`: as its `T`, or as an element of a `Path<(..)>` tuple. An optional one is `Option<Path<OrderId>>`. Unlike a built-in type, it is not a handler argument by itself, so the call site says where the value comes from. A bare type of your own in a handler's signature is an [extractor of your own](/volga-docs/en/advanced-patterns/custom-extractors.html).

Besides `parse`, a [`PathArg`](https://docs.rs/volga/latest/volga/http/endpoints/args/struct.PathArg.html) gives you the parameter's `name()`, as the route's pattern spells it, and its `value()`, already [decoded](#values-arrive-decoded). A check of your own returns whatever error fits, here a `400` naming the parameter:

```rust compile
use volga::{App, Path, error::Error, ok};
use volga::http::endpoints::args::{FromPathArg, PathArg};

struct Slug(String);

impl FromPathArg for Slug {
    fn from_path_arg(arg: &PathArg) -> Result<Self, Error> {
        let value = arg.value();
        let valid = !value.is_empty()
            && value.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-');

        if !valid {
            return Err(Error::client_error(format!("`{}` is not a valid slug", arg.name())));
        }
        Ok(Slug(value.to_owned()))
    }
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // GET /posts/hello-world
    app.map_get("/posts/{slug}", |Path(slug): Path<Slug>| ok!("post {}", slug.0));

    app.run().await
}
```

::: tip
A single parameter of your own type can be [validated](/volga-docs/en/requests-responses/validation.html#validating-a-path-parameter) as `Valid<Path<T>>` once it also implements `Validate`. Keep `FromPathArg` to *reading* the value and `Validate` to the rules it has to meet.
:::

A type that reads several parameters at once implements `FromPathArgs` instead, see [Reading every parameter at once](/volga-docs/en/reference/routing.html#reading-every-parameter-at-once).

### `Uuid`

The `uuid` feature, part of `full`, makes [`uuid::Uuid`](https://docs.rs/uuid/latest/uuid/struct.Uuid.html) a path parameter. Volga does not re-export the type, so add the `uuid` crate as well:

```toml
[dependencies]
volga = { version = "0.15", features = ["uuid"] }
uuid = "1"
```

```rust compile
use volga::{App, Path, ok};
use uuid::Uuid;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // GET /files/0199a0f1-1111-7000-8000-000000000001
    app.map_get("/files/{id}", |id: Uuid| ok!("file {id}"));

    // GET /users/0199a0f1-1111-7000-8000-000000000001/files/0199a0f1-1111-7000-8000-000000000002
    app.map_get("/users/{user}/files/{file}", |Path((user, file)): Path<(Uuid, Uuid)>| {
        ok!("file {file} of user {user}")
    });

    app.run().await
}
```

A value that is not a UUID answers `400` before the handler runs.

## Catch-all Parameters

A route's last segment can be a catch-all parameter, `{*name}`, which binds the rest of the path as one value:

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
* **The value is the rest of the path**, separators and a trailing `/` included: `GET /files/a/b/` binds `"a/b/"`.
* **It loses to every other route.** A literal or an ordinary parameter at the same position is tried first, whatever order the routes were mapped in. The full rules are in [Catch-all precedence](/volga-docs/en/reference/routing.html#catch-all-precedence).

::: warning A catch-all is not a safe file system path
Nothing in the value is normalized, so a `..` segment reaches the handler as it was sent: `GET /files/../../etc/passwd` binds `"../../etc/passwd"`. A handler that joins the value onto a directory has to reject `..`, a root and a drive prefix itself, or resolve the joined path and check that it is still under that directory. For serving files from disk, use [`use_static_files()`](/volga-docs/en/middleware-infrastructure/static-files.html), which does this for you.
:::

## Values Arrive Decoded

The router percent-decodes the path once, and every extractor reads the decoded value: `GET /users/John%20Doe` gives `"John Doe"`, and `%31` read into a `u32` is `1`. Do not decode a value a second time. A path with a malformed escape answers `400` before any route is looked up. The details, including what `%2F` and `+` turn into, are in [How parameter values are decoded](/volga-docs/en/reference/routing.html#how-parameter-values-are-decoded).

## More Rules

How the router counts parameters, picks between overlapping routes, names parameters per route and describes them in OpenAPI is collected in [Routing Rules](/volga-docs/en/reference/routing.html). You need it when two routes share a position or something panics at registration.

Check out the full example [here](https://github.com/RomanEmreis/volga/blob/main/examples/route_params/src/main.rs).
