# Upgrading and troubleshooting

Symptom-first. If code that "used to work" stopped compiling, or a request
is rejected for no obvious reason, look here before rewriting anything.

## Compile errors

| Error | Cause | Fix |
|---|---|---|
| `argument never used` on an `ok!` / `status!` call | headers passed after a comma | use `;` before the header array |
| `no method named map_get found for struct App` | `App` bound without `mut`, or a `with_*` called after routing | `let mut app = App::new()...;` then routes |
| `cannot find derive macro Claims` | `jwt-derive` is not enabled (`full` does not include it) | add `jwt-auth-full` or `auth-full` |
| `cannot find function permission in volga::auth` | it was not re-exported before 0.9.9 | upgrade, or use `volga::auth::authorizer::permission` — **not** `permissions`, which the compiler suggests and which is a different function |
| `cannot find derive macro Validate` | `validation-derive` is not enabled | add it (it *is* in `full`) |
| `cannot find attribute http_header` | `macros` is not enabled | add `macros` |
| `` `#[http_header]` can only be applied to a unit-like struct `` | 0.10.1 enforces it; a field was ignored before | drop the fields — the value lives in `Header<T>` |
| `` `Claims` can only be derived for structs `` | 0.10.1 enforces it; an enum expanded to an empty impl before | derive it on the struct the payload deserializes into |
| `no method named map_static_assets found for struct App` | renamed in 0.10.0 | `use_static_assets()` — there is no route to map any more |
| `no method named without_implicit_head found for struct App` | removed in 0.10.0 | delete the call; a `GET` route answers `HEAD` itself, and mapping `map_head` overrides it |
| `cannot find trait FromRawRequest` | removed in 0.10.0 | `map_fallback` takes `FromRequestParts`, which is the same set |
| a hand-written `impl FallbackHandler` no longer compiles | `call` takes `HttpRequest` instead of `Request<Incoming>` in 0.10.0 | change the argument type |
| `cannot find function with_default_cors` | removed in 0.9.1 | `.set_cors(CorsConfig::default())` |
| `cannot find function with_default_tracing` | removed in 0.9.1 | `.set_tracing(TracingConfig::default())` |
| `cannot find macro problem` | removed in 0.9.2 | `volga::error::Problem::new(..)` |
| `with_hsts_preload` / `with_hsts_max_age` not found | removed in 0.9.1 | `.with_hsts(\|h\| h.with_preload())` |
| `this function takes 0 arguments but 1 was supplied` on `with_credentials` / `with_preload` / `with_sub_domains` / `with_vary_header` / `with_accept_unmasked_frames` | they stopped taking `bool` in 0.9.1 | drop the argument, or call the `without_*` twin |
| `field status of struct Error is private` | fields became methods in 0.9.0 | `error.status()`, `error.instance()` |
| `no function from_jwk` / `from_rsa_der` / `ErrorKind` not found | `jsonwebtoken` left the public API in 0.9.1 | use `from_secret` / `from_pem` / `from_base64` / `from_env` / `from_file` |
| cannot construct `Problem` / `TlsConfig` / `RedirectionConfig` with a struct literal | `#[non_exhaustive]` since 0.9.2 | use the builders |
| non-exhaustive match on `Authorizer`, `Encoding`, `WsEvent`, `OAuthErrorCode` | `#[non_exhaustive]` | add a `_ =>` arm |
| `future cannot be sent between threads safely` | a `std::sync` guard held across `.await` | drop the guard first, or use `tokio::sync` |
| a `TokenSet { .. }` literal misses a field | `dpop_jkt` added in 0.9.8 | add `dpop_jkt: None` for a bearer token |
| `MiddlewareHandler` / `TapReqHandler` / `MapOkHandler` / `MapErrHandler` not found | renamed in 0.8.9 | `With`, `TapReq`, `MapOk`, `MapErr`; the methods are `with`, `tap_req`, `map_ok`, `map_err` |

## Runtime symptoms

