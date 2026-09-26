# Middleware and built-in infrastructure

Everything here needs the `middleware` feature (included in `full`).

## The pipeline

Five hooks, all registrable on the `App`, a `RouteGroup` or a single
`Route`. The most specific registration wins for `map_err`; the rest
compose outward-in.

| Method | Sees | Use it for |
|---|---|---|
| `wrap` | `HttpContext` + `NextFn`, body included | compression, encoding, anything needing the raw body |
| `with` | extractors + `Next`, no body | 80% of cases — DI, headers, timing, short-circuiting |
| `attach` | a type implementing `Middleware` | reusable, configurable middleware |
| `filter` | extractors, returns `bool` / `Result<(), E>` | validation and access checks |
| `tap_req` | `HttpRequestMut` | mutate the request before the handler |
| `map_ok` | `HttpResponse` | augment a successful response |
| `map_err` | `Error` | turn an error into a response |

### `with` — the default choice

<!-- snippet: skip -->
```rust
use volga::{App, di::Dc, middleware::Next};

app.with(|cache: Dc<Cache>, next: Next| async move {
    // before the handler
    let response = next.await;
    // after the handler
    response
});
```

Not awaiting `next` short-circuits the pipeline:

```rust
app.with(|_next| async { status!(503, "draining") });
```

### `wrap` — full context including the body

<!-- snippet: skip -->
```rust
use volga::middleware::{HttpContext, NextFn};

app.wrap(|ctx, next| async move {
    let started = std::time::Instant::now();
    let response = next(ctx).await;
    tracing::info!(elapsed = ?started.elapsed(), "handled");
    response
});
```

Inside `wrap` there is no extractor injection — resolve dependencies from
the context: `ctx.resolve::<T>()` (needs `T: Clone`) or
`ctx.resolve_shared::<T>()` (gives `Arc<T>`).

### Unmatched requests reach global middleware

Since 0.10.0 routing's three outcomes — the matched route, the fallback,
and a `405` with its `Allow` header — all travel through the **global**
chain. Before that, a request nothing matched skipped the pipeline
entirely: no `wrap`, no `with`, no CORS headers, no compression, and **no
rate limiting** — a global `use_token_bucket(by::ip())` was bypassed
completely by asking for a path that does not exist.

Three consequences:

* A short-circuiting global middleware (`filter`, an early-returning
  `with`, `authorize`) now decides unmatched requests too — a global
  authorizer answers `401` where the router used to answer `404`.
* A global rate limiter **counts** unmatched requests, so a budget sized
  against the service's own routes is spent sooner than before.
* The per-request scope exists for them, so `ClientIp`,
  `CancellationToken`, `Config<T>`, `HostEnv` and `Dc<T>` work in a
  fallback handler.

`ctx.matched_route()` is `true` only when routing matched an endpoint, and
answers the same at every layer:

<!-- snippet: skip -->
```rust
app.wrap(|ctx, next| async move {
    if !ctx.matched_route() {
        return next(ctx).await;      // nothing to meter here
    }
    next(ctx).await
});
```

Per-route and per-group middleware are unaffected — those belong to a route
that by definition matched.

### `attach` — reusable middleware as a type

<!-- snippet: skip -->
```rust
use std::time::Duration;
use volga::{HttpResult, middleware::{HttpContext, Middleware, NextFn}};

struct Timeout { duration: Duration }

impl Middleware for Timeout {
    fn call(&self, ctx: HttpContext, next: NextFn) -> impl Future<Output = HttpResult> + Send + 'static {
        let duration = self.duration;
        async move {
            tokio::time::sleep(duration).await;
            next(ctx).await
        }
    }
}

app.attach(Timeout { duration: Duration::from_secs(1) });

app.map_get("/slow", handler)
    .attach(Timeout { duration: Duration::from_secs(5) });
```

`attach` also takes closures, but then the argument types must be spelled
out: `|ctx: HttpContext, next: NextFn| async move { next(ctx).await }`.

The same parameterized style exists for the other hooks — implement
`Filter`, `TapReq`, `MapOk`, `MapErr` or `With` on your own type and pass it
to the matching method. CORS, JWT auth and rate limiting are themselves
built this way.

### `filter`, `tap_req`, `map_ok`

