# Authentication, authorization and TLS

## Feature map

| Feature | Enables |
|---|---|
| `basic-auth` | the `Basic` extractor |
| `jwt-auth` | bearer tokens, `authorize`, `BearerAuthConfig` (implies `oauth`) |
| `jwt-derive` | `#[derive(Claims)]` — **not** in `full` |
| `jwt-auth-full` | `jwt-auth` + `jwt-derive` |
| `auth` | `basic-auth` + `jwt-auth` (in `full`) |
| `auth-full` | `auth` + `jwt-derive` |
| `oauth` | protocol types at `volga::auth::oauth`, metadata serving |
| `oauth-client` | issuer-based validation: `with_oauth` / `use_oauth` |
| `tls` | HTTPS, HSTS, HTTPS redirection |
| `dev-cert` | self-signed development certificates — **not** in `full` |

`full` gives you `auth` but not the `Claims` derive. If a project on `full`
cannot find `#[derive(Claims)]`, the fix is adding `jwt-auth-full` (or
`auth-full`) to the feature list, not changing the code.

## Basic authentication

<!-- snippet: skip -->
```rust
use volga::{HttpResult, auth::Basic, headers::WWW_AUTHENTICATE, ok, status};

async fn protected(auth: Basic) -> HttpResult {
    let (user, pass) = credentials_from_db().await;
    if auth.validate(&user, &pass) {
        ok!("access granted")
    } else {
        status!(401, "Unauthorized"; [
            (WWW_AUTHENTICATE, "Basic realm=\"Restricted area\"")
        ])
    }
}
```

`validate_base64` compares against an already-encoded credential. Both are
constant-time.

## JWT bearer tokens

### Claims

Three ways to declare them, in decreasing order of convenience:

<!-- snippet: skip -->
```rust
// 1. derive (feature jwt-derive)
use volga::auth::Claims;
#[derive(Claims, Serialize, Deserialize)]
struct MyClaims { sub: String, role: String, exp: u64 }

// 2. macro
use volga::auth::claims;
claims! {
    #[derive(Deserialize)]
    struct MyClaims { sub: String, role: String, permissions: Vec<String> }
}

// 3. by hand
use volga::auth::AuthClaims;
impl AuthClaims for MyClaims {
    fn role(&self) -> Option<&str> { Some(&self.role) }
    fn permissions(&self) -> Option<&[String]> { Some(&self.permissions) }
}
```

`exp` is what makes a token expire — omit it and tokens never do.

### Issuing

<!-- snippet: skip -->
```rust
use volga::{App, Json, HttpResult, auth::{BearerTokenService, EncodingKey}, ok, status};

let mut app = App::new().with_bearer_auth(|auth| {
    auth.set_encoding_key(EncodingKey::from_secret(secret.as_bytes()))
});

async fn generate(payload: Json<Login>, bts: BearerTokenService) -> HttpResult {
    if !verify(&payload).await { return status!(401, "invalid credentials"); }
    let exp = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() + 300;
    let token = bts.encode(&MyClaims { sub: payload.user.clone(), role: "admin".into(), exp })?
        .to_string();
    ok!({ "access_token": token })
}
```

Key constructors on both `EncodingKey` and `DecodingKey`:
`from_secret`, `from_base64`, `from_pem`, `from_pem_file`, `from_file`,
`from_env`, `from_env_base64`, each with a `try_*` sibling that returns
`Result` instead of panicking. The panicking forms are meant to run once at
startup.

`jsonwebtoken` types are **not** re-exported — `DecodingKey::from_jwk`,
`EncodingKey::from_rsa_der` and `ErrorKind` do not exist here.

### Validating and authorizing

<!-- snippet: skip -->
```rust
use volga::{App, auth::{DecodingKey, roles}};

let mut app = App::new().with_bearer_auth(|auth| {
    auth.set_decoding_key(DecodingKey::from_secret(secret.as_bytes()))
});

app.map_get("/me", me).authorize::<MyClaims>(roles(["admin", "user"]));

app.group("/admin", |g| {
    g.authorize::<MyClaims>(role("admin"));
    g.map_get("/stats", stats);
});
```