| Symptom | Cause |
|---|---|
| every request to a protected route answers `400`, but works locally | `require_https` defaults to on; a proxy terminates TLS. `require_https(false)` |
| a handler cannot read `Authorization` after auth succeeded | `strip_token_from_request` defaults to on |
| valid-looking tokens rejected as missing a claim | `with_aud` made `aud` required. `without_strict_aud()` |
| `401` with a bare `Bearer` challenge | no credentials at all (RFC 6750 §3) |
| `400` with `invalid_request` | the `Authorization` header is present but malformed |
| `401` with `invalid_token` | the token was parsed and rejected — expired, bad signature, wrong claim, or malformed. **`403` before 0.10.1** |
| `403` with `insufficient_scope` | the token is valid but lacks the role or permission the route asks for |
| `503` from a protected route | validation could not complete: issuer-based validation with no JWKS ever loaded, or an unreadable verification key |
| panic at startup: CORS | `use_cors()` without `with_cors(..)`, or credentials combined with a wildcard |
| panic at startup: HSTS | `with_preload()` with `max_age` under one year |
| panic at startup: config | `with_default_config()` and no `app_config.toml` / `.json`, or a required `bind_section` missing |
| panic: `with_max_header_list_size(Limit::Unlimited)` | treated as misconfiguration since 0.9.0 |
| no CORS headers anywhere, no error | only a **named** policy is configured; routes need `cors_with("name")` |
| rate limiting registered but never triggers | `with_*` without the matching `use_*` or per-route call |
| token validation ignores the issuer | `with_oauth(..)` without `app.use_oauth()` |
| OpenAPI configured but nothing served | no `app.use_open_api()` (it logs a warning) |
| `406` on a response | `Accept-Encoding` asked for an algorithm whose feature is off |
| `415` on a request | `Content-Encoding` names an algorithm whose feature is off |
| the server listens on every interface | that is `App::new()`'s default off Windows. `bind` explicitly |
| the process hangs or panics on start | `run_blocking()` called inside a Tokio runtime |
| everything under `/api` 404s after adding a filter | a `filter` returning `false` answers `404` |
| a route that answered `200` now answers `401` / `403` / `429` | 0.10.0: its group's `authorize` / `token_bucket` was registered *after* it and used to be skipped; a group is now a scope |
| a `HEAD` health check that answered `200` now answers `401` / `403` | 0.10.0: `HEAD` travels through the `GET` route's middleware instead of a second bare route |
| an unknown path answers `401` instead of `404` | 0.10.0: global short-circuiting middleware (`filter`, `authorize`, an early-returning `with`) now runs for unmatched requests |
| clients hit the rate limit sooner than before | 0.10.0: a global limiter counts requests that match no route |
| a route stopped answering after `use_static_files()` was added | 0.10.0: a file on disk answers before a route for the same path. Mount under a group prefix |
| static files stopped being compressed, or lost their CORS headers | 0.10.0: the mount sits where it was registered. Call it after `use_compression()` / `use_cors()` |
| `app.group("/{tenant}", \|g\| g.use_static_files())` serves nothing | 0.10.0: a mount matches a literal prefix; the accidental parameter-folding it relied on is gone. It warns at startup |
| `NamedPath<T>` fails to deserialize, or reads `None` for a name in the pattern | 0.10.0: each endpoint binds the names its own pattern was written with, not the first route's through that position |
| panic at registration: `ambiguous route` | one verb naming its own route twice under two parameter names, or a `GET` and a `HEAD` disagreeing. Name them identically or part on a literal segment |
| `GET /` serves a stale `index.html` after a deploy | pre-0.9.11: the shell was served `immutable`. Upgrade, or `with_shell_cache_control(..)` |
| `run()` returns `Err` naming a service, and the server never starts | 0.10.1: the DI graph is validated first. Register what is missing, or break the cycle it names |
| panic: `dependency cycle: A -> B -> A` | 0.10.1 reports at resolution what used to deadlock (scoped) or abort the process (transient) |
| a test's first request is refused | pre-0.10.1 `TestServer` returned before its port was bound |
| a route that answered `404` for a path with a literal prefix now answers | 0.10.1: the lookup backtracks to a parameter when the literal leads nowhere. This is the fix, not a regression |
| every client revalidates `index.html` once after upgrading | 0.10.1: the shell's `ETag` is derived from its bytes. Expected, and one round trip |
| `exclude_hosts` started excluding a host it did not before | 0.10.1: entries match by host name on any port, and config-file entries are normalized |
| an HTTP/2 client finally gets an HTTPS redirect | 0.10.1: the redirect listener serves HTTP/1.1 and HTTP/2, and reads the host from the request target |

## Version-by-version

### 0.10.1 — statuses, startup checks and shutdown
No API break, nothing to opt into, and nothing fails to compile except two
macros that used to accept what they then ignored.