```rust
use volga::{App, Path, HttpRequestMut, HttpResponse, HttpResult, error::Error, headers::headers};

headers! { (CustomHeader, "x-custom") }

app.group("/positive", |g| {
    g.filter(|Path((x, y)): Path<(i32, i32)>| async move { x >= 0 && y >= 0 });
    g.map_get("/sum/{x}/{y}", |x: i32, y: i32| async move { x + y });
});

app.map_get("/sum", |x: i32, y: i32| async move { x + y })
    .tap_req(add_req_header)
    .map_ok(add_resp_header);

async fn add_req_header(mut req: HttpRequestMut) -> Result<HttpRequestMut, Error> {
    req.try_insert_header::<CustomHeader>("value")?;
    Ok(req)
}

async fn add_resp_header(mut resp: HttpResponse) -> HttpResult {
    resp.try_insert_header::<CustomHeader>("value")?;
    Ok(resp)
}
```

Write `tap_req` and `map_ok` bodies as **named async functions**, not inline
closures. A closure ending in `Ok(resp)` gives the compiler no way to infer
the error type — `type annotations needed ... cannot infer type of the type
parameter E`. The return type on a named function settles it.

Header mutation methods return `&mut Self` since 0.9.0, and
`append_header` is infallible.

#### What a filter returns

`bool`, `()`, `FilterResult` or `Result<(), E>`, where `E` is `Error` or
implements `IntoError` — the same bound as a handler's `Err`. A refused
request goes to the error handler:

| Verdict | Answer |
|---|---|
| `false`, `FilterResult::err()` | `400`, generic message |
| `Err` with a status — `Error`, `StatusCode`, `(StatusCode, E)`, `io::Error` (by kind), `OAuthError`, `ValidationError`, `Problem`, your `IntoError` type | that status (0.12.0+) |
| `Err` of a string or `Box<dyn Error + Send + Sync>` | `400` with the message — unlike a handler, where it is `500` |

```rust
use volga::{headers::HttpHeaders, http::StatusCode};

app.filter(|headers: HttpHeaders| match headers.get_raw("x-api-key") {
    Some(_) => Ok(()),
    None => Err((StatusCode::UNAUTHORIZED, "missing API key")),
});
```

An `Error` returned from a filter keeps its instance and its
`with_response` body; `FilterResult::with_error(e)` takes the same types as
`Err(e)`. Since 0.12.0 a type that is only `std::error::Error` —
`ParseIntError`, `anyhow::Error` — no longer compiles as a filter's `Err`:
`.map_err(|e| (StatusCode::BAD_REQUEST, e))`.

Since 0.11.0 `filter`, `tap_req`, `map_ok` and `map_err` also take a
**synchronous** `fn` or closure returning its verdict, request or response
directly — on `App`, `Route` and `RouteGroup`:

```rust
use volga::{App, HttpResponse, HttpResult, headers::{HttpHeaders, headers}};

headers! { (Tag, "x-tag") }

app.filter(|headers: HttpHeaders| headers.get_raw("x-api-key").is_some());

app.map_get("/sum/{x}/{y}", |x: i32, y: i32| x + y)
    .map_ok(tag);

fn tag(mut resp: HttpResponse) -> HttpResult {
    resp.try_insert_header::<Tag>("sync")?;
    Ok(resp)
}
```

The same inference rule holds: give a synchronous `map_ok` / `tap_req` a
named `fn` with a return type. `with`, `wrap` and `attach` stay
**async-only** — they exist to await `next`.

## CORS

Configure, then activate, then scope. Skipping any step is a silent or
panicking failure.

```rust
use volga::{App, http::Method};

let mut app = App::new()
    .with_cors(|cors| cors
        .with_origins(["https://example.com"])
        .with_headers(["content-type", "authorization"])
        .with_methods([Method::GET, Method::POST])
        .with_credentials());          // no argument

app.use_cors();                        // required; panics if nothing was configured
```

* An **unnamed** policy is the default policy and applies everywhere.
* A **named** policy (`cors.with_name("api")`) applies only where
  `cors_with("api")` is called on a route or group — routes without it emit
  no CORS headers at all, with no warning.
* `disable_cors()` opts a route or group out of the default policy.
* Since 0.10.0 a `404` and a `405` carry the policy's headers. A
  **preflight** is still answered `204` only for a route that exists;
  everything else falls through and picks the headers up on the way out.
