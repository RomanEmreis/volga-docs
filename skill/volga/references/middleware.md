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
| `filter` | extractors, returns `bool` | validation and access checks |
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

A `filter` returning `false` answers `404`. Header mutation methods return
`&mut Self` since 0.9.0, and `append_header` is infallible.

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

app.use_static_files();    // = map_static_assets() + map_fallback_to_file()
```

`map_static_assets()` maps `GET` and `HEAD` for everything under the content
root, with `/` serving the index file. The fallback is only wired if a
fallback file was configured — pointing it at `index.html` is the SPA
setup. `with_files_listing()` enables directory browsing; leave it off in
production.

`HostEnv` can also be built standalone (`HostEnv::new("/static")`, then
`set_host_env(env)`) and extracted in handlers and middleware.

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
