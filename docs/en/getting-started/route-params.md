# Route Parameters
Volga offers robust routing configurations allowing you to harness dynamic routes using parameters. A handler argument whose type implements [`FromPathArg`](https://docs.rs/volga/latest/volga/http/endpoints/args/trait.FromPathArg.html) is read straight from the path: the primitives, `String`, the `std::net` addresses, `PathBuf` and, with the `uuid` feature, [`Uuid`](https://docs.rs/uuid/latest/uuid/struct.Uuid.html) — and [types of your own](#parameters-of-your-own-types).

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

## Using `Path<T>`
[`Path<T>`](https://docs.rs/volga/latest/volga/http/endpoints/args/path/struct.Path.html) reads the parameters by position into one value: a tuple, in the order the route declares them, or — since **0.13.0** — a single type on a route that declares exactly one parameter:
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
`Path<u32>` on a route that declares two parameters answers `500`: it never picks the first of several, so a `Path<OrderId>` on `/users/{user_id}/orders/{order_id}` cannot read the user's id as the order's. Read such a route as a tuple, `Path<(u64, OrderId)>`, or by name with [`NamedPath<T>`](#using-namedpath-t).

Plain arguments follow the same rule: a handler taking more positional parameters than its route declares answers `500`, and an extra `Option<T>` reads `None`.
:::

A struct with named fields is not a `Path<T>` — it goes into `NamedPath<T>`, and the compile error for `Path<MyStruct>` says so.

## Parameters of Your Own Types
Since **0.13.0** any type becomes a path parameter by implementing [`FromPathArg`](https://docs.rs/volga/latest/volga/http/endpoints/args/trait.FromPathArg.html). [`PathArg::parse`](https://docs.rs/volga/latest/volga/http/endpoints/args/struct.PathArg.html#method.parse) reads the value through `FromStr` and answers `400` if it does not parse, so a newtype takes one line:
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
    app.map_get("/orders/{id}", |id: OrderId| ok!("order {}", id.0));

    // GET /users/7/orders/42
    app.map_get(
        "/users/{user_id}/orders/{order_id}",
        |Path((user, order)): Path<(u64, OrderId)>| ok!("order {} of user {user}", order.0),
    );

    app.run().await
}
```

Such a type goes wherever a built-in one does: a handler argument of its own, an element of a `Path<(..)>` tuple, or the `T` of `Path<T>`.

Besides `parse`, a [`PathArg`](https://docs.rs/volga/latest/volga/http/endpoints/args/struct.PathArg.html) gives you the parameter's `name()`, as the route's pattern spells it, and its `value()`, already [decoded](#how-parameter-values-are-decoded). A check of your own returns whatever error fits — here a `400` naming the parameter:
```rust compile
use volga::{App, error::Error, ok};
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
    app.map_get("/posts/{slug}", |slug: Slug| ok!("post {}", slug.0));

    app.run().await
}
```

::: tip
A single parameter of your own type can be [validated](/volga-docs/en/requests-responses/validation.html#validating-a-path-parameter) as `Valid<Path<T>>` once it also implements `Validate`. Keep `FromPathArg` to *reading* the value and `Validate` to the rules it has to meet.
:::

### `Uuid`
The `uuid` feature, part of `full`, makes [`uuid::Uuid`](https://docs.rs/uuid/latest/uuid/struct.Uuid.html) a path parameter. volga does not re-export the type, so add the `uuid` crate as well:
```toml
[dependencies]
volga = { version = "0.13", features = ["uuid"] }
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

### Reading every parameter at once
`Path<T>` reads its `T` through [`FromPathArgs`](https://docs.rs/volga/latest/volga/http/endpoints/args/trait.FromPathArgs.html), and [`PathArgs`](https://docs.rs/volga/latest/volga/http/endpoints/args/struct.PathArgs.html) iterates the parameters in the order the route declares them, so a type can take several at once:
```rust compile
use volga::{App, Path, error::Error, ok};
use volga::http::endpoints::args::{FromPathArgs, PathArgs};

struct Range {
    from: u32,
    to: u32,
}

impl FromPathArgs for Range {
    fn from_path_args(args: &PathArgs) -> Result<Self, Error> {
        let mut args = args.iter();
        match (args.next(), args.next(), args.next()) {
            (Some(from), Some(to), None) => Ok(Range { from: from.parse()?, to: to.parse()? }),
            _ => Err(Error::server_error("`Range` reads exactly two path parameters")),
        }
    }
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // GET /pages/3/7
    app.map_get("/pages/{from}/{to}", |Path(range): Path<Range>| {
        ok!("pages {} to {}", range.from, range.to)
    });

    app.run().await
}
```
A route that does not declare what the type reads is a mistake in the code, not in the request — which is why the example answers `500` for it, as `Path<T>` of a single type does.

Such a type is always read through `Path<T>`: unlike a `FromPathArg` type, it is not a handler argument of its own, so `|range: Range|` does not compile — write `|Path(range): Path<Range>|`.

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
* **The value is the rest of the path**, from the first segment the catch-all reads to the end, separators and a trailing `/` included: `GET /files/a/b/` binds `"a/b/"`. It is [decoded](#how-parameter-values-are-decoded) whole, so `GET /files/a%2Fb/c` binds `"a/b/c"`.
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

Since **0.13.0** the router percent-decodes the path once, segment by segment, and every extractor reads the decoded value — a plain argument, a `FromPathArg` type, `Path<T>` and `NamedPath<T>` alike:

| Request | `/users/{name}` binds |
|---|---|
| `GET /users/John%20Doe` | `"John Doe"` |
| `GET /users/100%25` | `"100%"` |
| `GET /users/caf%C3%A9` | `"café"` |
| `GET /users/C++` | `"C++"` — a `+` is a plus sign in a path, not a space |
| `GET /users/a&admin=true` | `"a&admin=true"` — one value, never split |
| `GET /users/a%2Fb` | `"a/b"` |

A number is decoded before it is parsed, so `%31` read into a `u32` is `1`.

* **`%2F` never splits a segment.** It decodes to `/` inside its own segment: `GET /users/a%2Fb` reaches `/users/{name}` with `"a/b"` and never reaches a `/users/a/b` route. A catch-all is decoded whole, so `GET /files/a%2Fb/c` binds `"a/b/c"`.
* **A path that does not decode answers `400`** — a malformed escape (`%zz`, a trailing `%2`) or escapes that are not UTF-8 (`%FF`). It is answered before any route is looked up, and like a `404` it goes through the global middleware and the [error handler](/volga-docs/en/reliability-observability/errors.html), so `map_err` and problem details shape it.
* **The raw path is still there.** The request's URI keeps the path exactly as it was sent, for a handler or middleware that needs it.

::: warning The value is decoded already
`%2E%2E` arrives as `..` and `%2F` as `/`, so a single parameter can carry a separator. Check the value your handler receives — refusing `..` or `/` in a file name, say — and do not decode it a second time after checking it: `%252F` would pass the check as `%2F` and turn into `/` afterwards.
:::

### Literal segments are written as their text

A literal is matched against the decoded path too, so write it as the text it spells: `/lit/a b` or `/café`, which a client sends as `/lit/a%20b` and `/caf%C3%A9`. A literal written with a percent-escape — `app.map_get("/lit/a%20b", ..)` — panics where it is mapped, since it could only ever match `a%2520b`. A group prefix and the prefix of a [static file mount](/volga-docs/en/middleware-infrastructure/static-files.html#path-resolution) are checked the same way.

::: warning Upgrading from 0.12
Before 0.13.0 a positional extractor read a value as it was written, escapes included. A handler that decoded `String` parameters itself now decodes them twice — `100%25` arrives as `100%`, and decoding that again fails. Remove the extra decoding. A path with a malformed escape, which `String` and `Path<T>` used to accept, now answers `400`.
:::

Using these examples, you can add dynamic routing to your Volga-based web server, enhancing the flexibility and functionality of your applications.

Check out the full example [here](https://github.com/RomanEmreis/volga/blob/main/examples/route_params/src/main.rs)
