---
name: volga
description: Build, review and debug HTTP services in Rust with the volga web framework — routing, extractors, response macros, middleware, dependency injection, JWT/OAuth 2.1 auth, input validation, rate limiting, TLS, WebSockets, SSE, configuration, graceful shutdown and testing. Use whenever Rust code depends on `volga`, whenever the task is to write or change a volga handler, middleware or `App` setup, and when upgrading such code across volga versions.
license: MIT
metadata:
  volga-version: "0.10.1"
  msrv: "1.90"
  edition: "2024"
  docs: "https://romanemreis.github.io/volga-docs/"
  api-reference: "https://docs.rs/volga"
---

# volga — HTTP services in Rust

`volga` is an explicit, composable web framework on top of Tokio and hyper.
An `App` owns the router, the DI container, the middleware pipeline and the
server configuration. Handlers are plain async functions or closures whose
arguments are extractors and whose return value is anything that implements
`IntoResponse`.

**This skill describes volga 0.10.x.** The 0.9 line changed security
defaults and removed a set of `with_default_*` helpers; 0.10.0 rebuilt how
requests reach middleware, renamed the static file mount and made route
groups a real scope; 0.10.1 moved a rejected bearer token from `403` to
`401` and made a dependency graph that cannot resolve refuse to start. The
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
| `volga = "0.10"` or `"0.10.1"` | This skill applies as written — a caret requirement resolves to the newest 0.10.x |
| `volga = "0.10.0"` pinned exactly | Same API, three different answers at runtime: a rejected token is answered `403` rather than `401`, a missing DI registration fails the first request instead of the start, and the shell's `ETag` comes from its metadata. Nothing has to change to upgrade |
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
| Routes, groups, path/query/JSON/form/file/multipart/header/cookie/raw-body extraction | `references/routing.md` |
| Validating an extracted payload — `Validate`, `Valid<E>`, `#[derive(Validate)]`, `ValidationError` | `references/validation.md` |
| Returning a response, status codes, streaming, errors, Problem Details | `references/responses.md` |
| `with` / `wrap` / `attach` / `filter` / `tap_req` / `map_ok` / `map_err`, CORS, compression, static files, rate limiting | `references/middleware.md` |
| Dependency injection, lifetimes, configuration files, hot reload | `references/di-config.md` |
| Basic auth, JWT, authorizers, OAuth 2.1 / OIDC, DPoP, machine-to-machine grants, TLS, HSTS | `references/security.md` |
| WebSockets, WebSocket-over-HTTP/2, Server-Sent Events | `references/realtime.md` |
| Feature flags, tracing, cancellation, graceful shutdown, OpenAPI, tests, deployment | `references/operations.md` |
| A compile error on code that "used to work", or upgrading from 0.9.x / 0.8.x | `references/migration.md` |

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

Each one is a real difference between 0.10.x and what older code or an
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
|NamedPath(p): NamedPath<Params>| async move { ... }       // named struct, needs Deserialize
```

`Path<T>` is a **tuple**; `NamedPath<T>` is the named-struct one. Reaching
for `Path<Params>` with a struct is the usual slip. The same distinction
makes `ValidPath<T>` an alias for `Valid<NamedPath<T>>` — a tuple is not a
type your crate can implement `Validate` for.

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

### 5. `with_aud` makes `aud` a required claim

Configuring audiences rejects tokens that carry no `aud` at all. Call
`without_strict_aud()` to accept them.

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
`volga::auth::*`. `jsonwebtoken::ErrorKind`, `DecodingKey::from_jwk`,
`EncodingKey::from_rsa_der` and friends are unreachable — use the
`from_secret` / `from_pem` / `from_base64` / `from_env` / `from_file`
constructors instead.

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

### 18. `#[http_header]` takes a unit struct, `#[derive(Claims)]` a struct

Both used to compile and ignore what they were given. Since 0.10.1:

* `#[http_header("x-api-key")] struct ApiKey;` — a field on that struct is
  an error. The value lives in `Header<T>`, never in `T`.
* `#[derive(Claims)]` on an enum or a union is an error. It expanded to an
  empty `AuthClaims` impl before, so every authorizer silently said no.

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
- [ ] `cargo clippy --all-targets` and `cargo fmt --check` are clean
