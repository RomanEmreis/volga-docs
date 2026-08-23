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

`map_get` also answers `HEAD` for the same path — headers, no body. Disable
that with `App::without_implicit_head()`, or override it by mapping
`map_head` explicitly for the path.

Unmatched paths go to the fallback:

```rust
app.map_fallback(|| async { not_found!("no such route") });
```

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

## Handlers

A handler is any async function or closure whose parameters are extractors
and whose return type implements `IntoResponse`. Both of these are handlers:

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
```

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
