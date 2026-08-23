# Upgrading and troubleshooting

Symptom-first. If code that "used to work" stopped compiling, or a request
is rejected for no obvious reason, look here before rewriting anything.

## Compile errors

| Error | Cause | Fix |
|---|---|---|
| `argument never used` on an `ok!` / `status!` call | headers passed after a comma | use `;` before the header array |
| `no method named map_get found for struct App` | `App` bound without `mut`, or a `with_*` called after routing | `let mut app = App::new()...;` then routes |
| `cannot find derive macro Claims` | `jwt-derive` is not enabled (`full` does not include it) | add `jwt-auth-full` or `auth-full` |
| `cannot find attribute http_header` | `macros` is not enabled | add `macros` |
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
| `403` with a detailed challenge | the token was parsed but rejected |
| `503` from a protected route | issuer-based validation and no JWKS has ever loaded |
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

## Version-by-version

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
