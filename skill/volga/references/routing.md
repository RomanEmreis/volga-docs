# Routing and extractors

## Mapping routes

`App` and `RouteGroup` share the same mapping surface.

<!-- snippet: skip -->
```rust
app.map_get("/items", list);
app.map_post("/items", create);
app.map_put("/items/{id}", replace);
app.map_patch("/items/{id}", update);
app.map_delete("/items/{id}", remove);
app.map_head("/items/{id}", head);
app.map_options("/items", options);
app.map_query("/search", search);     // the HTTP QUERY verb (0.9.4+)
app.map_trace("/", trace);
app.map_connect("/", connect);

// any verb, including ones without a helper
app.map("PURGE", "/cache/{key}", purge);
```

`map_get` also answers `HEAD` for the same path — headers, no body. Since
0.10.0 there is no second route behind that: routing hands a `HEAD` request
with no route of its own to the `GET` route, so it travels through that
route's middleware, group middleware and CORS policy. A `HEAD` health check
against a route behind `authorize` now answers `401` / `403` where it used
to answer `200`. `App::without_implicit_head()` is **removed**; map
`map_head` explicitly to override the path, which takes precedence and runs
its own middleware and none of the `GET` route's.

Two routes reaching one position under **different parameter names** panic
at registration in two cases — one verb naming its own route twice
(`map_get("/users/{id}")` then `map_get("/users/{name}")`), and a `GET` and
a `HEAD` disagreeing. Any other verb may name the position whatever it
likes. See "Path parameters" below.

Mapping a route that is already mapped **replaces** it, along with the
middleware bound to the registration being replaced. `/x`, `/x/` and `//x`
are one route everywhere it is remembered.

Unmatched paths go to the fallback:

```rust
app.map_fallback(|| async { not_found!("no such route") });
```

A fallback takes anything implementing `FromRequestParts` — headers, the
URI, cookies, `ClientIp`, `Dc<T>`, `HostEnv`, `Config<T>` — but not the
body and not path parameters. Since 0.10.0 the per-request scope is built
for these requests, so those extractors work rather than failing with a
`500`, and an error out of a fallback is answered by the application's
`map_err`. `FromRawRequest` is removed; `FallbackHandler::call` now takes
an `HttpRequest`.

Since 0.11.1 a **group** carries a fallback of its own, for the requests
under its prefix that no route answers — any method:

```rust
use volga::{http::Uri, not_found, ok};

app.group("/api", |api| {
    api.map_get("/models", || async { ok!("models") });

    // GET /api/nope, POST /api/v1/x, DELETE /api -> here
    // POST /api/models                           -> 405, a route is there
    api.map_fallback(|uri: Uri| async move {
        not_found!("no endpoint at {}", uri.path())
    });
});
```

The router resolves it as it resolves routes: the **deepest prefix wins**
(`/api/v2` before `/api`, and either before a `/{*path}` route or a static
shell under `/`), a route answers first for its own method and `405` for
one it lacks, and the group's middleware and CORS policy wrap it. Unlike
`App::map_fallback` it **does** bind path parameters — the ones its prefix
declares, read with `NamedPath<T>`, the same at the prefix and below it;
under a prefix ending in `{*name}` it answers everything that catch-all
reads. It is not a route: not listed, not in OpenAPI, and
`ctx.matched_route()` is `false` for it, so a preflight for a path only it
answers is not treated as an endpoint's. A second fallback at one prefix
replaces the first.

Reach for it whenever an API shares a server with an SPA shell: the shell
turns every unknown path into HTML `200`, which is wrong for `/api/uesrs`,
and a group fallback gives that subtree the JSON `404` its clients parse.

## Route groups

<!-- snippet: skip -->
```rust
app.group("/api/v1", |api| {
    api.map_get("/users", list_users);         // GET /api/v1/users
    api.map_post("/users", create_user);
    api.map_get("/users/{id}", get_user);
});
```

A group is the unit that middleware, CORS policies, rate-limit policies and
authorization attach to — anything callable on a `Route` is callable on the
group, and applies to every route inside it.

Since 0.10.0 a group is a real **scope**: it applies what it holds once its
closure returns, so a `g.with(require_api_key)` written *below* a route
reaches that route too. Before 0.10.0 the group read its configuration at
each `map_*`, and anything registered after a route silently missed it —
which is how routes ended up escaping their group's `authorize` or
`token_bucket`. Middleware still *runs* in registration order, an outer
scope wraps an inner one, and a CORS policy chosen by a route or a nested
group is not replaced by the enclosing group's.

## Handlers

A handler is a function or closure whose parameters are extractors and whose
result implements `IntoResponse`. Since 0.11.0 it comes in two shapes, told
apart by the signature: **asynchronous** (`async fn`, or a closure returning
a future) and **synchronous** (a plain `fn`, or a closure returning the
response itself). All of these are handlers:

