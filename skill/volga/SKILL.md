---
name: volga
description: Build, review and debug HTTP services in Rust with the volga web framework — routing, extractors, response macros, middleware, dependency injection, JWT/OAuth 2.1 auth, input validation, rate limiting, TLS, WebSockets, SSE, configuration, graceful shutdown and testing. Use whenever Rust code depends on `volga`, whenever the task is to write or change a volga handler, middleware or `App` setup, and when upgrading such code across volga versions.
license: MIT
metadata:
  volga-version: "0.14.1"
  msrv: "1.90"
  edition: "2024"
  docs: "https://romanemreis.github.io/volga-docs/"
  api-reference: "https://docs.rs/volga"
---

# volga — HTTP services in Rust

`volga` is an explicit, composable web framework on top of Tokio and hyper.
An `App` owns the router, the DI container, the middleware pipeline and the
server configuration. Handlers are plain functions or closures — async, or
since 0.11.0 synchronous — whose arguments are extractors and whose return
value is anything that implements `IntoResponse`.

**This skill describes volga 0.14.x.** The 0.9 line changed security
defaults and removed a set of `with_default_*` helpers; 0.10.0 rebuilt how
requests reach middleware, renamed the static file mount and made route
groups a real scope; 0.10.1 moved a rejected bearer token from `403` to
`401` and made a dependency graph that cannot resolve refuse to start;
0.11.0 added synchronous handlers, `blocking`, catch-all routes and a
shutdown timeout that closes what is still open; 0.11.1 gave a route group
a fallback of its own and made the static-file shell a `GET` route under
its mount; 0.11.2 let OpenAPI inputs be described by hand; 0.12.0 made a
handler's `Err` an error handed to `map_err` instead of a second response,
with `IntoError` as the one impl an error type needs; 0.13.0 made the router
percent-decode the path once for every extractor and let a type of your
own be a path parameter through `FromPathArg`; 0.13.1 let a route group
and a single route set a request body limit of their own and answers a
body over the limit `413`; 0.13.2 let issuer-based validation fetch keys
from an explicit `jwks_uri` and built a `DecodingKey` from a JSON Web Key;
0.13.3 made `with_alg` replace the default `HS256`, stops the app at startup
when a static key does not fit its algorithms, and made `with_iss` require
`iss`; 0.14.0 made `Dc<T>` read-only, stops the app at startup when a
handler or middleware takes a service nobody registered, and panics where a
handler reading path parameters its route does not declare is mapped;
0.14.1 renamed `cache_control` on a route or group, `use_problem_details` and
`ValidPath` to `with_cache_control`, `map_problem` and `ValidNamedPath`, and
gave every `App::with_X` that builds a config a `set_X` peer. The
response macros use a **semicolon** before custom headers. Most volga
code a model has seen predates all of it. The
[Non-negotiables](#non-negotiables) below are the places where writing
older volga still *looks* right and does not compile — or compiles and
rejects every request in production. Read them before writing code, every
time.

## Step 1 — establish the version and the features

```bash
cargo add volga --features full
cargo add tokio --features full
```

In an existing project, read `Cargo.toml` before touching anything:

| What you find | What it means |
|---|---|
| `volga = "0.14"` or `"0.14.1"` | This skill applies as written — a caret requirement resolves to the newest 0.14.x |
| `volga = "=0.14.0"` pinned exactly | As written, except the 0.14.1 names: a route or group sets `Cache-Control` with `cache_control`, `App` turns on Problem Details with `use_problem_details`, the validated named path is `ValidPath<T>`, and there is no `set_bearer_auth` / `set_oauth` / `set_cache_control` / `set_http2_limits` / `set_decompression_limits`. See 0.14.0 → 0.14.1 in `references/migration.md` |
| `volga = "0.13"` or `"0.13.3"` | As `=0.14.0`, and: `Dc<T>` has `DerefMut`, and a write through it changes a private copy; a handler or middleware taking an unregistered `Dc<T>`, or a handler reading path parameters its route does not declare, starts and answers `500` on every request; a handler taking `HttpRequest` sees no path parameters; a filter's `false` and a body over the limit answer with the old messages. Read 0.13.x → 0.14.0 in `references/migration.md` before upgrading — two of these surface at startup, not at compile time |
| `volga = "=0.13.2"` pinned exactly | As 0.13.x, and bearer auth: `with_alg` adds to the default `HS256` instead of replacing it, `encode` always signs `HS256`, `with_iss` does not require `iss`, and a key that does not fit its algorithms is not reported at startup. See 0.13.2 → 0.13.3 in `references/migration.md` |
| `volga = "=0.13.1"` pinned exactly | As `=0.13.2`, and there is no `OAuthConfig::with_jwks_uri` (nor `jwks_uri` in `[oauth.client]`) and no `DecodingKey::from_jwk`. See 0.13.1 → 0.13.2 in `references/migration.md` |
| `volga = "=0.13.0"` pinned exactly | As `=0.13.1`, and there is no `with_body_limit` / `without_body_limit` on a `RouteGroup` or `Route` — only on `App` — and a body over the limit answers `400` instead of `413`. See 0.13.0 → 0.13.1 in `references/migration.md` |
| `volga = "0.12"` or `"0.12.0"` | Positional path extractors (`String`, `u32`, `Path<T>`) read values **undecoded** and accept malformed escapes; `FromPathArg` is private, there is no `uuid` feature, and `Path<T>` takes tuples only. Read the 0.12.x → 0.13.0 path in `references/migration.md` before upgrading — it changes values without a compile error |
| `volga = "0.11"` or `"0.11.x"` | A handler's `Err` must implement `IntoResponse` and is sent as a response, skipping `map_err`; error types implement `From<T> for Error`; no `IntoError`, no `Error::with_response`. Read the 0.11.x → 0.12.0 path in `references/migration.md` before upgrading — part of it changes answers without a compile error |
| `volga = "0.11.0"` or `"0.11.1"` pinned exactly | As 0.11.x; 0.11.0 also lacks `RouteGroup::map_fallback`, and its fallback file answers every method. `OpenApiSchema` is unreachable before 0.11.2 |
| `volga = "0.10"` or `"0.10.x"` | No synchronous handlers, `blocking`, catch-all routes, shutdown timeout or `ShutdownHandle` extractor — every handler must be `async`. Read the 0.10.x → 0.11.0 path in `references/migration.md` before upgrading |
| `volga = "0.10.0"` pinned exactly | As 0.10.x, and three different answers at runtime: a rejected token is answered `403` rather than `401`, a missing DI registration fails the first request instead of the start, and the shell's `ETag` comes from its metadata |
| `volga = "0.9"` | Static files, route groups, `HEAD` and unmatched requests all behave differently. Read `references/migration.md` first |
| `volga = "0.8"` or older | Different auth defaults and helper methods too. Read `references/migration.md` first |
| no `features` key | Only `http1` is on. Nearly everything below needs a feature — check the table in `references/operations.md` |
| `features = ["full"]` | Everything except `dev-cert`, `macros`, `jwt-derive` and `test`. Those four are **not** in `full` |

`full` covering almost everything is what makes the exceptions bite:
`#[derive(Claims)]` needs `jwt-auth-full` (or `auth-full`), `#[http_header]`
needs `macros`, self-signed dev certificates need `dev-cert`, and
`TestServer` needs `test` as a **dev-dependency**. `#[derive(Validate)]` is
**not** one of them — `validation-derive` is in `full`, and the `Validate`
trait and `Valid<E>` need no feature at all. Adding one of those to
the `features` list of a `full` build is additive and always correct.

## Step 2 — route to the reference you need

Each file is self-contained; load only what the task calls for.

| The task | Read |
|---|---|
| Routes, groups, path/query/JSON/form/file/multipart/header/cookie/raw-body extraction, path parameters of your own types (`FromPathArg`, `Uuid`), request body limits per app / group / route | `references/routing.md` |
| Validating an extracted payload — `Validate`, `Valid<E>`, `#[derive(Validate)]`, `ValidationError` | `references/validation.md` |
| Returning a response, status codes, streaming, errors (`Result<T, E>`, `IntoError`, `with_response`), Problem Details | `references/responses.md` |
| `with` / `wrap` / `attach` / `filter` / `tap_req` / `map_ok` / `map_err`, CORS, compression, static files, rate limiting | `references/middleware.md` |
| Dependency injection, lifetimes, configuration files, hot reload | `references/di-config.md` |
| Basic auth, JWT, authorizers, OAuth 2.1 / OIDC, DPoP, machine-to-machine grants, TLS, HSTS | `references/security.md` |
| WebSockets, WebSocket-over-HTTP/2, Server-Sent Events | `references/realtime.md` |
| Feature flags, tracing, cancellation, graceful shutdown, OpenAPI (hand-written schemas included), tests, deployment | `references/operations.md` |
| A compile error on code that "used to work", or upgrading from 0.13.x / 0.13.2 / 0.13.1 / 0.13.0 / 0.12.x / 0.11.x / 0.10.x / 0.9.x / 0.8.x | `references/migration.md` |

## An app that works

```rust
use volga::{App, Json, ok};
use serde::{Deserialize, Serialize};

#[derive(Deserialize, Serialize)]
struct User {
    name: String,
    age: u32,
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    // `with_*` builders consume and return `App` — chain them first.
    let mut app = App::new().bind("127.0.0.1:7878");

    // `map_*` borrow `&mut App` — hence `let mut`.
    app.map_get("/health", || async { ok!("healthy") });

    app.map_get("/users/{id}", |id: u64| async move {
        ok!({ "id": id })
    });

    app.map_post("/users", |user: Json<User>| async move {
        ok!(user.0)
    });

    app.run().await
}
```

Three things this shows and every volga app repeats:

* `App::new()` is a **builder returning `Self`**; `map_get` and friends take
  `&mut self`. Configuration comes first, in a chain, then routes.
* Handler parameters are extractors resolved from the request. A bare
  `id: u64` is the first path segment placeholder, in pattern order.
* `ok!` and its siblings return `HttpResult` (`Result<HttpResponse, Error>`),
  which is what a handler returns.

Unless told otherwise the server listens on `0.0.0.0:7878` — every
interface — and on `127.0.0.1:7878` on Windows. For anything not meant to be
reachable from the network, `bind` explicitly.

## Non-negotiables

Each one is a real difference between 0.13.x and what older code or an
untrained guess produces.

### 1. Custom headers come after a semicolon

```rust
use volga::{not_found, ok, status};

let id = 42;

ok!("Hello"; [("x-api-key", "k")]);          // correct
status!(401, "Unauthorized"; [("www-authenticate", "Bearer")]);
not_found!(fmt: "no user {}", id; [("x-req-id", "1")]);
```

A **comma** before the header array — `ok!("Hello", [(..)])` — matches the
`format!` arm instead, and fails with "argument never used". This is the
single most common mistake in volga code, including in some older examples.

### 2. `App::new()` builders consume `self`; routing borrows it

```rust
use volga::{App, ok, tls::DevCertMode};

let mut app = App::new()
    .with_cors(|cors| cors.with_any_origin())
    .with_tls(|tls| tls.with_dev_cert(DevCertMode::Auto));

app.use_cors();                     // `use_*` take &mut self
app.map_get("/", || async { ok!() });
app.run().await?;
```

`with_*` returns `App` by value. `use_*`, `map_*`, `add_*`, `wrap`, `with`
and `attach` take `&mut self`. Mixing the two orders does not compile.

### 3. `Path<T>` and `NamedPath<T>` must not be mixed with positional params

One handler picks **one** style for path parameters:

<!-- snippet: skip -->
```rust
|id: u64, name: String| async move { ... }                 // positional, in pattern order
|Path((id, name)): Path<(u64, String)>| async move { ... } // positional tuple
|Path(id): Path<u64>| async move { ... }                   // one type, route declares exactly one (0.13.0+)
|NamedPath(p): NamedPath<Params>| async move { ... }       // named struct, needs Deserialize
```

`Path<T>` is a **tuple**, or a single `FromPathArg` type on a one-parameter
route (mapping it on any other panics since 0.14.0 — see #28); `NamedPath<T>`
is the named-struct one. Reaching for `Path<Params>` with a struct is the
usual slip — it does not compile.
The same distinction makes `ValidNamedPath<T>` (`ValidPath<T>` before
0.14.1) an alias for `Valid<NamedPath<T>>`; a single parameter of your own
type validates as `Valid<Path<T>>`.

A type of your own becomes a path parameter by implementing `FromPathArg`
(0.13.0+) — not `FromStr` alone, not `Deserialize`:

```rust
use volga::{error::Error, ok};
use volga::http::endpoints::args::{FromPathArg, PathArg};

struct OrderId(u64);

impl FromPathArg for OrderId {
    fn from_path_arg(arg: &PathArg) -> Result<Self, Error> {
        arg.parse().map(OrderId) // FromStr; failure -> 400
    }
}

app.map_get("/orders/{id}", |id: OrderId| ok!("order {}", id.0));
```

`uuid::Uuid` is one out of the box with the `uuid` feature (in `full`) and
the `uuid` crate in `Cargo.toml`.

### 4. Bearer auth requires HTTPS and strips the token, by default

```rust
use volga::{App, auth::DecodingKey};

let secret = std::env::var("JWT_SECRET").expect("JWT_SECRET must be set");

App::new().with_bearer_auth(|auth| auth
    .set_decoding_key(DecodingKey::from_secret(secret.as_bytes()))
    .require_https(false)             // needed behind a TLS-terminating proxy
    .strip_token_from_request(false)); // needed if a handler reads Authorization
```

With the defaults, a non-TLS non-loopback request is rejected `400` before
it reaches a handler — the classic "works locally, 400 everywhere" report —
and the `Authorization` header is gone by the time a handler runs. Both are
deliberate; turn them off knowingly, not by accident.

### 5. `with_aud` and `with_iss` make their claims required

Configuring audiences rejects tokens that carry no `aud` at all. Call
`without_strict_aud()` to accept them. Since 0.13.3 `with_iss` does the same
for `iss`, with no opt-out: a token without `iss` is `401`. Leave `with_iss`
out when tokens that must pass do not carry one. An empty set is a no-op
for both.

### 6. The `with_default_*` helpers are gone

| Removed | Replacement |
|---|---|
| `App::with_default_cors()` | `.set_cors(CorsConfig::default())` |
| `App::with_default_tracing()` | `.set_tracing(TracingConfig::default())` |
| `TlsConfig::with_hsts_preload()` and the other `with_hsts_*` shortcuts | `.with_hsts(\|h\| h.with_preload())` |
| `problem!` macro | `volga::error::Problem` |

`App::with_default_config()` **does** still exist — it is config-file
discovery, not a defaults helper.

### 7. On/off builders take no arguments

`with_credentials()`, `with_preload()`, `with_sub_domains()`,
`with_vary_header()`, `with_accept_unmasked_frames()` enable; the paired
`without_*()` disable. None of them takes a `bool` any more.

### 8. `use_cors()` without `with_cors(...)` panics at startup

Configuration and activation are separate everywhere in volga
(`with_cors` / `use_cors`, `with_oauth` / `use_oauth`,
`with_token_bucket` / `use_token_bucket`). A **named** policy additionally
needs `cors_with("name")` on the route or group — configuring only a named
policy and expecting it globally is silent, not an error.

### 9. `Error::status()` is a method

`error.status` as a field, and `error.instance`, stopped being public in
0.9.0. Use `error.status()` / `error.instance()`.

### 10. `jsonwebtoken` is not in the public API

`EncodingKey`, `DecodingKey` and `Algorithm` are volga's own types at
`volga::auth::*`. `jsonwebtoken::ErrorKind`, `EncodingKey::from_rsa_der`
and friends are unreachable — use volga's constructors: `from_secret`,
`from_base64_secret`, `from_rsa_pem` / `from_ec_pem` / `from_ed_pem`,
`from_pem_file`, `from_file`, `from_env`, `from_env_base64`.
`DecodingKey::from_jwk` exists again since 0.13.2, as volga's own: it takes
one key as JSON **text** (`&str`), not a `jsonwebtoken::jwk::Jwk`.

### 11. `run_blocking()` must not run inside a Tokio runtime

It builds its own. Inside `#[tokio::main]`, use `run().await`.

### 12. `bind()` reports a bad address instead of guessing

Since 0.9.7 an address that cannot be resolved is an `io::Error` out of
`run()` — never a silent fallback to `0.0.0.0:7878`. Host names,
unbracketed IPv6 (`::1:7878`) and zone-scoped IPv6 are all accepted and
resolved when the server starts.

### 13. `map_static_assets` is `use_static_assets`, and files answer before routes

Since 0.10.0 the static file server is middleware, not routing.
`map_static_assets()` no longer exists — the call is `use_static_assets()`,
and `use_static_files()` (mount + fallback file) keeps its name. Where you
put the call is where it sits in the pipeline: after `use_compression()` and
`use_cors()`, before anything that should not run for a file. A `GET` or
`HEAD` whose target names a file on disk is answered by the mount before
routing sees it.

### 14. Global middleware runs for requests that match no route

Since 0.10.0 a `404` and a `405` travel through the global chain. A global
`filter`, an early-returning `with`, or `authorize` now decides those
requests — a global authorizer answers `401` where the router used to answer
`404` — and a global rate limiter **counts** them. `ctx.matched_route()` is
how middleware tells a matched request from an unmatched one.

### 15. A route group is a scope, and `without_implicit_head` is gone

A group applies its middleware, CORS policy and OpenAPI config to every
route it registered, whatever the order inside the closure — a route mapped
above `g.authorize(..)` used to escape it and no longer does. `HEAD` is
answered by the `GET` route itself rather than by a second bare route, so it
now travels through that route's middleware; `App::without_implicit_head()`
is removed. Two routes that reach one position under **different parameter
names** panic at registration when they are the same verb, or a `GET` and a
`HEAD`.

### 16. A rejected bearer token is `401`, not `403`

Since 0.10.1 a token that fails validation — expired, wrong signature,
malformed, wrong `iss` / `aud` / `sub`, missing a required claim, not even
decodable — is answered `401` with `invalid_token`. `403` is left to the one
case RFC 6750 gives it: a **valid** token that lacks the role or permission
the route asks for, answered with `insufficient_scope`. A credential that is
not a bearer value at all is `400`, and a validation that could not complete
(an unreadable verification key, an unreachable issuer) is `503`.

Never write a test, a client refresh trigger or an alert that expects `403`
from an expired token.

### 17. An unresolvable DI graph stops the app at startup

Since 0.10.1 `App::run()` validates the container before it binds anything
and returns an `Err` naming every cycle and every missing registration at
once. A service that nobody registered used to surface as a `500` on the
first request that resolved it.

A hand-written `impl Inject` declares nothing by default, so it is left out
of that check — override `dependencies` to put it in:

<!-- snippet: skip -->
```rust
use volga::di::{Container, Dependencies, Inject, error::Error};

impl Inject for Repo {
    fn inject(container: &Container) -> Result<Self, Error> {
        Ok(Self { cache: container.resolve::<Cache>()? })
    }

    fn dependencies(deps: &mut Dependencies) {
        deps.add::<Cache>();
    }
}
```

A factory declares its own arguments, so `add_scoped_factory(|c: Dc<Cache>| ..)`
needs nothing extra. A cycle reached at resolution time panics naming the
path, `A -> B -> A`, instead of deadlocking a worker thread (scoped) or
aborting the process (transient).

Since 0.14.0 the same check covers handlers and middleware — see #29.

### 18. `#[http_header]` takes a unit struct, `#[derive(Claims)]` a struct

Both used to compile and ignore what they were given. Since 0.10.1:

* `#[http_header("x-api-key")] struct ApiKey;` — a field on that struct is
  an error. The value lives in `Header<T>`, never in `T`.
* `#[derive(Claims)]` on an enum or a union is an error. It expanded to an
  empty `AuthClaims` impl before, so every authorizer silently said no.

### 19. A synchronous handler runs on the worker — blocking work goes in `blocking`

Since 0.11.0 a handler (and `filter` / `map_ok` / `map_err` / `tap_req`)
with nothing to await may be a plain `fn` or closure:
`app.map_get("/sum/{x}/{y}", |x: i32, y: i32| x + y)`. It runs inline on the
runtime worker polling the request. Anything that actually blocks —
`std::fs`, `std::thread::sleep`, a synchronous DB driver, heavy CPU — must be
wrapped:

```rust
use volga::{HttpResult, blocking, ok};

app.map_get("/reports/{id}", blocking(|id: u32| -> HttpResult {
    ok!(std::fs::read_to_string(format!("reports/{id}.txt"))?)
}));
```

`blocking` is not cancelled with the request; a long body checks a
`CancellationToken`. `with`, `wrap` and `attach` stay async. Code that spells
handler generics out needs one more `_` for the shape marker:
`map_get::<_, _, (i32,), _>`.

### 20. A catch-all value is not a safe file path

`{*path}` (0.11.0+) binds the rest of the path **unnormalized** — `..`
included. Never `Path::new(root).join(path)` it without rejecting `..`,
roots and drive prefixes or canonicalizing and checking the prefix; serve
files with `use_static_files()`. A catch-all must be the last segment, or
mapping panics.

### 21. Endless responses end on the shutdown signal

Since 0.11.0 a graceful shutdown **closes** connections still open when
`with_shutdown_timeout` (default 10 s) runs out. An SSE feed or proxied
stream should take the `ShutdownHandle` extractor and stop on
`shutdown.cancelled()` — `SseStream::new(events.take_until(shutdown.cancelled()))`
— rather than be cut off. The request's `CancellationToken` does not fire
when the shutdown starts.

### 22. The SPA shell answers `GET` and `HEAD`, and a group can own its `404`

Since 0.11.1 the fallback file of `use_static_files()` /
`map_fallback_to_file()` is a `GET` route at the mount's prefix and
`{*path}` below it, not the application's fallback slot:

* another method gets `405` with `Allow: GET,HEAD` — never write a client
  that expects the shell back from a `POST`;
* `map_fallback` and `map_fallback_to_file` coexist; the shell answers
  under the mount's prefix, `map_fallback` outside it. Under a **root**
  mount the shell covers every `GET`, so `map_fallback` is left with
  nothing;
* a route you mapped still answers before the shell.

Give an API served beside a root shell its own fallback, which the router
prefers for being deeper:

```rust
use volga::{http::Uri, not_found, ok};

app.group("/api", |api| {
    api.map_get("/users", || async { ok!("users") });
    // GET /api/uesrs -> this, not the HTML shell
    api.map_fallback(|uri: Uri| async move {
        not_found!("no endpoint at {}", uri.path())
    });
});
app.use_static_files();
```

`RouteGroup::map_fallback` answers any method under its prefix that no
route is mapped at, runs inside the group's middleware and CORS policy,
binds the parameters the prefix declares (read them with `NamedPath<T>`),
and is neither listed nor described in OpenAPI — `ctx.matched_route()`
reads `false` for it. A route still answers first, including `405` for a
method it lacks.

### 23. A handler's `Err` is an error — and a bare string is a `500`

Since 0.12.0 the `Err` of a handler's `Result<T, E>` is converted through
`IntoError` and goes to `map_err` (or the default handler). `E` is `Error`,
`StatusCode`, `(StatusCode, E)`, `io::Error`, `Problem`, a volga error type,
a string, or your own type implementing `IntoError`:

```rust
use volga::{Json, http::StatusCode};

app.map_get("/orders/{id}", |id: u32| -> Result<Json<u32>, (StatusCode, &'static str)> {
    if id == 0 {
        return Err((StatusCode::NOT_FOUND, "no such order"));
    }
    Ok(Json(id))
});
```

* `Err("..")`, `Err(String)` compile and answer **`500`** — always pair a
  client error with its status. `Err(404)` does not compile; use
  `StatusCode::NOT_FOUND`.
* `Err(HttpResponse)` / `Err(Json<T>)` do not compile. A body for an error
  goes on the error: `Error::from_parts(status, None, msg).with_response(Json(body))`.
* An error type implements **`IntoError`, not `From<T> for Error`** — the
  former provides the latter, and writing both is E0119.
* A **filter's** `Err` takes the same types and keeps their status
  (`OAuthError` → `401`/`403`), except that a string answers `400` there.
  A plain `std::error::Error` (`ParseIntError`, `anyhow::Error`) is not
  accepted: `.map_err(|e| (StatusCode::BAD_REQUEST, e))`.

### 24. Path values arrive decoded — never decode them again

Since 0.13.0 the router percent-decodes the path once and every extractor
reads the result: `100%25` is `"100%"`, `a%2Fb` is `"a/b"` in **one**
segment (it never reaches `/a/b`), `+` stays `+`. A path that does not
decode (`%zz`, `%FF`) answers `400` before routing, through `map_err`.

* Don't run `percent_decode` / `urlencoding::decode` on a parameter — a
  second decode fails on `100%` and turns a checked `%2F` into `/`. Check
  the value you were handed; it can already carry `/` and `..`.
* Write literal segments and group / static prefixes as their text:
  `"/files/a b"`, `"/café"`. A percent-escape in a literal —
  `"/files/a%20b"` — **panics** at mapping.
* The raw path is still in the request's `Uri` if you need it.

### 25. Set a body limit where the body is read — and expect `413`

Since 0.13.1 a route group and a single route take their own request body
limit, and the most specific one wins (route → nested group → group →
app). Don't raise the whole application's limit, or call
`App::without_body_limit()`, for the one route that takes uploads:

```rust
use volga::{App, Limit, http::HttpBodyStream, ok};

let mut app = App::new();

app.group("/api", |api| {
    api.with_body_limit(Limit::Limited(64 * 1024));     // &mut self, any order
    api.map_post("/attachments", |_body: HttpBodyStream| async { ok!() })
        .with_body_limit(Limit::Limited(20 * 1024 * 1024));
});
```

* A body over the limit answers **`413 Content Too Large`**, never `400`,
  whichever extractor reads it. A `Content-Length` over the limit fails
  the first read, before any of the body arrives.
* `Limit::Default` means the framework's 5 MB, **not** "inherit the
  group's" — to inherit, set nothing.
* `without_body_limit()` belongs only on a route that streams and counts
  the bytes itself, never on one that collects the body into memory.

### 26. Issuer unreachable from the server — keep `with_issuer`, add `with_jwks_uri`

When tokens name an issuer the server cannot reach (`localhost` from inside
a container, a public ingress host from inside a cluster), don't point
`with_issuer` at the internal URL — every token is then rejected for its
`iss`, and discovery fails too, since the metadata's `issuer` must equal the
URL it came from. Since 0.13.2 keep the issuer as tokens name it and say
where the keys are:

```rust
let mut app = App::new()
    .with_oauth(|oauth| oauth
        .with_issuer("http://localhost:8787")                     // = `iss`
        .with_jwks_uri("http://host.docker.internal:8787/jwks")   // keys, no discovery
        .with_client_config(|client| client.require_https(false))); // plain http
app.use_oauth();
```

* `with_issuer` stays **required**; caching, refresh on an unknown `kid`,
  `with_max_key_age`, the stale set and the `503` work as with discovery.
* The transport policy covers the `jwks_uri` — an `http://` URL needs
  `require_https(false)`, or every fetch fails and protected routes `503`.
* For a static key the issuer publishes as a JWK,
  `DecodingKey::from_jwk(json)` with `with_alg(..)` — but it does not follow
  rotations; prefer `with_oauth` when the issuer rotates.

### 27. `with_alg` names the whole list, and the key must fit it

The default is `HS256` with an HMAC secret. Since 0.13.3 the **first**
`with_alg` replaces it and later ones add; `encode` signs with the first.

```rust
use volga::{App, auth::{Algorithm, DecodingKey, EncodingKey}};

App::new().with_bearer_auth(|auth| auth
    .set_encoding_key(EncodingKey::from_pem_file("/etc/volga/es256.pem"))
    .set_decoding_key(DecodingKey::from_pem_file("/etc/volga/es256.pub.pem"))
    .with_alg(Algorithm::ES256));   // replaces HS256; `encode` signs ES256
```

* Families: `HS*` — HMAC secret; `RS*` / `PS*` — RSA key; `ES256` /
  `ES384` — EC key; `EdDSA` — Ed25519 key. The decoding key must fit
  **every** listed algorithm, the encoding key the **first**. A key that
  does not makes `App::run` return `Err` at startup, naming the key and the
  algorithms — typically an RSA / EC / Ed25519 key with no `with_alg`,
  which leaves `HS256`. One decoding key means one family per list.
* `with_alg(Algorithm::HS512)` alone refuses `HS256` tokens. To accept both
  — rotating from one to the other — name both, the one to issue first.
* Issuer-based validation (`with_oauth` + `use_oauth`) needs no `with_alg`:
  each token is checked with the algorithm the JWKS gives its key.

### 28. A handler reads only the path parameters its route declares

A positional parameter takes the next `{..}` of its route. Since 0.14.0 a
handler reading more than the route (and its group prefix) declares
**panics where it is mapped**, naming the route — it used to start and
answer `500` on every request:

```rust
use volga::{Query, ok};
use serde::Deserialize;

// `app.map_get("/sum", |x: i32, y: i32| ..)` panics here
app.map_get("/sum/{x}/{y}", |x: i32, y: i32| ok!(x + y));

#[derive(Deserialize)]
struct Operands { x: i32, y: i32 }

app.map_get("/sum", |q: Query<Operands>| ok!(q.x + q.y));

// `Option<T>` reads `None` where no parameter is left
let posts = |page: Option<u32>| ok!("{page:?}");
app.map_get("/posts", posts);
app.map_get("/posts/{page}", posts);
```

* Counted: positional parameters and `Path<T>` — a tuple of `N` needs at
  least `N`, a single type exactly one. Reading fewer is fine.
* `Option<T>` and `Result<T, Error>` opt out.
* Checked: `map_*` of the app and of a group, `map_ws`, `map_msg`,
  `map_fallback`, a group's fallback against its prefix. Not checked:
  `NamedPath<T>`, middleware.
* A `FromPathArgs` type of your own states what it reads in
  `const ARITY: RangeInclusive<usize>`; the default takes any number.

### 29. `Dc<T>` is read-only, and every `Dc<T>` must be registered

`Dc<T>` derefs to `&T` only since 0.14.0 — a singleton is shared by every
request, a scoped service by its request, so `DerefMut` used to change a
private copy nobody else saw. State that changes lives behind a `Mutex`,
an `RwLock` or an atomic inside `T`; `Dc::cloned()` gives a private copy.

`App::run()` also returns `Err` when a handler or middleware takes `Dc<T>`
of a `T` nobody registered (`` `T` is not registered, and is resolved by
`GET /x` ``). `Option<Dc<T>>` opts out; `Result<Dc<T>, Error>` does not.
`wrap`, `attach` and `HttpContext::resolve` resolve at run time and are not
checked.

```rust
use volga::{di::Dc, ok};
use std::sync::atomic::{AtomicU64, Ordering};

#[derive(Default)]
struct Counter { hits: AtomicU64 }

struct Metrics;

app.add_singleton(Counter::default());

app.map_post("/hit", |counter: Dc<Counter>| async move {
    // `counter.hits += 1` through `Dc` no longer compiles (E0594)
    counter.hits.fetch_add(1, Ordering::Relaxed);
    ok!()
});

// starts whether `Metrics` is registered or not
app.map_get("/metrics", |metrics: Option<Dc<Metrics>>| async move {
    ok!(metrics.is_some())
});
```

## Checklist before handing code back

- [ ] Every custom-header array is preceded by `;`, not `,`
- [ ] `let mut app` and configuration chained before the first `map_*`
- [ ] Every optional API used is covered by a feature in `Cargo.toml`
- [ ] Each `with_*` that needs it has its matching `use_*`
- [ ] No `.unwrap()` in a handler — return `HttpResult` and use `?`
- [ ] `use_static_assets()`, not `map_static_assets()`; the mount is registered where it belongs in the pipeline
- [ ] Global middleware that should not see unmatched requests checks `ctx.matched_route()`
- [ ] Nothing expects `403` from a token that failed validation — that is `401`
- [ ] A hand-written `impl Inject` declares what it resolves in `dependencies`
- [ ] No synchronous handler does blocking I/O or sleeps outside `blocking`
- [ ] A catch-all value joined onto a directory is checked for `..` and absolute paths
- [ ] Endless streams stop on `ShutdownHandle::cancelled()`
- [ ] Nothing expects the SPA shell back from a non-`GET` request — that is `405`
- [ ] An API mounted beside a root shell has its own `RouteGroup::map_fallback`
- [ ] No handler or filter returns `Err` of a bare string for a client error — pair it with a `StatusCode`
- [ ] Error types implement `IntoError`, never `From<T> for Error`; bodies for errors go through `with_response`
- [ ] Path parameters of your own types implement `FromPathArg`; `Path<T>` of a single type only on a one-parameter route
- [ ] No handler percent-decodes a path parameter itself, and no literal segment or prefix is written with a `%XX` escape
- [ ] A large body limit is set on the route or group that needs it, not on the whole app; nothing expects `400` for a body over the limit — that is `413`
- [ ] `with_issuer` is the `iss` tokens carry, never an internal URL; an unreachable issuer gets `with_jwks_uri`, and an `http://` one `require_https(false)`
- [ ] A static RSA / EC / Ed25519 key comes with `with_alg` of its family; the algorithm `encode` should sign with is named first, and `HS256` is named explicitly if it must still be accepted
- [ ] `with_iss` is set only where every token that must pass carries `iss`
- [ ] Every path parameter a handler reads is declared by its route or group prefix; an optional one is `Option<T>`
- [ ] Nothing writes through `Dc<T>` — changing state is behind a `Mutex` / `RwLock` / atomic inside the service
- [ ] Every `Dc<T>` a handler or middleware takes is registered, or taken as `Option<Dc<T>>`
- [ ] Nothing matches on the text of a `413` or of a filter's `400` — match on the status
- [ ] The 0.14.1 names: `with_cache_control` on a route or group, `map_problem()`, `ValidNamedPath<T>` — the old ones are deprecated and fail `clippy -D warnings`
- [ ] `cargo clippy --all-targets` and `cargo fmt --check` are clean