* A group's policy does not reach the static files that group serves — the
  application's does.
* `with_credentials()` cannot be combined with `with_any_origin()`,
  `with_any_header()` or `with_any_method()` — `use_cors()` panics on that
  combination.

## Compression and decompression

Features: `compression-full` / `decompression-full`, or the per-algorithm
`compression-brotli`, `-gzip`, `-zstd` (and the `decompression-*` twins).
Brotli, gzip, deflate and zstd are supported.

```rust
app.use_compression();     // honours Accept-Encoding, sets Content-Encoding
app.use_decompression();   // honours Content-Encoding on the request
```

An unsupported `Accept-Encoding` answers `406`; an unsupported
`Content-Encoding` answers `415`. `with_compression(...)` /
`with_decompression(...)` configure them, and
`with_decompression_limits(...)` bounds a decompressed body — set it when
accepting compressed uploads from untrusted clients.

## Static files (feature `static-files`)

```rust
use volga::App;

let mut app = App::new()
    .with_host_env(|env| env
        .with_content_root("/static")
        .with_fallback_file("404.html"));

app.use_compression();     // files are compressed
app.use_cors();            // files carry the CORS headers
app.use_static_files();    // = use_static_assets() + map_fallback_to_file()
```

Since 0.10.0 this is **middleware, not routing**. `map_static_assets()` is
renamed `use_static_assets()` — nothing is mapped any more — and it answers
`GET` and `HEAD` for everything under the content root, with `/` serving the
index file, at any depth. The fallback is only wired if a fallback file was
configured — pointing it at `index.html` is the SPA setup.
`with_files_listing()` enables directory browsing; leave it off in
production.

What follows from the mount being middleware:

* **Where you call it is where it sits.** Register it after
  `use_compression()` and `use_cors()`, before anything that should not run
  for a request answered from disk.
* **A file answers before a route does.** A `GET`/`HEAD` naming a file on
  disk is served even where a route was mapped for the same path. Any other
  method falls through to routing.
* **Nothing reaches the router**, so no route is shadowed, none of it shows
  up in the route listing or an OpenAPI spec, and `use_static_assets()`
  beside `map_get("/{id}", ..)` now works.
* **`static-files` implies `middleware`.**

Mount under a group prefix to keep files to one part of the URL space —
`app.group("/static", |g| g.use_static_files())`. The prefix must be
**literal**: `group("/{tenant}", ..)` serves nothing and warns at startup.
The group's middleware wraps the files; the group's **CORS policy does
not** — a file is served without a matched route, so the application's
policy applies.

Traversal is refused by construction: a `.`, a `..`, an encoded separator
(`%2F`) or an embedded NUL is declined rather than looked up.

`HostEnv` can also be built standalone (`HostEnv::new("/static")`, then
`set_host_env(env)`) and extracted in handlers and middleware.

### The fallback file (the shell)

Since 0.11.1 the fallback file is served by a `GET` route at the mount's
prefix and `{*path}` below it, resolved like any other route:

* **`GET` and `HEAD` only.** Any other method is `405` with
  `Allow: GET,HEAD` — a mistyped `POST` is refused where it is made instead
  of getting HTML and `200`.
* **A route of yours answers first**, in either registration order; a `GET`
  mapped by hand at one of the shell's positions takes it over.
* **It is not the application's fallback slot.** `map_fallback` and
  `map_fallback_to_file` coexist: the shell answers under the mount's
  prefix, `map_fallback` outside it. Under a root mount the shell covers
  every `GET` path, so `map_fallback` gets nothing — give an API group its
  own `RouteGroup::map_fallback` (the router prefers the deeper prefix).
* **Scoped to its prefix.** `RouteGroup::use_static_files()` serves the
  shell under that group's prefix alone, inside the group's middleware.
* Neither the files nor the shell route are listed at startup or described
  in OpenAPI.

### Caching

A file's `Cache-Control` is chosen by the role its name gives it: **assets**
(content-hashed names) get `max-age=86400, public, immutable`, and the
**shell** (the index and the fallback file) gets `no-cache`. Since 0.9.11
the shell is no longer served `immutable` — it used to be, so a user who
reloaded after a deploy kept yesterday's `index.html` for up to a day.