<!-- snippet: skip -->
```rust
app.map_get("/sum/{x}/{y}", |x: i32, y: i32| async move { x + y });

async fn get_user(id: u64, repo: Dc<Repo>) -> HttpResult {
    match repo.find(id).await? {
        Some(user) => ok!(user),
        None => not_found!("user not found"),
    }
}
app.map_get("/users/{id}", get_user);

// synchronous: nothing to await, so no future to build (0.11.0+)
app.map_get("/sum/{x}/{y}", |x: i32, y: i32| x + y);
app.map_get("/hello/{name}", |name: String| ok!("Hello {name}!"));
```

Use the synchronous shape for work with nothing to await — formatting,
arithmetic, an in-memory lookup, a header check. Extraction is identical:
`Json<T>`, `Form<T>`, `Query<T>` and `Dc<T>` arrive with the body already
read, and OpenAPI describes the route the same way. It runs inline on the
runtime worker polling the request, like an `async` body with no `.await`,
and costs the same.

A synchronous body that **blocks** — `std::fs`, a synchronous DB driver, a
long computation — goes in `volga::blocking`, which runs it on Tokio's
blocking pool while the extractors still run on the worker:

```rust
use volga::{blocking, HttpResult};

app.map_get("/reports/{id}", blocking(|id: u32| -> HttpResult {
    let report = std::fs::read_to_string(format!("reports/{id}.txt"))?;
    ok!(report)
}));
```

`blocking` takes only a synchronous handler (an `async` one is a compile
error), shares it across requests instead of cloning it (captures need not
be `Clone`), and resumes a panic on the awaiting task. The offloaded call is
**not** cancelled with the request — a long body checks a
`CancellationToken` itself. Never put blocking work in a plain synchronous
handler: it stalls every other request that worker would have polled.

Both shapes are accepted by every `map_*` and `map` on `App` and
`RouteGroup`, `map_fallback`, `map_err`, `map_conn` and `map_msg`.

The shape is carried by a marker (`volga::marker::{Async, Immediate}`),
the **last** generic parameter of every registering method and handler
trait, defaulted to `Async`. It is inferred, so only a call site that spells
generics out changes: `app.map_get::<_, _, (i32,), _>(..)`. A bound
`F: GenericHandler<Args>` still means the async shape; add a generic `M`
(`F: GenericHandler<Args, M>`) to accept both. `App::map` / `RouteGroup::map`
call their method parameter `V`, and `map_msg` / `MessageHandler` call the
message type `Msg`.

Returning `HttpResult` is the normal choice: it lets `?` propagate failures
into the error pipeline. Bare `i32`, `String`, `&'static str`, `Vec<u8>`,
`Json<T>`, `Form<T>`, `Multipart` and `std::io::Error` all implement
`IntoResponse` too — convenient for small handlers, but they cannot use `?`.

## Path parameters

Three mutually exclusive styles. **Never mix them in one handler** — the
`Path` / `NamedPath` extractors read a snapshot and the positional
parameters consume the same arguments.

```rust
// 1. positional — declared in the order they appear in the pattern
app.map_get("/hello/{descr}/{name}", |descr: String, name: String| async move {
    ok!("Hello {} {}!", descr, name)
});

// 2. positional tuple
use volga::Path;
app.map_get("/hello/{name}/{age}", |Path((name, age)): Path<(String, u32)>| async move {
    ok!("Hello {name}, age {age}")
});

// 3. named struct — needs serde::Deserialize
use volga::NamedPath;
use serde::Deserialize;

#[derive(Deserialize)]
struct Params { name: String, age: u32 }

app.map_get("/hello/{name}/{age}", |NamedPath(p): NamedPath<Params>| async move {
    ok!("Hello {}, age {}", p.name, p.age)
});
```

Any type implementing `FromStr` works as a positional parameter; a value
that fails to parse answers `400` before the handler runs.

Since 0.10.0 each endpoint binds the names **its own pattern** was written
with, so `POST /users/{name}` mapped beside `GET /users/{id}` binds `name`.
Before 0.10.0 the whole position took whichever name reached it first, so
`NamedPath<T>` on the `POST` was handed `id` and failed to deserialize —
and a handler written around that, reading `id` from a route that says
`{name}`, now reads nothing. Positional extractors never looked at the name
and are unaffected.

A literal segment wins over a parameter wherever both could match, but only
where it leads to a route: since 0.10.1 a lookup that runs out of literals
backtracks to the nearest parameter it passed over. `GET /files/{name}`
answers `/files/shared` even with `/files/shared/latest` mapped beside it —
before 0.10.1 mapping the longer route made the shorter request `404`. A
literal carrying a handler for another method still answers `405` rather
than falling through to a parameter, and each node is visited at most once.

