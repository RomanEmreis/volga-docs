# Feature Flags

Volga is split into Cargo features, so an application compiles only what it uses. By default only `http1` is on: routing, handlers, extractors, response macros and error handling work, and everything else (middleware, DI, cookies, TLS and so on) needs its feature.

## Where to Start

While you are learning or prototyping, turn on `full`:

```toml
[dependencies]
volga = { version = "0.15", features = ["full"] }
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
```

Every example on this site compiles with that set unless its page says otherwise. Once the application settles, replace `full` with the features it actually uses: fewer dependencies, faster builds.

::: tip If a method is missing
`no method named wrap found for struct App` (or `add_singleton`, `use_cors`, `map_ws`…) almost always means the feature is off. Find the method in the table below and turn its feature on.
:::

## The Features

| Feature | Enables | In `full` |
|---|---|---|
| `http1` | the HTTP/1 server (on by default) | yes |
| `http2` | the HTTP/2 server; with `http1` too, the protocol is negotiated | yes |
| `middleware` | `wrap`, `with`, `filter`, `map_ok`, `tap_req`, `attach`, [CORS](/volga-docs/en/middleware-infrastructure/cors.html) | yes |
| `di` | [dependency injection](/volga-docs/en/advanced-patterns/di.html): `add_singleton`, `add_scoped`, `Dc<T>` | yes |
| `config` | [configuration files](/volga-docs/en/middleware-infrastructure/config-files.html) | yes |
| `tls` | [HTTPS](/volga-docs/en/protocols-realtime/https.html), HSTS, HTTPS redirection | yes |
| `tracing` | [tracing](/volga-docs/en/reliability-observability/tracing.html) integration | yes |
| `ws` | [WebSockets](/volga-docs/en/protocols-realtime/ws.html) | yes |
| `multipart` | `Multipart` uploads and responses | yes |
| `openapi` | [OpenAPI](/volga-docs/en/middleware-infrastructure/openapi.html) document and UI | yes |
| `problem-details` | [Problem Details](/volga-docs/en/reliability-observability/errors.html#problem-details) (RFC 9457) | yes |
| `rate-limiting` | [Rate Limiting](/volga-docs/en/middleware-infrastructure/rate-limiting.html) | yes |
| `static-files` | [static files](/volga-docs/en/middleware-infrastructure/static-files.html) | yes |
| `compression-full` | [response compression](/volga-docs/en/middleware-infrastructure/compression.html): brotli, gzip, deflate, zstd | yes |
| `decompression-full` | [request decompression](/volga-docs/en/middleware-infrastructure/decompression.html) | yes |
| `cookie-full` | [cookies](/volga-docs/en/requests-responses/cookie.html), signed and private ones included | yes |
| `auth` | [Basic and Bearer (JWT) authentication](/volga-docs/en/security-access/auth.html), `authorize` | yes |
| `oauth-client` | bearer tokens validated against an [OAuth 2.1 / OIDC issuer](/volga-docs/en/security-access/oauth.html) | yes |
| `validation-derive` | `#[derive(Validate)]` for [validation](/volga-docs/en/requests-responses/validation.html) | yes |
| `uuid` | `uuid::Uuid` as a [path parameter](/volga-docs/en/getting-started/route-params.html#uuid) | yes |
| `jwt-derive` | `#[derive(Claims)]`; `auth-full` is `auth` plus this | no |
| `macros` | the `#[http_header]` attribute for [custom headers](/volga-docs/en/requests-responses/headers.html) | no |
| `dev-cert` | self-signed [development certificates](/volga-docs/en/protocols-realtime/https.html#use-development-certificates) | no |
| `test` | [`TestServer`](/volga-docs/en/reliability-observability/testing.html) for integration tests | no |

Several features have finer parts: `compression-gzip`, `compression-brotli` and `compression-zstd` instead of `compression-full`; `cookie`, `signed-cookie` and `private-cookie` instead of `cookie-full`; `basic-auth` and `jwt-auth` instead of `auth`. Their pages list them.

Features add up, so the ones outside `full` go next to it:

```toml
[dependencies]
volga = { version = "0.15", features = ["full", "auth-full", "macros"] }

[dev-dependencies]
volga = { version = "0.15", features = ["test"] }
```