<!-- snippet: skip -->
```rust
App::new().with_host_env(|env| env
    .with_asset_cache_control(|cc| cc.with_max_age(60 * 60))
    .with_shell_cache_control(|cc| cc.with_no_store()));
```

Read back with `asset_cache_control()` / `shell_cache_control()`; the two
defaults are the `CacheControl::ASSET` / `CacheControl::SHELL` constants,
and `CacheControl::asset()` / `CacheControl::shell()` are the ready header
presets for a handler. `App::with_cache_control` does **not** reach the
static file server.

The `ETag` follows the same split. `ETagSource::Metadata` hashes the file's
length and the whole-second part of its `mtime`; `ETagSource::Content` hashes
the bytes, costing one read per file version (cached, keyed by length,
full-precision `mtime` and the platform's file identity). Assets default to
`Metadata` — they are served `immutable`, so the tag is never consulted —
and since 0.10.1 the shell defaults to `Content`, because two versions of an
`index.html` rewritten by a content-hashed build collide on metadata and the
old tag was answered `304` for changed content. Clients revalidate the shell
once after that upgrade; asset tags are unchanged. Both tags stay **weak**
whatever their source.

<!-- snippet: skip -->
```rust
use volga::headers::ETagSource;

App::new().with_host_env(|env| env
    .with_asset_cache_control(|cc| cc.with_max_age(60))
    .with_asset_etag(ETagSource::Content)   // narrowed ASSET, so tags matter
    .with_shell_etag(ETagSource::Metadata));
```

Narrow `CacheControl::ASSET` and assets start revalidating — that is when
`ETagSource::Content` is worth its read. Getters: `asset_etag()` /
`shell_etag()`.

## Rate limiting (feature `rate-limiting`)

Four algorithms, same three-step shape: define a policy, register it, apply
it.

| Algorithm | Register | Apply globally | Apply per route/group |
|---|---|---|---|
| Token bucket | `with_token_bucket` | `use_token_bucket` | `.token_bucket(..)` |
| Fixed window | `with_fixed_window` | `use_fixed_window` | `.fixed_window(..)` |
| Sliding window | `with_sliding_window` | `use_sliding_window` | `.sliding_window(..)` |
| GCRA | `with_gcra` | `use_gcra` | `.gcra(..)` |

<!-- snippet: skip -->
```rust
use volga::{App, rate_limiting::{by, TokenBucket}};
use std::time::Duration;

let standard = TokenBucket::new(10, 5.0).with_name("standard");     // 10 burst, 5/s
let premium  = TokenBucket::new(100, 50.0)
    .with_name("premium")
    .with_eviction(Duration::from_secs(300));                       // default 60s

let mut app = App::new()
    .with_token_bucket(standard)
    .with_token_bucket(premium);

app.use_token_bucket(by::ip().using("standard"));        // global

app.group("/api", |api| {
    api.token_bucket(by::header("x-api-key").using("premium"));
    api.map_post("/upload", upload);
});
```

Partition keys: `by::ip()`, `by::header("x-api-key")`, `by::query("tenant")`,
`by::path("user_id")`, and `by::user(|claims| claims.sub.as_str())` when
authentication is on. Behind a proxy, register the hops with
`App::with_trusted_proxies([Ipv4Addr::new(10, 0, 0, 1)])` so `by::ip()` sees
the real client rather than the proxy.

Registering a policy does not activate it — the matching `use_*` or
per-route call is what applies it.

Since 0.10.0 a **global** limiter also counts requests that match no route,
so a budget sized against the service's own routes is spent sooner than it
used to be. A **group** limiter now reaches every route the group
registered, whatever the order inside the closure.

The default store is an in-memory `DashMap`. For multi-instance
deployments implement `TokenBucketStore` / `FixedWindowStore` /
`SlidingWindowStore` / `GcraStore` and build the limiter with
`TokenBucketRateLimiter::with_store(capacity, rate, store)`.

## Cache-Control

<!-- snippet: skip -->
```rust
let mut app = App::new()
    .with_cache_control(|cc| cc.with_max_age(60).with_public().with_immutable());

app.map_get("/assets/{name}", handler)
    .cache_control(|cc| cc.with_max_age(31_536_000).with_immutable());
```
