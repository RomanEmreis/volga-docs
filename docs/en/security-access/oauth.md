# OAuth 2.1 & OpenID Connect

Volga ships a full OAuth 2.1 / OpenID Connect foundation on top of its [Bearer Token authentication](./auth.md). It lets you build **resource servers** that validate tokens against an OAuth 2.1 / OIDC issuer's published keys — with no shared secret — and **serve the discovery metadata documents** clients need to start a flow.

The protocol-level types (error models, metadata documents, the `WWW-Authenticate` challenge builder, well-known URL derivation) live under [`volga::auth::oauth`](https://docs.rs/volga/latest/volga/auth/oauth/index.html) and are shared with the standalone [OAuth client](./oauth-client.md).

## Feature flags

| Feature | What it enables |
|---|---|
| `oauth` | OAuth 2.1 / OIDC foundation types at `volga::auth::oauth` and metadata serving (implied by `jwt-auth`). |
| `oauth-client` | Issuer-based bearer validation — `App::with_oauth` / `App::use_oauth`. Implies `jwt-auth`. |

```toml
[dependencies]
volga = { version = "...", features = ["oauth-client"] }
```

## Validating Tokens Against an Issuer

Instead of configuring a static [`DecodingKey`](https://docs.rs/volga/latest/volga/auth/decoding_key/struct.DecodingKey.html), you can point bearer authentication at an OAuth 2.1 / OIDC issuer. Volga fetches the issuer's server metadata (RFC 8414, with an OpenID Connect Discovery fallback) and the JSON Web Key Set it advertises, then validates incoming JWTs keyed by each token's `kid`.

Describe the issuer with [`with_oauth(...)`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.with_oauth) and activate it explicitly with [`use_oauth()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.use_oauth):

```rust compile
use serde::Deserialize;
use volga::{
    App, ok,
    auth::{AuthClaims, roles},
};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new()
        // audience, expiry and the other token checks stay here
        .with_bearer_auth(|auth| auth.with_aud(["https://api.example.com"]))
        // the keys and the `iss` constraint come from the issuer
        .with_oauth(|oauth| oauth.with_issuer("https://auth.example.com"));

    // explicit opt-in — nothing validates against the issuer until this call
    app.use_oauth();

    app.map_get("/protected", protected)
        .authorize::<Claims>(roles(["admin"]));

    app.run().await
}

async fn protected() -> &'static str {
    "Hello from the protected route!"
}

#[derive(Clone, Deserialize)]
struct Claims {
    role: String,
}

impl AuthClaims for Claims {
    fn role(&self) -> Option<&str> {
        Some(&self.role)
    }
}
```

With issuer-based validation no static decoding key is required — the keys are resolved at runtime. Everything else (`aud`, expiry, scopes and roles) keeps coming from [`with_bearer_auth`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.with_bearer_auth).

::: info
The `iss` claim is constrained to the configured issuer automatically and made **required** — tokens omitting it, or carrying a different issuer, are rejected.
:::

### Key lifecycle

Keys are fetched lazily on the first request and cached, so token validation costs no network round-trip in the common case. The cache maintains itself:

* A token with an **unknown `kid`** triggers a refresh (key rotation), rate-limited by [`with_refresh_cooldown`](https://docs.rs/volga/latest/volga/auth/oauth_client/struct.OAuthConfig.html#method.with_refresh_cooldown) (default 60 s); concurrent misses share a single refresh.
* Known `kid`s are **re-checked** with the issuer once the cached set is older than [`with_max_key_age`](https://docs.rs/volga/latest/volga/auth/oauth_client/struct.OAuthConfig.html#method.with_max_key_age) (default 15 minutes), so a revoked or re-keyed `kid` stops validating without a restart.
* While the issuer is **unreachable** and keys were already loaded, the last known set keeps serving — an issuer outage does not take token validation down with it. When no keys have ever loaded, protected routes answer `503` (a server-side problem) rather than blaming the token.

### Configuration

The issuer is mandatory; everything else has production-safe defaults.

```rust compile-fragment
use std::time::Duration;
use volga::App;

let app = App::new()
    .with_bearer_auth(|auth| auth.with_aud(["https://api.example.com"]))
    .with_oauth(|oauth| oauth
        .with_issuer("https://auth.example.com")
        .with_refresh_cooldown(Duration::from_secs(30))
        .with_max_key_age(Duration::from_secs(600))
        // discovery / JWKS transport policy
        .with_client_config(|client| client.require_https(true)));
```

For a local development issuer served over plain HTTP, relax the transport policy:

```rust compile-fragment
let app = App::new()
    .with_oauth(|oauth| oauth
        .with_issuer("http://127.0.0.1:5000")
        .with_client_config(|client| client.require_https(false)));
```

With the `config` feature the same knobs can be described in the `[oauth.client]` section of the configuration file — fields present in the file override the builder calls, unknown keys fail startup, and activation still requires the explicit `App::use_oauth()` call in code:

```toml
[oauth.client]
issuer = "https://auth.example.com"
refresh_cooldown_secs = 60   # optional
max_key_age_secs = 900       # optional
require_https = true         # optional
timeout_secs = 30            # optional
max_redirects = 5            # optional
```

## Serving Metadata Documents

A resource server tells clients where to authenticate; an authorization server publishes its endpoints and keys. Volga serves both discovery documents from your application.

### Protected Resource Metadata (RFC 9728)

Configure it with [`with_oauth_resource_metadata`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.with_oauth_resource_metadata) (or [`set_oauth_resource_metadata`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.set_oauth_resource_metadata) for the whole value, including the `&str` identifier shorthand) and serve it with [`use_oauth_resource_metadata`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.use_oauth_resource_metadata):

```rust compile-fragment
let mut app = App::new()
    .with_oauth_resource_metadata(|metadata| metadata
        .with_resource("https://api.example.com")
        .with_authorization_servers(["https://auth.example.com"])
        .with_scopes(["read", "write"])
        .with_bearer_methods(["header"]));

// GET /.well-known/oauth-protected-resource
app.use_oauth_resource_metadata();
```

When bearer authentication is configured, the derived metadata URL is advertised automatically in `WWW-Authenticate` challenges (RFC 9728 §5.1), so an unauthenticated client can discover where to authenticate and start a flow.

### Authorization Server Metadata (RFC 8414) & OIDC Discovery

Applications that are themselves an authorization server publish their endpoints via [`with_oauth_server_metadata`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.with_oauth_server_metadata) and serve the document at one or both discovery paths:

```rust compile-fragment
let mut app = App::new()
    .with_oauth_server_metadata(|metadata| metadata
        .with_issuer("https://auth.example.com")
        .with_authorization_endpoint("https://auth.example.com/authorize")
        .with_token_endpoint("https://auth.example.com/token")
        .with_jwks_uri("https://auth.example.com/jwks"));

// authorization servers commonly publish the same document at both paths:
app.use_oauth_server_metadata()  // GET /.well-known/oauth-authorization-server
   .use_oidc_metadata();         // GET /.well-known/openid-configuration
```

::: tip
The server-metadata closure is seeded with the OAuth 2.1 prefills `response_types_supported = ["code"]` and `grant_types_supported = ["authorization_code"]`. OIDC-specific fields required by a compliant provider document (`subject_types_supported`, `id_token_signing_alg_values_supported`, `userinfo_endpoint`, …) can be supplied through [`with_additional_field(...)`](https://docs.rs/volga/latest/volga/auth/oauth/struct.AuthorizationServerMetadata.html#method.with_additional_field).
:::

Two fields worth naming explicitly became typed builders in **v0.9.6** and **v0.9.8**:

```rust compile-fragment
let mut app = App::new()
    .with_oauth_server_metadata(|metadata| metadata
        .with_issuer("https://auth.example.com")
        // RFC 9207: the `iss` parameter is returned in authorization responses,
        // which lets clients detect an authorization server mix-up
        .with_authorization_response_iss_parameter(true)
        // RFC 9449: the algorithms accepted in DPoP proofs
        .with_dpop_signing_algs(["ES256"]));
```

Announcing RFC 9207 support makes it **mandatory** for clients: a `volga-oauth-client` [callback validation](/volga-docs/en/security-access/oauth-client.html#validating-the-callback) then rejects a response that carries no `iss`. `with_authorization_response_iss_parameter` is also accepted in the `[oauth.server]` config file section. See [DPoP](/volga-docs/en/security-access/dpop.html) for the client half of the second one; the resource-side `dpop_signing_alg_values_supported` is available on [`ProtectedResourceMetadata`](https://docs.rs/volga/latest/volga/auth/oauth/struct.ProtectedResourceMetadata.html) under the same name.

Both documents can also come from the `[oauth.resource]` / `[oauth.server]` sections of the configuration file (the `config` feature); the file overrides prior builder calls. The `set_*` shorthand configures a minimal document from the identifier alone:

```rust compile-fragment
let mut app = App::new()
    .set_oauth_resource_metadata("https://api.example.com")
    .set_oauth_server_metadata("https://auth.example.com");

app.use_oauth_resource_metadata();
app.use_oauth_server_metadata().use_oidc_metadata();
```

## The Full Flow

Putting the pieces together, a resource server needs only a handful of lines — token validation is wired straight to the issuer's published keys, with no secret configured anywhere:

```rust compile
use volga::{App, auth::{AuthClaims, roles}, ok};
use serde::Deserialize;

#[derive(Clone, Deserialize)]
struct Claims { role: String }

impl AuthClaims for Claims {
    fn role(&self) -> Option<&str> { Some(&self.role) }
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new()
        .with_oauth(|oauth| oauth.with_issuer("https://auth.example.com"))
        // advertised in WWW-Authenticate challenges
        .with_oauth_resource_metadata(|m| m
            .with_resource("https://api.example.com")
            .with_authorization_servers(["https://auth.example.com"]));

    app.use_oauth();
    app.use_oauth_resource_metadata();

    app.map_get("/protected", || async { ok!("Hello from the protected route!") })
        .authorize::<Claims>(roles(["admin"]));

    app.run().await
}
```

The client side of the same flow — discovery, the Authorization Code + PKCE exchange and calling the protected route — is covered on the [OAuth 2.1 Client](./oauth-client.md) page.

## Examples
* [OAuth Flow](https://github.com/RomanEmreis/volga/blob/main/examples/oauth_flow/src/main.rs) — a complete Authorization Code + PKCE flow between an authorization server, a resource server and a client, in one process.
* [OAuth Metadata](https://github.com/RomanEmreis/volga/blob/main/examples/oauth_metadata/src/main.rs) — serving the RFC 8414 / RFC 9728 / OIDC discovery documents.