### Catch-all parameters (0.11.0+)

A route's **last** segment can be `{*name}`, binding the rest of the path as
one value:

```rust
// GET /files/docs/2026/report.pdf -> path = "docs/2026/report.pdf"
app.map_get("/files/{*path}", |path: String| async move { ok!("{path}") });
```

* It reads **at least one** segment: `/files` and `/files/` are not
  answered by it and can be mapped separately.
* The value is the path as sent, separators and a trailing `/` kept.
  Positional extractors (`String`, `Path<T>`) read it undecoded;
  `NamedPath<T>` decodes percent-escapes.
* Precedence at every position: literal, then parameter, then catch-all;
  the first position two routes differ at decides, in any mapping order.
  `/assets/{*path}` answers `/assets/app.js` ahead of `/{lang}/{page}`.
* A segment after a catch-all — including a route inside a group whose
  prefix ends in one — **panics** at mapping. One verb naming the catch-all
  differently twice panics like any parameter.
* **Nothing is normalized**: `GET /files/../../etc/passwd` binds
  `"../../etc/passwd"`. A handler joining the value onto a directory must
  reject `..`, roots and drive prefixes, or canonicalize and check the
  prefix. For serving files use `use_static_files()`, which does this.
* OpenAPI describes it as the path parameter `{name}`. Beside a parameter
  route of the same verb at the same position (`/files/{name}` and
  `/files/{*path}`) the catch-all is left out of the shared document, with a
  debug-build warning at startup.

### How values are decoded

Positional extractors read a parameter exactly as written in the path.
`NamedPath<T>` decodes percent-escapes and nothing else: `&` and `+` are
literal path characters, so `/files/C++` is `"C++"` and `/users/a&admin=true`
is the single value `"a&admin=true"` (0.11.0; earlier versions form-decoded
it, splitting on `&` and turning `+` into a space).

## Query parameters

```rust
use volga::{Query, ok};
use serde::Deserialize;

#[derive(Deserialize)]
struct Pagination {
    page: u32,
    per_page: u32,
    sort: Option<String>,   // absent -> None instead of 400
}

app.map_get("/items", |Query(p): Query<Pagination>| async move {
    ok!("page {} of {}", p.page, p.per_page)
});
```

`T` is any `Deserialize` type, including `HashMap<String, String>`. A
missing non-`Option` field is a `400` with the serde message; wrap fields in
`Option<T>` to make them optional.

## Bodies

| Extractor | Reads | Feature |
|---|---|---|
| `Json<T>` | `application/json` into a `Deserialize` type | — |
| `Form<T>` | `application/x-www-form-urlencoded` | — |
| `Multipart` | `multipart/*` (any subtype) | `multipart` |
| `File` | a single streamed upload | — |
| `ByteStream` | the body as an async byte stream | — |
| `HttpBody` | the raw body (0.9.4+) | — |
| `HttpBodyStream` | the body as a `Stream<Item = Result<Bytes, Error>>` | — |
| `HttpRequest` | the whole request | — |

Only **one** body extractor per handler: the body is a stream that is consumed
once. Head-only extractors (`Path`, `Query`, `HttpHeaders`, `Dc`) combine with
it freely. The default body limit is 5 MB — `with_body_limit(..)` raises it,
`without_body_limit()` removes it.

```rust
use serde::Deserialize;
use volga::{Json, ok};

#[derive(Deserialize)]
struct User { name: String }

app.map_post("/users", |user: Json<User>| async move {
    ok!("Hello {}!", user.name)   // Json<T> derefs to T
});
```

`Json<T>`, `Form<T>`, `Query<T>` and `Path<T>` are tuple structs — `.0`
unwraps, and `Deref` gives field access without it.

Since 0.9.9, any of them can be wrapped in `Valid<..>` (`ValidJson<T>`,
`ValidQuery<T>`, `ValidForm<T>`, `ValidPath<T>`) to run the payload's own
`Validate` impl before the handler is entered — see
`references/validation.md`.

### The raw body

<!-- snippet: skip -->
```rust
use http_body_util::BodyExt;              // volga does not re-export it
use volga::{HttpBody, http::HttpBodyStream, ok};

// collected
app.map_post("/raw", |body: HttpBody| async move {
    let bytes = body.collect().await?.to_bytes();
    ok!(format!("received {} bytes", bytes.len()))
});

// streamed — nothing is held in memory at once
app.map_post("/count", |mut stream: HttpBodyStream| async move {
    let mut total = 0;
    while let Some(chunk) = stream.next().await {   // futures_util::StreamExt
        total += chunk?.len();
    }
    ok!(format!("received {total} bytes"))
});
```