* **A rejected bearer token is `401`, not `403`** (RFC 6750 §3.1
  `invalid_token`), a token that does not decode included — it used to be
  `400`. `403` with `insufficient_scope` is now only a valid token without
  the required role or permission, and a validation that could not complete
  (unreadable key, unreachable issuer) is `503`. Update tests, refresh
  triggers and alerts that expect `403`.
* **`App::run` validates the DI graph** before starting anything and returns
  `Err` on a cycle or a missing registration, naming every problem at once.
  `ContainerBuilder::validate` is the same check by hand;
  `Inject::dependencies` is a new provided method a hand-written `Inject`
  overrides to declare what it resolves. A cycle reached at resolution now
  panics naming `A -> B -> A` instead of deadlocking (scoped) or aborting the
  process (transient).
* **Graceful shutdown actually waits.** It was skipped for every open
  connection when a request was in flight as the accept loop stopped, so
  `run()` returned mid-response. It now waits up to 10 s, then releases the
  app's services.
* **Route lookup backtracks.** `GET /a/{b}` stopped answering `/a/b` once
  `/a/b/c` was mapped; the lookup now returns to the nearest parameter it
  passed over. Literals still win where they lead to a route, and a literal
  with a handler for another method still answers `405`.
* **HTTPS redirection and HSTS read the host properly.** The redirect
  listener serves HTTP/1.1 as well as HTTP/2 (it accepted only HTTP/2 with the
  `http2` feature on), the host comes from the request target before `Host`
  so HTTP/2 works, a request without a usable host is `400` rather than `404`,
  and HSTS `exclude_hosts` match by host name on any port — normalized
  whether they were written in code or read from a config file.
* **The shell's `ETag` comes from its bytes.** New `ETagSource`
  (`Metadata` / `Content`) with `HostEnv::with_asset_etag` /
  `with_shell_etag` and getters; assets stay on `Metadata`, the index and
  fallback files move to `Content`, so every client revalidates them once
  after the upgrade. It fixes two versions of one file colliding on length
  plus whole-second `mtime` — the ordinary case for a content-hashed build
  deployed with pinned timestamps.
* `#[http_header]` rejects a struct with fields and `#[derive(Claims)]`
  rejects enums and unions; both used to compile and ignore what they were
  given. `FromRequest`, `FromRequestRef`, `IntoResponse` and `GenericHandler`
  carry `#[diagnostic::on_unimplemented]`, so a handler that does not fit is
  told which extractors exist instead of failing on a `pub(crate)` bound.
* `TestServer` returns only once its port is bound. DI and middleware got
  materially faster with nothing to change: scope creation 404 ns → 20 ns,
  a singleton resolve 190 ns → 2 ns under 8 threads, one global middleware
  368 ns → 257 ns. A transient resolved through `Container::resolve` is moved
  rather than cloned, so a side-effecting `Clone` / `Drop` runs once less.

### 0.10.0 — routing, middleware and static files
The largest behavioural release of the line. Nothing here is opt-in.

* **Global middleware runs for requests that match no route.** `wrap`,
  `with`, `filter`, `map_ok`, CORS, compression, tracing and **rate
  limiting** were all skipped for a `404` or a `405` and now are not. A
  global authorizer answers `401` where the router answered `404`; a global
  limiter's budget is spent by traffic that never touched it before.
  `HttpContext::matched_route()` tells a matched request from an unmatched
  one. The per-request scope is built for these requests, so `ClientIp`,
  `CancellationToken`, `Config<T>`, `HostEnv` and `Dc<T>` work in a
  fallback; an error out of a fallback goes to the application's `map_err`.
* **Static files are middleware, not routing.** `map_static_assets` →
  `use_static_assets`; `use_static_files` keeps its name. No startup walk,
  no depth ceiling, nothing in the router — so `use_static_assets()` and
  `map_get("/{id}", ..)` coexist. A file answers before a route for the
  same path. Where the call sits in the pipeline is where the mount sits. A
  group prefix must be literal, and a group's CORS policy does not reach
  the files. `static-files` implies `middleware`.
* **A route group is a scope.** Its middleware, CORS policy and OpenAPI
  config apply to every route it registered, whatever the order inside the
  closure — a route mapped above `g.authorize(..)` used to escape it. The
  `must be called before any map_*` warning is gone with the hazard.
