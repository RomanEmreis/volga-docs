# Authentication and Authorization

Volga provides a flexible set of tools for implementing authentication and authorization in your web applications. It supports both Basic Authentication and Bearer Token (JWT)-based authentication, with built-in facilities for access control based on roles, permissions, or custom logic.

## Basic Authentication

Basic authentication is a simple mechanism for verifying user credentials (username and password) via the `Authorization: Basic` HTTP header.

### Dependencies

```toml
[dependencies]
volga = { version = "...", features = ["basic-auth"] }
```

### Example

```rust compile
use volga::{
    App, HttpResult,
    headers::WWW_AUTHENTICATE,
    auth::Basic,
    status, ok
};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();
    app.map_get("/protected", protected);
    app.run().await
}

async fn protected(auth: Basic) -> HttpResult {
    let (expected_user, expected_pass) = get_credentials_from_db().await;
    if auth.validate(&expected_user, &expected_pass) {
        ok!("Access granted")
    } else {
        status!(401, "Unauthorized"; [
            (WWW_AUTHENTICATE, "Basic realm=\"Restricted area\"")
        ])
    }
}

async fn get_credentials_from_db() -> (String, String) {
    // In a real application, retrieve this securely
    ("foo".into(), "bar".into())
}
```

The [`Basic`](https://docs.rs/volga/latest/volga/auth/basic/struct.Basic.html) struct parses the HTTP header and provides [`validate()`](https://docs.rs/volga/latest/volga/auth/basic/struct.Basic.html#method.validate) and [`validate_base64()`](https://docs.rs/volga/latest/volga/auth/basic/struct.Basic.html#method.validate_base64) for credential comparison.

## Bearer Token Authentication (JWT)

JWT (JSON Web Tokens) are more robust and support structured claims. This allows you to implement both authentication and fine-grained authorization.

### Dependencies

```toml
[dependencies]
volga = { version = "...", features = ["jwt-auth-full"] }
```

### Token Generation

```rust
use std::{ops::Add, time::{SystemTime, UNIX_EPOCH, Duration}};
use serde::{Serialize, Deserialize};
use volga::{
    App, Json, HttpResult,
    auth::{Claims, BearerTokenService, EncodingKey},
    ok, status, bad_request
};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let secret = std::env::var("JWT_SECRET")
        .expect("JWT_SECRET must be set");

    let mut app = App::new()
        .with_bearer_auth(|auth| {
            auth.set_encoding_key(EncodingKey::from_secret(secret.as_bytes()))
        });

    app.map_post("/generate", generate);
    app.run().await
}

async fn generate(payload: Json<Payload>, bts: BearerTokenService) -> HttpResult {
    if payload.client_id != "foo" || payload.client_secret != "bar" {
        return status!(401, "Invalid credentials");
    }

    let exp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .add(Duration::from_secs(300))
        .as_secs();

    let claims = Claims {
        sub: "user@email.com".into(),
        company: "Awesome Co.".into(),
        role: "admin".into(),
        exp,
    };

    let token = bts.encode(&claims)?.to_string();
    ok!(AuthData { access_token: token })
}

#[derive(Claims, Serialize, Deserialize)]
struct Claims {
    sub: String,
    company: String,
    role: String,
    exp: u64,
}

#[derive(Serialize)]
struct AuthData {
    access_token: String,
}

#[derive(Deserialize)]
struct Payload {
    client_id: String,
    client_secret: String,
}
```

### Bearer Auth Configuration

The [`BearerAuthConfig`](https://docs.rs/volga/latest/volga/auth/bearer/struct.BearerAuthConfig.html) enforces the following security policies by default:

* **[`require_https`](https://docs.rs/volga/latest/volga/auth/bearer/struct.BearerAuthConfig.html#method.require_https)** is **enabled** — non-TLS, non-loopback requests are rejected with `400 Bad Request`. Disable for reverse-proxy deployments where TLS is terminated upstream.
* **[`strip_token_from_request`](https://docs.rs/volga/latest/volga/auth/bearer/struct.BearerAuthConfig.html#method.strip_token_from_request)** is **enabled** — the `Authorization` header is removed after successful validation. Disable if downstream handlers need access to the token.

```rust
let mut app = App::new()
    .with_bearer_auth(|auth| auth
        .set_decoding_key(DecodingKey::from_secret(secret.as_bytes()))
        .require_https(false)             // disable for reverse-proxy deployments
        .strip_token_from_request(false)  // keep Authorization header for downstream handlers
    );
```

Since **0.14.1** a `BearerAuthConfig` built elsewhere, such as in a helper the app and its tests share, goes in whole with [`set_bearer_auth(config)`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.set_bearer_auth). It replaces the configuration, where `with_bearer_auth` hands the closure the default to refine.

When configuring audience validation via [`with_aud(...)`](https://docs.rs/volga/latest/volga/auth/bearer/struct.BearerAuthConfig.html#method.with_aud), the `aud` claim is automatically added to required claims — tokens missing it are rejected. Call [`without_strict_aud()`](https://docs.rs/volga/latest/volga/auth/bearer/struct.BearerAuthConfig.html#method.without_strict_aud) to allow tokens that do not include `aud`:

```rust
let mut app = App::new()
    .with_bearer_auth(|auth| auth
        .set_decoding_key(DecodingKey::from_secret(secret.as_bytes()))
        .with_aud(["my-service"])
        .without_strict_aud()
    );
```

Issuer validation via [`with_iss(...)`](https://docs.rs/volga/latest/volga/auth/bearer/struct.BearerAuthConfig.html#method.with_iss) works the same way, with no opt-out: since **0.13.3** the `iss` claim becomes required, so a token without one is refused with `401`, just as one naming an issuer outside the set is. An empty set leaves the configuration as it was.

```rust compile-fragment
use volga::auth::DecodingKey;

let secret = std::env::var("JWT_SECRET")?;

let app = App::new()
    .with_bearer_auth(|auth| auth
        .set_decoding_key(DecodingKey::from_secret(secret.as_bytes()))
        .with_iss(["https://auth.example.com"])
        .with_aud(["my-service"])
    );
```

::: warning
Setting `with_iss` is how a resource server tells its own tokens from the rest signed with the same key — an HMAC secret several services share, say. If some of the tokens it has to accept carry no `iss`, those are refused since **0.13.3**: have the issuer add the claim, or leave `with_iss` out.
:::

::: info
`EncodingKey`, `DecodingKey` and `Algorithm` are Volga's own types at `volga::auth::*` rather than re-exports of `jsonwebtoken`, so `jsonwebtoken::ErrorKind` and its key constructors are not reachable — build keys with the PEM / base64 / secret / env / file constructors Volga provides, or, since **0.13.2**, from a [JSON Web Key](#a-key-published-as-a-json-web-key). Token validation settings live on [`BearerAuthConfig`](https://docs.rs/volga/latest/volga/auth/bearer/struct.BearerAuthConfig.html).

Since **v0.9.8**, `volga::auth::Algorithm` is a re-export of [`JwsAlgorithm`](https://docs.rs/volga-oauth-core/latest/volga_oauth_core/enum.JwsAlgorithm.html) from `volga-oauth-core` — the variants, the `HS256` default and the behaviour are unchanged, but the type is now shared with the client crates, so a `private_key_jwt` assertion and a bearer token the server issues are described in one vocabulary. It is also re-exported from `volga::auth::oauth`, where it can be named without the `jwt-auth` feature.
:::

### JWT Usage

The [authorize()](https://docs.rs/volga/latest/volga/app/struct.App.html#method.authorize) middleware provides tools to implement roles-based or permissions-based access control
and can be difined for a single route, group of routes or the entire application.

```rust
use serde::Deserialize;
use volga::{
    App, ok,
    auth::{Claims, DecodingKey, roles},
};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let secret = std::env::var("JWT_SECRET")
        .expect("JWT_SECRET must be set");

    let mut app = App::new()
        .with_bearer_auth(|auth| {
            auth.set_decoding_key(DecodingKey::from_secret(secret.as_bytes()))
        });

    app.map_get("/me", me)
        .authorize::<Claims>(roles(["admin", "user"]));

    app.run().await
}

async fn me() -> &'static str {
    "Hello from protected route"
}

#[derive(Claims, Deserialize)]
struct Claims {
    sub: String,
    company: String,
    role: String,
    exp: u64,
}
```

::: warning
To ensure proper JWT functionality, you must use the same `JWT_SECRET` both when generating the token and when validating it on protected routes.
This secret is used to sign the token during generation and to verify the signature during validation. If these values differ - the token will be rejected as invalid.
:::

### Algorithms and Key Types

Unless told otherwise, tokens are signed and verified with `HS256` and an HMAC secret. Any other algorithm — and any RSA, EC or Ed25519 key — is named with [`with_alg()`](https://docs.rs/volga/latest/volga/auth/bearer/struct.BearerAuthConfig.html#method.with_alg). The first call replaces the default `HS256`, and later calls add to the list:

```rust compile-fragment
use volga::auth::{Algorithm, DecodingKey, EncodingKey};

let app = App::new()
    .with_bearer_auth(|auth| auth
        .set_encoding_key(EncodingKey::from_pem_file("/etc/volga/rs256.pem"))
        .set_decoding_key(DecodingKey::from_pem_file("/etc/volga/rs256.pub.pem"))
        .with_alg(Algorithm::RS256)   // replaces HS256
        .with_alg(Algorithm::PS256)); // and accepts PS256 tokens as well
```

A token is accepted only when it is signed with one of the listed algorithms. [`BearerTokenService::encode`](https://docs.rs/volga/latest/volga/auth/bearer/struct.BearerTokenService.html#method.encode) signs with the first of them — `RS256` here, `HS256` when `with_alg` is never called.

Each algorithm belongs to a family, and each family takes its own kind of key:

| Algorithms | Key | Constructors |
|---|---|---|
| `HS256`, `HS384`, `HS512` | HMAC secret | `from_secret`, `from_base64_secret`, `from_file`, `from_env`, `from_env_base64`, an `oct` JWK |
| `RS256`, `RS384`, `RS512`, `PS256`, `PS384`, `PS512` | RSA key | `from_rsa_pem`, `from_pem_file`, an `RSA` JWK |
| `ES256`, `ES384` | EC key (P-256, P-384) | `from_ec_pem`, `from_pem_file`, an `EC` JWK |
| `EdDSA` | Ed25519 key | `from_ed_pem`, `from_pem_file`, an `OKP` JWK |

The decoding key has to suit **every** algorithm `with_alg` names, and the encoding key the **first** one. Since **0.13.3** a key that does not stops the application at startup: `App::run` returns an error that names the key, the algorithms it cannot serve and the ones it can.

```text
Bearer auth: the decoding key is an RSA key, which cannot verify HS256 tokens (the default without `with_alg`); `with_alg` must name only RS256, RS384, RS512, PS256, PS384 or PS512
```

::: tip
An RSA, EC or Ed25519 key always comes with `with_alg`: without it the list is the default `HS256`, which only an HMAC secret serves — that is the error above. And since there is one decoding key, the algorithms listed are all of one family.
:::

::: warning
`with_alg` names the full list. Since **0.13.3**, `.with_alg(Algorithm::HS512)` alone accepts only `HS512` tokens; to keep accepting `HS256` ones — while moving clients from one to the other, say — name both, the one `encode` should sign with first:

```rust compile-fragment
use volga::auth::{Algorithm, DecodingKey, EncodingKey};

let secret = std::env::var("JWT_SECRET")?;

let app = App::new()
    .with_bearer_auth(|auth| auth
        .set_encoding_key(EncodingKey::from_secret(secret.as_bytes()))
        .set_decoding_key(DecodingKey::from_secret(secret.as_bytes()))
        .with_alg(Algorithm::HS512)   // tokens issued from now on
        .with_alg(Algorithm::HS256)); // tokens issued before, until they expire
```
:::

[Issuer-based validation](#validating-tokens-against-an-oauth-2-1-oidc-issuer) needs no `with_alg` to verify tokens: there is no static decoding key, and each token is checked with the algorithm the issuer's JWKS advertises for its key.

### A Key Published as a JSON Web Key

Issuers publish their verification keys as JSON Web Keys (RFC 7517) rather than PEM files. Since **0.13.2**, [`DecodingKey::from_jwk()`](https://docs.rs/volga/latest/volga/auth/decoding_key/struct.DecodingKey.html#method.from_jwk) builds a key from one of them — RSA, EC, Ed25519 (`OKP`) or a symmetric `oct` key. It takes a single key as JSON text, such as one entry of the `keys` array of the issuer's JWKS:

```rust compile-fragment
use volga::auth::{Algorithm, DecodingKey};

let key = DecodingKey::from_jwk(
    r#"{"kty":"OKP","crv":"Ed25519","x":"11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo"}"#,
)?;

let app = App::new()
    .with_bearer_auth(|auth| auth
        .set_decoding_key(key)
        .with_alg(Algorithm::EdDSA));
```

The key's own `alg`, `use` and `key_ops` members are not read: the algorithm tokens must be signed with comes from [`with_alg()`](https://docs.rs/volga/latest/volga/auth/bearer/struct.BearerAuthConfig.html#method.with_alg), as it does for a PEM key. `from_jwk` returns an error when the text is not a JSON Web Key — a whole key set (`{"keys": [...]}`) is not one either — or names a key type or curve that is not supported.

::: warning
A key loaded this way is static: it does not follow the issuer's key rotations, and tokens signed with a new key are rejected until the application is redeployed. For an issuer that rotates its keys, validate against the issuer instead (below) — with [`with_jwks_uri`](./oauth.md#when-the-issuer-s-url-is-not-reachable-from-the-server) if the server cannot reach the issuer's own URL.
:::

### Validating Tokens Against an OAuth 2.1 / OIDC Issuer

Rather than configuring a static key, a resource server can validate bearer tokens against an OAuth 2.1 / OIDC issuer's published keys — no shared secret required. Describe the issuer with [`with_oauth(...)`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.with_oauth) and opt in with [`use_oauth()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.use_oauth):

```rust compile-fragment
let mut app = App::new()
    .with_bearer_auth(|auth| auth.with_aud(["https://api.example.com"]))
    .with_oauth(|oauth| oauth.with_issuer("https://auth.example.com"));

app.use_oauth();
```

See the [OAuth 2.1 & OpenID Connect](./oauth.md) page for the full flow (issuer-based validation, key rotation and metadata serving) and the [OAuth 2.1 Client](./oauth-client.md) page for driving the Authorization Code + PKCE flow.

## Defining Claims

The `jwt-auth-full` feature enables the [`Claims`](https://docs.rs/volga/latest/volga/auth/derive.Claims.html) derive macro for defining JWT claims. Alternatively, you can define claims using:

::: warning
The derive is for **structs** only — a JWT payload is a JSON object, so `#[derive(Claims)]` on an enum or a union is a compile error. A struct carrying none of `role` / `roles` / `permissions` is fine: every method of the trait has a default.
:::

### `claims!` macro

```rust
use volga::auth::claims;

claims! {
    #[derive(Deserialize)]
    struct Claims {
        sub: String,
        role: String,
        permissions: Vec<String>,
    }
}
```

### Manual Implementation

```rust compile
use serde::Deserialize;
use volga::auth::AuthClaims;

#[derive(Deserialize, Clone)]
struct Claims {
    sub: String,
    role: String,
    permissions: Vec<String>,
}

impl AuthClaims for Claims {
    fn role(&self) -> Option<&str> {
        Some(&self.role)
    }

    fn permissions(&self) -> Option<&[String]> {
        Some(&self.permissions)
    }
}
```

## Declarative Access Control with `Authorizer`

Volga provides a powerful [`Authorizer`](https://docs.rs/volga/latest/volga/auth/authorizer/enum.Authorizer.html) system that lets you define access rules declaratively.

### Built-in Authorizers

* [`role("admin")`](https://docs.rs/volga/latest/volga/auth/authorizer/fn.role.html): single-role check.
* [`roles(["admin", "user"])`](https://docs.rs/volga/latest/volga/auth/authorizer/fn.roles.html): multi-role check.
* [`permission("write")`](https://docs.rs/volga/latest/volga/auth/authorizer/fn.permission.html): single permission.
* [`permissions(["read", "write"])`](https://docs.rs/volga/latest/volga/auth/authorizer/fn.permissions.html): multiple permissions.
* [`predicate(|claims| ...)`](https://docs.rs/volga/latest/volga/auth/authorizer/fn.predicate.html): custom logic.

::: info
All five are re-exported from `volga::auth`; the full path, [`volga::auth::authorizer::permission`](https://docs.rs/volga/latest/volga/auth/authorizer/fn.permission.html) and its siblings, works too. On **0.9.8 and earlier** `permission` is only reachable by the full path — the compiler's suggestion there, `permissions`, is a different function.
:::

### Example

```rust compile
use serde::Deserialize;
use volga::auth::{
    AuthClaims, Authorizer,
    role, roles, permission, permissions, predicate
};

#[derive(Deserialize, Clone)]
struct MyClaims {
    role: String,
    permissions: Vec<String>,
}

impl AuthClaims for MyClaims {
    fn role(&self) -> Option<&str> {
        Some(&self.role)
    }

    fn permissions(&self) -> Option<&[String]> {
        Some(&self.permissions)
    }
}

fn main() {
    let admin = role("admin");
    let editors = roles(["editor", "contributor"]);
    let can_write = permission("write");

    let access_policy = admin.or(editors).and(can_write);

    let user = MyClaims {
        role: "editor".into(),
        permissions: vec!["write".into()],
    };

    assert!(access_policy.validate(&user));
}
```

::: tip
You can also chain rules with [`and()`](https://docs.rs/volga/latest/volga/auth/authorizer/enum.Authorizer.html#method.and) and [`or()`](https://docs.rs/volga/latest/volga/auth/authorizer/enum.Authorizer.html#method.or) combinators to express complex policies.
:::

## How a Rejected Request Is Answered

Every rejection the bearer middleware makes carries the status and the `WWW-Authenticate` challenge RFC 6750 §3.1 assigns to it, so a client can tell "fix your header" from "get a new token" from "come back later" without parsing a message:

| What happened | Status | Challenge |
|---|---|---|
| No `Authorization` header at all | `401` | bare `Bearer` — no error code, so a client can discover the resource metadata and start a flow |
| An `Authorization` header that is not a well-formed bearer credential — wrong scheme, empty token | `400` | `invalid_request` |
| A plaintext request while [`require_https`](https://docs.rs/volga/latest/volga/auth/bearer/struct.BearerAuthConfig.html#method.require_https) is on | `400` | `invalid_request`, `HTTPS required` |
| A token that did not hold up: expired, not yet valid, wrong signature, wrong `iss` / `aud` / `sub` / algorithm, a missing required claim, or one that does not decode at all | `401` | `invalid_token`, with the reason in `error_description` |
| A valid token that does not carry the role or permission the route asks for | `403` | `insufficient_scope` |
| A validation that could not be completed — an unreadable verification key, an issuer that cannot be reached | `503` | none: the caller has nothing to fix |

::: warning Upgrading from 0.10.0
A token that failed validation was answered `403`, and a malformed one `400`. Both are `401` now, so anything that reads `403` as "this token cannot be refreshed" — a test, a client's refresh trigger, an alert — has to read `401` instead.
:::

## Examples
* [Basic Auth Example](https://github.com/RomanEmreis/volga/blob/main/examples/cookies/src/main.rs)
* [JWT Example](https://github.com/RomanEmreis/volga/blob/main/examples/jwt/src/main.rs)