`HttpBody` is returnable too, which makes a pass-through handler a move rather
than a copy. Its constructors — `full`, `empty`, `json`, `form`, `file`,
`stream`, `stream_bytes` — are what the response macros expand to.

### Files

```rust
use volga::{App, File};

app.map_post("/upload", |file: File| async move {
    file.save_as("uploads/received.bin").await   // or .save("uploads") to keep the sent name
});
```

### Multipart (feature `multipart`)

Incoming:

```rust
use volga::{Multipart, ok};
use std::path::Path as FsPath;

app.map_post("/upload", |files: Multipart| async move {
    files.save_all("uploads").await
});

// or per field — `next_field` takes `&mut self`, so bind it `mut`
app.map_post("/upload", |mut files: Multipart| async move {
    let dir = FsPath::new("uploads");
    while let Some(field) = files.next_field().await? {
        field.save(dir).await?;
    }
    ok!("uploaded")
});
```

Outgoing — `Multipart` also implements `IntoResponse`:

```rust
use bytes::Bytes;
use volga::{Multipart, multipart::{MultipartSubtype, Part}};

app.map_get("/report", || async {
    Multipart::from_parts([
        Part::text("greeting", "hello"),
        Part::file("logo", "logo.png", Bytes::from_static(b"\x89PNG")),
    ])
    .with_subtype(MultipartSubtype::Mixed)
});
```

`Part::text` / `bytes` / `file` / `stream` / `new` build parts; the
`try_*` counterparts return an error instead of panicking and are the right
choice when a name or filename comes from untrusted input.
`Multipart::from_stream` emits parts lazily; `Multipart::into_outgoing()`
re-encodes an incoming multipart for proxying (boundary is regenerated, so
it is not byte-perfect — forward the raw `HttpBody` when that matters).

## Headers

```rust
use volga::headers::{Header, ContentType, HttpHeaders, headers};

// a well-known header
app.map_get("/a", |ct: Header<ContentType>| async move { ok!("{ct}") });

// custom headers, declared once
headers! {
    (ApiKey, "x-api-key"),
    (CorrelationId, "x-corr-id")
}
app.map_get("/b", |key: Header<ApiKey>, id: Header<CorrelationId>| async move {
    ok!("{key}; {id}")
});

// the whole map
app.map_get("/c", |headers: HttpHeaders| async move {
    let key = headers.get_raw("x-api-key");
    let typed: Header<ApiKey> = headers.try_get()?;
    ok!("{typed}")
});
```

With the `macros` feature (**not** in `full`) the attribute form is
available too:

```rust
use volga::headers::http_header;

#[http_header("x-api-key")]
struct ApiKey;
```

A `Header<T>` parameter is required: a request without the header answers
`400`. Take `HttpHeaders` and `get_raw` when the header is optional.

Writing headers on a response uses the semicolon form — see
`responses.md`.

## Cookies (feature `cookie`)

```rust
use volga::{HttpResult, http::Cookies, ok, status, see_other};

async fn login(cookies: Cookies) -> Result<(HttpResult, Cookies), volga::error::Error> {
    Ok((see_other!("/me"), cookies.add(("session-id", "generated"))))
}

async fn me(cookies: Cookies) -> HttpResult {
    match cookies.get("session-id") {
        Some(c) => ok!("hello {}", c.value()),
        None => status!(401, "Unauthorized"),
    }
}
```

Returning the `Cookies` alongside the response is what emits `Set-Cookie`.
Build cookies with attributes through the `cookie` crate's builder:

<!-- snippet: skip -->
```rust
use cookie::{Cookie, time::Duration};

let c = Cookie::build(("session-id", value))
    .path("/")
    .secure(true)
    .http_only(true)
    .max_age(Duration::days(1))
    .build();
```

`SignedCookies` (feature `signed-cookie`) and `PrivateCookies`
(`private-cookie`) work identically but need a key registered in DI —
`app.add_singleton(SignedKey::generate())` or `PrivateKey::generate()`.
Both features imply `di`.

## Other extractors

| Extractor | Gives |
|---|---|
| `Dc<T>` | a dependency from the container (feature `di`) |
| `Config<T>` | a bound configuration section (feature `config`) |
| `CancellationToken` | cancelled when the client disconnects |
| `ClientIp` | the peer address (`into_inner()` for the `SocketAddr`) |
| `HostEnv` | content root, index and fallback file settings |
| `Basic` | parsed `Authorization: Basic` credentials (feature `basic-auth`) |
| `BearerTokenService` | encode/decode JWTs (feature `jwt-auth`) |
| `HttpRequestMut` | a mutable request, only inside `tap_req` |