`authorize` works on the `App` (global), a group, or a single route.

Authorizers compose:

<!-- snippet: skip -->
```rust
use volga::auth::{role, roles, permissions, predicate};
use volga::auth::authorizer::permission;   // note: not re-exported at volga::auth

let policy = role("admin")
    .or(roles(["editor", "contributor"]))
    .and(permission("write"));

app.map_post("/posts", create).authorize::<MyClaims>(policy);

// arbitrary logic
predicate(|c: &MyClaims| c.sub.ends_with("@example.com"));
```

### `BearerAuthConfig` defaults that bite

```rust
use volga::{App, auth::DecodingKey};

let key = DecodingKey::from_secret(b"dev-secret");   // note: DecodingKey is not Clone

App::new().with_bearer_auth(|auth| auth
    .set_decoding_key(key)
    .require_https(false)              // default true
    .strip_token_from_request(false)   // default true
    .with_aud(["https://api.example.com"])
    .without_strict_aud()              // aud is required once with_aud is set
    .with_resource("https://api.example.com")          // RFC 8707
    .with_resource_metadata_url("https://api.example.com/.well-known/oauth-protected-resource"));
```

* **`require_https` is on.** A non-TLS, non-loopback request is rejected
  `400` before reaching a handler. Deployments behind a TLS-terminating
  proxy must turn it off.
* **`strip_token_from_request` is on.** The `Authorization` header is gone
  after successful validation.
* **`with_aud` makes `aud` required.** `without_strict_aud()` opts out.
* `BearerTokenService::validation()` no longer exists — all token policy
  lives on `BearerAuthConfig`.

Status codes on a guarded route: no credentials → `401` with a `Bearer`
challenge; malformed `Authorization` → `400` with `invalid_request`; valid
header, rejected token → `403` with a detailed challenge.

## OAuth 2.1 / OpenID Connect

### Validating against an issuer (feature `oauth-client`)

No shared secret: keys come from the issuer's published JWKS.

<!-- snippet: skip -->
```rust
let mut app = App::new()
    .with_bearer_auth(|auth| auth.with_aud(["https://api.example.com"]))
    .with_oauth(|oauth| oauth.with_issuer("https://auth.example.com"));

app.use_oauth();   // explicit opt-in — nothing validates until this call

app.map_get("/protected", protected).authorize::<MyClaims>(roles(["admin"]));
```

The `iss` claim is constrained to that issuer and made **required**.
Everything else — `aud`, expiry, roles — still comes from
`with_bearer_auth`.

Key lifecycle, all automatic: fetched lazily on the first request; an
unknown `kid` triggers a single-flight refresh rate-limited by
`with_refresh_cooldown` (default 60 s); known keys are re-checked once the
set is older than `with_max_key_age` (default 15 min); an issuer outage
keeps the last known set serving; with no keys ever loaded, protected routes
answer `503` rather than blaming the token.

For a local issuer on plain HTTP:

<!-- snippet: skip -->
```rust
.with_oauth(|oauth| oauth
    .with_issuer("http://127.0.0.1:5000")
    .with_client_config(|client| client.require_https(false)))
```

### Serving metadata

```rust
let mut app = App::new()
    .with_oauth_resource_metadata(|m| m
        .with_resource("https://api.example.com")
        .with_authorization_servers(["https://auth.example.com"])
        .with_scopes(["read", "write"]))
    .with_oauth_server_metadata(|m| m
        .with_issuer("https://auth.example.com")
        .with_authorization_endpoint("https://auth.example.com/authorize")
        .with_token_endpoint("https://auth.example.com/token")
        .with_jwks_uri("https://auth.example.com/jwks"));

app.use_oauth_resource_metadata();   // /.well-known/oauth-protected-resource
app.use_oauth_server_metadata()      // /.well-known/oauth-authorization-server
   .use_oidc_metadata();             // /.well-known/openid-configuration
```