* **`HEAD` goes through the `GET` route.** No second bare route, so route
  and group middleware and CORS now apply. `App::without_implicit_head` is
  removed.
* **Parameter names are per-endpoint.** `POST /users/{name}` beside
  `GET /users/{id}` binds `name`, not `id`. Two spellings that cannot be
  told apart — one verb naming its own route twice, or a `GET` and a `HEAD`
  disagreeing — panic at registration.
* **Re-mapping a route replaces it**, middleware included. `/x`, `/x/` and
  `//x` are one route everywhere.
* `FromRawRequest` removed; `FallbackHandler::call` takes an `HttpRequest`.
* `HttpContext::matched_route`, `App::use_static_assets` and
  `RouteGroup::use_static_assets` are the new API surface.

### 0.9.11
`HostEnv::with_asset_cache_control` / `with_shell_cache_control` and the
matching getters: the static file server's `Cache-Control` is configured
by the role of the file. **The index and the fallback file stopped being
served `immutable`** — `GET /` answered `max-age=86400, public, immutable`
and now answers `no-cache`, so a user who reloaded after a deploy no longer
keeps yesterday's shell for a day. Assets are unchanged.
`CacheControl::ASSET` / `SHELL` / `EMPTY` constants, `CacheControl::asset()`
/ `shell()` header presets, `ResponseCaching::with_cache_control`.
Conditional requests on static files were fixed in five ways, all on the
hot path that change creates. Registering a group-level setting after a
route in that group started warning (0.10.0 removed the hazard instead).

### 0.9.10
Static files nested more than one level deep were served
non-deterministically — the handler folded over `HashMap` iteration order,
so `GET /assets/app.css` reached the filesystem as `assets/app.css` or
`app.css/assets` depending on the request. It hit every Vite/webpack/Parcel
build. A `+` in a request target is now the literal character, and a
malformed `%XX` answers `400`.

### 0.9.9
Input validation: the `Validate` trait, the `Valid<E>` extractor with its
`ValidJson` / `ValidQuery` / `ValidForm` / `ValidPath` aliases,
`ValidationError`, `Invalid<E>` and `#[derive(Validate)]` (feature
`validation-derive`, in `full`). Purely additive — see
`references/validation.md`.

`volga::auth::permission` is re-exported alongside `role`, `roles`,
`permissions` and `predicate`; it was the only one of the five missing, so a
copy of the built-in authorizer list did not compile before this.

Fixed: query parameters vanished from the OpenAPI spec for any handler whose
query struct had a typed optional field (`Option<String>`, `Option<u32>`, ...)
— the operation was published with **no** parameters at all. `f32` / `f64` now
publish `format: "float"` / `"double"` instead of a bare `number`.

### 0.9.8
DPoP sender-constrained tokens in the client (RFC 9449). `TokenSet` gained
`dpop_jkt`. `OAuthErrorCode` gained `UseDpopNonce` and `InvalidDpopProof`,
so code matching them as `Other(..)` no longer matches.
`ClientAuthMethod` is no longer `Copy` — the new `PrivateKeyJwt` variant
carries a key. Client authentication is checked against
`token_endpoint_auth_methods_supported` before a token request is sent.

### 0.9.7
`App::bind` no longer swaps an unparseable address for `0.0.0.0:7878` —
that silent substitution could put a loopback-intended server on every
interface. It now reports an `io::Error`. Host names, unbracketed and
zone-scoped IPv6 are accepted and resolved at startup.

### 0.9.5
The `oauth` and `oauth-client` features: issuer-based bearer validation
(`with_oauth` / `use_oauth`), metadata documents (RFC 8414 / 9728 / OIDC),
and the standalone `volga-oauth-client` crate. Missing credentials on a
guarded route changed from `400` to `401` with a challenge.

### 0.9.4
`map_query` for the HTTP `QUERY` verb, the generic `map(method, path, h)`,
and `HttpBody` as an extractor.

### 0.9.3
`ShutdownHandle`, `App::with_shutdown()`, `with_shutdown_signal(..)`,
`shutdown_on(..)`.

### 0.9.2
`Multipart` became bidirectional (`from_parts`, `from_stream`,
`with_subtype`, `with_boundary`, `into_outgoing`, the `Part` builders).
HSTS `max_age` default moved from 30 days to 1 year, and `with_preload()`
now panics below that. `TlsConfig`, `RedirectionConfig` and `Problem`
became `#[non_exhaustive]`. The `problem!` macro was removed. `Problem`
responses now carry `application/problem+json`.

