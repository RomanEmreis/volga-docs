# Routing Rules

[Route Parameters](/volga-docs/en/getting-started/route-params.html) covers everyday routing. This page collects the exact rules behind it: how parameters are counted and decoded, how the router picks between overlapping routes, and what makes a registration panic. Volga checks most of these where a route is mapped, so a mistake stops the application at startup instead of failing requests later.

## A Handler Reads Only What Its Route Declares

A positional parameter takes the next parameter its route declares, so a handler that reads more than the route has could never succeed. The count is checked where the handler is mapped, and `map_*` panics naming the route:

```rust
app.map_get("/sum", |x: i32, y: i32| ok!(x + y)); // panics
```

```text
`GET /sum`: the handler reads 2 path parameters, but the route declares 0, so it would fail every request that reaches it. A request cannot supply a path parameter that is not declared: declare it, read the value from somewhere else - the query string, through `Query<T>` - or take one that may be missing as `Option<T>`.
```

Declare the parameters, `/sum/{x}/{y}`, or read the values from the query string with [`Query<T>`](/volga-docs/en/getting-started/query-params.html).

* **Counted:** positional parameters, each taking the next one, and `Path<T>`. A tuple of `N` needs at least `N` parameters, a single type exactly one.
* **A handler may read fewer:** `|id: u32|` on `/users/{id}/{*rest}` reads `id`, and `Path<(T,)>` reads the first of any number.
* **`Option<T>` and `Result<T, Error>` take any number.** They read `None` or an `Err` where no parameter is left, which is how one handler serves a route with an [optional segment](/volga-docs/en/getting-started/route-params.html#an-optional-segment).
* **Checked:** `map_*` of the app and of a [route group](/volga-docs/en/getting-started/route-groups.html), whose prefix declares parameters as a route does, `map_ws()`, `map_msg()`, `map_fallback()`, and a group's fallback against its prefix.
* **Not checked:** `NamedPath<T>`, which reads by name, and middleware: a `Path<T>` in `with()` runs for every route of its scope.

## Reading Every Parameter at Once

`Path<T>` reads its `T` through [`FromPathArgs`](https://docs.rs/volga/latest/volga/http/endpoints/args/trait.FromPathArgs.html), and [`PathArgs`](https://docs.rs/volga/latest/volga/http/endpoints/args/struct.PathArgs.html) iterates the parameters in the order the route declares them, so a type can take several at once:

```rust compile
use std::ops::RangeInclusive;
use volga::{App, Path, error::Error, ok};
use volga::http::endpoints::args::{FromPathArgs, PathArgs};

struct Range {
    from: u32,
    to: u32,
}

impl FromPathArgs for Range {
    // Mapped on a route declaring anything but two, it panics
    const ARITY: RangeInclusive<usize> = 2..=2;

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

[`ARITY`](https://docs.rs/volga/latest/volga/http/endpoints/args/trait.FromPathArgs.html#associatedconstant.ARITY) says how many parameters the type reads, and [mapping it](#a-handler-reads-only-what-its-route-declares) on a route that declares another number panics, as it does for a built-in type. The default takes any number and checks nothing. The check inside `from_path_args` stays for a `Path<Range>` in middleware, which is not checked: a route that does not declare what the type reads is a mistake in the code, not in the request, so it answers `500`.

Such a type is read through `Path<T>`, as a `FromPathArg` type of your own is, so `|range: Range|` does not compile. Write `|Path(range): Path<Range>|`.

## Parameter Names Are Per-Route

Every endpoint carries the parameter names **its own pattern** was written with, and the request reaching it is labelled from those. Two routes through the same position may name it differently: a parameter is matched by position, and only the name a handler reads by is its own route's.

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

* **One verb naming its own route twice:** `map_get("/users/{id}", ..)` followed by `map_get("/users/{name}", ..)`. The second registration replaces the first and takes its middleware with it: one route ends up mapped rather than two, and the differing name says that was not the intention.
* **A `GET` and a `HEAD` disagreeing.** A `HEAD` request with no route of its own is answered by the `GET` route (RFC 9110 §9.3.2), so the two describe one resource and cannot name what identifies it differently.

Any other verb may name the position whatever it likes, and two routes on one verb that part at a position, `/users/{id}/posts` beside `/users/{name}/comments`, never meet at an endpoint and keep their own names too. A group prefix counts the same way, being a route pattern like any other.

### In the OpenAPI document

OpenAPI 3.0 allows one templated path per position, so routes that name a position differently are described under one path in each [OpenAPI document](/volga-docs/en/middleware-infrastructure/openapi.html): the one most of the routes there are written with, the first in alphabetical order on a tie. `GET /users/{id}` and `POST /users/{name}` become `/users/{id}` with two operations, and the `POST` operation's parameter is named `id` there.

The client does not notice, since a path parameter is sent and read by position, but the document no longer shows the name the handler reads by, so debug builds report each renamed route at startup.

::: tip
Name the parameter alike on every route through a position, and every route is described under its own names. Different names are worth keeping only where the handlers really read different things.
:::

## A Literal Never Hides a Parameter

Routes are matched segment by segment, and a literal segment wins over a parameter wherever both could match. What that does *not* mean is that a literal which leads nowhere wins: when the path it starts does not reach a route, the lookup goes back to the nearest parameter it passed over and carries on from there.

```rust compile-fragment
app.map_get("/files/{name}", || async { ok!("by name") });
app.map_get("/files/shared/latest", || async { ok!("the shared one") });
```

`GET /files/shared/latest` is the literal route. `GET /files/shared` is not, because `/files/shared` names no route of its own, so the lookup backtracks and the request is answered by `/files/{name}` with `name = "shared"`.

A literal still takes precedence wherever it *does* lead to a route, and a literal that carries a handler for another method still answers `405` rather than falling through to a parameter. A lookup visits each node at most once, so nothing pays for backtracking in the shapes where it never happens.

## Catch-all Precedence

* **It comes last in precedence.** At every position a literal is read first, a parameter second and a catch-all last, and the first position two routes differ at decides between them, whatever order they were mapped in.
* **It is the last segment.** A route continuing past one, a route mapped inside a group whose prefix ends in one included, panics where it is mapped.
* **It is named like any other parameter**, and the [two cases that panic at registration](#two-cases-that-panic-at-registration) apply to it the same way.
* **It is [decoded](#how-parameter-values-are-decoded) whole**, so `GET /files/a%2Fb/c` binds `"a/b/c"`.

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

In an OpenAPI document a catch-all is described as the path parameter `{name}`. A catch-all beside a parameter route for the same verb at the same position, `/files/{name}` and `/files/{*path}`, would be the same templated path there, so where both are bound to one document the parameter route is described and the catch-all is left out, with a warning at startup in debug builds. Under different verbs, `GET /files/{*path}` beside `POST /files/{id}`, both are described, under one path, as [above](#in-the-openapi-document).

## How Parameter Values Are Decoded

The router percent-decodes the path once, segment by segment, and every extractor reads the decoded value: a plain argument, a `FromPathArg` type, `Path<T>` and `NamedPath<T>` alike.

| Request | `/users/{name}` binds |
|---|---|
| `GET /users/John%20Doe` | `"John Doe"` |
| `GET /users/100%25` | `"100%"` |
| `GET /users/caf%C3%A9` | `"café"` |
| `GET /users/C++` | `"C++"`: a `+` is a plus sign in a path, not a space |
| `GET /users/a&admin=true` | `"a&admin=true"`: one value, never split |
| `GET /users/a%2Fb` | `"a/b"` |

A number is decoded before it is parsed, so `%31` read into a `u32` is `1`.

* **`%2F` never splits a segment.** It decodes to `/` inside its own segment: `GET /users/a%2Fb` reaches `/users/{name}` with `"a/b"` and never reaches a `/users/a/b` route. A catch-all is decoded whole, so `GET /files/a%2Fb/c` binds `"a/b/c"`.
* **A path that does not decode answers `400`**: a malformed escape (`%zz`, a trailing `%2`) or escapes that are not UTF-8 (`%FF`). It is answered before any route is looked up, and like a `404` it goes through the global middleware and the [error handler](/volga-docs/en/reliability-observability/errors.html), so `map_err` and problem details shape it.
* **The raw path is still there.** The request's URI keeps the path exactly as it was sent, for a handler or middleware that needs it.

::: warning The value is decoded already
`%2E%2E` arrives as `..` and `%2F` as `/`, so a single parameter can carry a separator. Check the value your handler receives, refusing `..` or `/` in a file name for example, and do not decode it a second time after checking it: `%252F` would pass the check as `%2F` and turn into `/` afterwards.
:::

### Literal segments are written as their text

A literal is matched against the decoded path too, so write it as the text it spells: `/lit/a b` or `/café`, which a client sends as `/lit/a%20b` and `/caf%C3%A9`. A literal written with a percent-escape, `app.map_get("/lit/a%20b", ..)`, panics where it is mapped, since it could only ever match `a%2520b`. A group prefix and the prefix of a [static file mount](/volga-docs/en/middleware-infrastructure/static-files.html#path-resolution) are checked the same way.