The resource-metadata URL is advertised in `WWW-Authenticate` challenges
automatically once bearer auth is configured. The server-metadata builder is
seeded with the OAuth 2.1 prefills `response_types_supported = ["code"]` and
`grant_types_supported = ["authorization_code"]`; OIDC-only fields go
through `with_additional_field(..)`. `set_oauth_resource_metadata("https://…")`
is the one-argument shorthand for a minimal document.

### The client crate (`volga-oauth-client`)

Independent of the server crate — usable from any Tokio program.

<!-- snippet: skip -->
```rust
use std::sync::Arc;
use volga_oauth_client::{DiscoveryClient, InMemoryTokenStore, OAuthClient};

let metadata = DiscoveryClient::new()
    .fetch_server_metadata("https://auth.example.com").await?;

let client = OAuthClient::new("my-client")
    .with_redirect_uri("https://app.example.com/callback")
    .with_token_store(Arc::new(InMemoryTokenStore::new()));

let auth = client.authorization_request(&metadata)
    .with_scopes(["read"])
    .with_resource("https://api.example.com")
    .build()?;

// redirect the user to auth.url, then on the callback:
auth.validate_callback(&metadata, &state, iss.as_deref())?;  // state (CSRF) + RFC 9207 iss
let tokens = client.exchange_code(&metadata, &code, &auth).await?;
client.store_tokens("alice", &tokens);

// later — refreshed transparently, Ok(None) means re-authorize interactively
let tokens = client.token("alice", &metadata).await?;
```

PKCE (S256) is mandatory and generated for you. `validate_callback` is the
one to use — `matches_state` only checks CSRF and misses the mix-up attack
that the RFC 9207 `iss` check catches.

A secret turns the client confidential:

```rust
use volga_oauth_client::{ClientAuthMethod, OAuthClient};

OAuthClient::new("my-client")
    .with_secret("s3cret")
    .with_auth_method(ClientAuthMethod::Post);   // or Basic (default), or PrivateKeyJwt
```

### Machine-to-machine grants (0.9.8)

Three grants where the client is the subject and no user is involved. All are
builders on `OAuthClient`, take `with_scopes` / `with_resource` /
`with_param`, and are sent with `send()`. All of them need client
authentication — a public client has nothing to present.

| Method | Grant | Use when |
|---|---|---|
| `client_credentials` | RFC 6749 §4.4 | the service acts as itself |
| `jwt_bearer` | RFC 7523 §2.1 | another authority already issued a JWT vouching for it |
| `exchange_token` | RFC 8693 | one token is traded for another |

<!-- snippet: skip -->
```rust
let tokens = OAuthClient::new("my-service")
    .with_secret("s3cret")
    .client_credentials(metadata)
    .with_scopes(["inventory:read"])
    .send()
    .await?;
```

Client credentials issues **no refresh token**, so re-running the grant is the
renewal — `ClientCredentialsRequest::token("key")` does that, serving a stored
token while fresh and re-requesting when not (it **panics** without a
`TokenStore`). A token whose lifetime the server never stated is re-requested
rather than served.

`exchange_token` may hand back something other than a bearer token, so it
answers with `ExchangedToken` (`issued_token_type`, `is_bearer()`,
`is_expired()`), not `TokenSet`.

All three refuse locally rather than sending a request that cannot succeed:
the server must list the grant in `grant_types_supported`, and a client built
by `from_registration` must have had it approved in the registration's
`grant_types`. Both surface as `ClientError::Validation`.

### `private_key_jwt` (0.9.8, feature `private-key-jwt`)

<!-- snippet: skip -->
```rust
use volga_oauth_client::{JwsAlgorithm, OAuthClient, PrivateKeyJwt};

let key = PrivateKeyJwt::from_pem_file("/etc/secrets/client.pem", JwsAlgorithm::RS256)?
    .with_key_id("2026-08");

let client = OAuthClient::new("my-client").with_private_key_jwt(key);
```