### 0.9.1 — the big one for auth
* `require_https` **on** by default (non-TLS non-loopback → `400`).
* `strip_token_from_request` **on** by default.
* `with_aud` makes `aud` a required claim; `without_strict_aud()` opts out.
* `BearerTokenService::validation()` removed.
* `volga::auth` stopped re-exporting `jsonwebtoken` types; `EncodingKey`,
  `DecodingKey` and `Algorithm` became volga's own at the same paths.
  `ErrorKind`, `from_jwk` and the `*_der` constructors went away; the
  `from_env` / `from_file` / `from_pem_file` families arrived.
* `with_credentials`, `with_vary_header`, `with_preload`, `with_sub_domains`,
  `with_accept_unmasked_frames` lost their `bool` argument and gained
  `without_*` twins.
* `App::with_default_cors()` and `App::with_default_tracing()` removed.
* The `TlsConfig::with_hsts_*` shortcuts removed in favour of
  `with_hsts(|h| ...)`.

### 0.9.0
Header mutation methods return `&mut Self`; `append_header` is infallible.
`Error::status` / `Error::instance` became methods.
`with_max_header_list_size(Limit::Unlimited)` panics.

### 0.8.9
`attach()` and the `Filter` trait. The middleware traits were renamed:
`MiddlewareHandler` → `With` (`call` → `with`), `TapReqHandler` → `TapReq`,
`MapOkHandler` → `MapOk`, `MapErrHandler` → `MapErr`, and `type Future` was
removed from each. CORS, JWT auth and rate limiting were reimplemented on
top of `attach`.

## Upgrading 0.9.x → 0.10.x, in order

1. Bump the version and run `cargo check`. Only four things fail to
   compile: `map_static_assets`, `without_implicit_head`, `FromRawRequest`,
   and a hand-written `impl FallbackHandler`.
2. **Then read the behaviour changes, because nothing else will fail to
   compile.** Walk every route group and check what its middleware now
   reaches: a route mapped above the group's `authorize`, `token_bucket` or
   `cors_with` used to escape it and no longer does.
3. Check every `HEAD` consumer — health checks especially. A `HEAD` behind
   an authorized route now answers `401` / `403`.
4. Audit global middleware for what it does to a `404`. A global `filter`
   or `authorize` now decides unmatched requests, and a global rate limiter
   counts them: re-size the budget against real traffic, not against the
   route count.
5. Move the `use_static_files()` / `use_static_assets()` call to where it
   belongs in the pipeline — after `use_compression()` and `use_cors()`.
   Confirm no route shares a path with a file on disk, since the file now
   wins, and that no group serving files has a parameter in its prefix.
6. Grep for `NamedPath` and any by-name parameter read on a route whose
   pattern shares a position with another verb's. The name it receives is
   now its own pattern's.
7. Start the app. Two spellings that used to be silently merged now panic
   at registration, and the message names both patterns and the fix.

## Upgrading 0.10.0 → 0.10.1

Nothing to rewrite. Check three things instead:

1. Grep tests, clients and alerts for `403` against an expired or malformed
   token — that is `401` now, and `400` is no longer a malformed token.
2. Start the app once. If a service was never registered, or two depend on
   each other, `run()` now says so and refuses to start where it used to
   fail a single route at runtime.
3. Expect one revalidation of `index.html` per client after the deploy, and
   nothing else on the wire.

## Upgrading 0.8.x → 0.9.x, in order

1. Bump the version and run `cargo check`. Work the compile errors with the
   table above — most are mechanical.
2. Audit every `with_*(true)` / `with_*(false)` on CORS, HSTS and
   WebSockets; they are now no-argument on/off pairs.
3. Re-read the bearer auth setup. `require_https` and
   `strip_token_from_request` changed behaviour without changing signatures,
   so nothing will fail to compile — it will fail in staging.
4. Replace `error.status` with `error.status()`.
5. Replace `problem!` with `Problem::new(..)`.
6. Check that nothing constructs `TlsConfig`, `RedirectionConfig` or
   `Problem` by struct literal, and that matches on `Authorizer`,
   `Encoding`, `WsEvent` and `OAuthErrorCode` have a catch-all arm.
7. If `bind` was fed a host name that used to fall back silently, confirm
   the address is what you meant — it is now an error, not a default.