Attaching it supersedes `with_secret`. Symmetric algorithms are refused, and
the algorithm is checked against the server's
`token_endpoint_auth_signing_alg_values_supported`. Publish the public half
with `with_public_jwk(..)` and render the document with `jwks()` — the crate
signs, it never derives a public key from a private one.

### DPoP (0.9.8, feature `dpop`)

Sender-constrained tokens (RFC 9449): the token is bound to a key the client
holds, and every request carries a freshly signed proof.

<!-- snippet: skip -->
```rust
use volga_oauth_client::{Dpop, OAuthClient};

let dpop = Dpop::generate()?;                 // throwaway ES256, one per session

let tokens = OAuthClient::new("my-service")
    .with_secret("s3cret")
    .with_dpop(dpop.clone())
    .client_credentials(metadata)
    .send()
    .await?;

// protecting a resource request you make yourself
let sent = dpop.authorize(&mut headers, &Method::GET, url, &tokens)?;
```

* Cloning a `Dpop` shares the key **and** the nonce state.
* A token that does not come back as `DPoP` is **refused**, not silently
  accepted as a bearer credential.
* The token endpoint's `use_dpop_nonce` round is handled internally; the
  resource's round is yours — `accept_nonce(..)` then
  `authorize_with_nonce(..)`.
* `thumbprint()` is the `jkt` to hand to a resource that pins keys out of band.
* A `WWW-Authenticate: DPoP ...` challenge is read with
  `BearerChallenge::parse_scheme(header, auth_scheme::DPOP)`.

`jwt_bearer` and `private_key_jwt` are easy to confuse: the grant says *why* a
token should be issued, the client assertion says *who is asking*. One request
may carry both.

Persistence is the `TokenStore` trait (`get` / `put` / `remove`);
`InMemoryTokenStore` is built in. `RegistrationClient` performs Dynamic
Client Registration (RFC 7591), and `OAuthClient::from_registration` adopts
the issued credentials.

`ClientConfig` carries the shared transport policy — `require_https`,
`with_timeout`, `with_max_redirects`. `ClientError::Protocol` carries a
parsed RFC 6749 §5.2 error, distinguishing "the server said `invalid_grant`"
from "the connection dropped".

## TLS (feature `tls`)

```rust
use volga::{App, tls::{DevCertMode, TlsConfig}};

// development, feature `dev-cert` (no-op in release builds)
let mut app = App::new()
    .with_tls(|tls| tls.with_dev_cert(DevCertMode::Auto));   // or ::Ask

// real certificates — defaults to ./cert.pem and ./key.pem
let mut app = App::new().set_tls(TlsConfig::new());

let config = TlsConfig::new()
    .with_cert_path("certs/server.pem")
    .with_key_path("certs/server.key")
    .with_optional_client_auth("certs/ca.pem")   // or with_required_client_auth
    .with_https_redirection()
    .with_http_port(7979);                       // default 7879
```

`TlsConfig::from_pem("path/to/certs")` reads `cert.pem` / `key.pem` from a
directory. `TlsConfig` and `RedirectionConfig` are `#[non_exhaustive]` —
builders only, no struct literals, no exhaustive matches.

Redirection answers `307` in debug builds and `308` in release, so a cached
redirect cannot pin a development machine.

## HSTS

**HSTS is on by default** when TLS is configured. `max_age` defaults to one
year.

```rust
App::new().with_tls(|tls| tls
    .with_https_redirection()
    .with_hsts(|hsts| hsts.with_preload().with_sub_domains()));
```

* `with_preload()`, `with_sub_domains()` take **no arguments**;
  `without_preload()` / `without_sub_domains()` disable.
* `with_preload()` **panics** if `max_age` is under a year, and
  `with_max_age(..)` panics if it lowers the age below a year while preload
  is on — the preload list requires it.
* The `TlsConfig::with_hsts_preload` / `with_hsts_max_age` /
  `with_hsts_sub_domains` / `with_hsts_exclude_hosts` shortcuts were
  removed; everything goes through the `with_hsts(|h| ...)` closure.
