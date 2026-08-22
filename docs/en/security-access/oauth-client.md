# OAuth 2.1 Client

`volga-oauth-client` is an OAuth 2.1 / OpenID Connect client built on the shared protocol types from `volga-oauth-core`. It is **independent of the `volga` server crate** — usable from any Tokio application (a CLI, a background worker, or a volga web app driving a login flow).

It provides three clients, all sharing the transport policy of [`ClientConfig`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.ClientConfig.html) and the error model of [`ClientError`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/enum.ClientError.html):

* [`DiscoveryClient`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.DiscoveryClient.html) — fetches Authorization Server Metadata (RFC 8414), Protected Resource Metadata (RFC 9728) and the OpenID Connect provider configuration.
* [`OAuthClient`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.OAuthClient.html) — the Authorization Code flow with mandatory PKCE, refresh tokens and resource indicators, plus token persistence. Since **v0.9.8** it also drives the grants that authenticate the *client itself* — see [Machine-to-Machine Grants](/volga-docs/en/security-access/machine-to-machine.html).
* [`RegistrationClient`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.RegistrationClient.html) — Dynamic Client Registration (RFC 7591).

Since **v0.9.8** the tokens they obtain can also be sender-constrained with [`Dpop`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.Dpop.html) (RFC 9449) — see [DPoP](/volga-docs/en/security-access/dpop.html).

## Dependencies

```toml
[dependencies]
volga-oauth-client = { version = "..." }
```

### Feature flags

| Flag | What it enables |
|---|---|
| `http1` (default) | HTTP/1.1 via hyper |
| `http2` | HTTP/2 via hyper; negotiated through TLS ALPN when combined with `http1`, used exclusively (prior knowledge over plaintext) without it |
| `private-key-jwt` | `private_key_jwt` client authentication (RFC 7523 §2.2) — a client assertion signed with the client's own key |
| `dpop` | DPoP sender-constrained tokens (RFC 9449) |

At least one of `http1` / `http2` must be enabled.

::: info
`private-key-jwt` and `dpop` are off by default because they are the only parts of the crate that need a JWS signing backend (`jsonwebtoken` on `aws-lc-rs`). Every grant, the secret-based authentication methods and public clients work without them.
:::

## Discovery

[`DiscoveryClient`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.DiscoveryClient.html) resolves the well-known discovery URLs, fetches the documents over HTTPS and validates each against the identifier it was requested for (RFC 8414 §3.3 / RFC 9728 §3.3):

```rust compile
use volga_oauth_client::{ClientError, DiscoveryClient};

async fn discover() -> Result<(), ClientError> {
    let client = DiscoveryClient::new();

    // straight from an issuer identifier (RFC 8414, or the OIDC path):
    let server = client.fetch_server_metadata("https://auth.example.com").await?;

    // or start from the resource and follow it to its authorization server:
    let resource = client.fetch_resource_metadata("https://api.example.com").await?;
    let server = client.discover_authorization_server(&resource).await?;

    assert!(server.token_endpoint.is_some());
    Ok(())
}
```

* [`fetch_server_metadata`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.DiscoveryClient.html#method.fetch_server_metadata) / [`fetch_oidc_metadata`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.DiscoveryClient.html#method.fetch_oidc_metadata) — the same document shape at the RFC 8414 and OIDC Discovery paths.
* [`fetch_resource_metadata`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.DiscoveryClient.html#method.fetch_resource_metadata) / [`fetch_resource_metadata_from_url`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.DiscoveryClient.html#method.fetch_resource_metadata_from_url) — the latter takes the `resource_metadata` URL straight from a `WWW-Authenticate` challenge.
* [`discover_authorization_server`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.DiscoveryClient.html#method.discover_authorization_server) — takes the first advertised authorization server and fetches its metadata, falling back from the RFC 8414 path to the OIDC path automatically.
* [`fetch_jwks`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.DiscoveryClient.html#method.fetch_jwks) / [`fetch_jwks_from_url`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.DiscoveryClient.html#method.fetch_jwks_from_url) — the issuer's JSON Web Key Set as raw JSON.

::: tip
Attach a [`MetadataCache`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/trait.MetadataCache.html) with [`with_cache(...)`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.DiscoveryClient.html#method.with_cache) to reuse your existing storage; discovery documents rarely change. JWKS fetches deliberately bypass the cache in both directions — signing keys rotate, so freshness policy belongs to you.
:::

## Authorization Code + PKCE

[`OAuthClient`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.OAuthClient.html) drives the OAuth 2.1 Authorization Code flow. PKCE (S256) is generated and applied automatically — it is the protection OAuth 2.1 prescribes for public clients.

```rust compile
use std::sync::Arc;
use volga_oauth_client::{ClientError, DiscoveryClient, InMemoryTokenStore, OAuthClient};

async fn authorize() -> Result<(), ClientError> {
    let metadata = DiscoveryClient::new()
        .fetch_server_metadata("https://auth.example.com")
        .await?;

    let client = OAuthClient::new("my-client")
        .with_redirect_uri("https://app.example.com/callback")
        .with_token_store(Arc::new(InMemoryTokenStore::new()));

    // 1. build the authorization request (state and PKCE are generated)
    let auth = client
        .authorization_request(&metadata)
        .with_scopes(["read"])
        .with_resource("https://api.example.com")
        .build()?;

    // 2. send the user to `auth.url`. The provider redirects back to your
    //    callback with the real `code` and `state` query parameters — read
    //    them there. (This snippet reuses the generated `auth.state` so the
    //    check below holds on the happy path.)
    let (code, state) = ("the-authorization-code", auth.state.as_str());

    // always verify the callback state before exchanging — CSRF protection
    if !auth.matches_state(state) {
        return Ok(()); // reject — possible CSRF
    }

    // 3. exchange the code for tokens (the PKCE verifier goes along)
    let tokens = client.exchange_code(&metadata, code, &auth).await?;
    client.store_tokens("alice", &tokens);

    // 4. later — served from the store, transparently refreshed when stale:
    let tokens = client.token("alice", &metadata).await?;
    Ok(())
}
```

The [`AuthorizationRequest`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.AuthorizationRequest.html) that [`build()`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.AuthorizationRequestBuilder.html#method.build) returns holds the `url` to redirect to, the `state` to check on the callback and the PKCE pair. It is `Serialize`/`Deserialize`, so a web application can stash it in the session between the redirect and the callback.

The request builder accepts [`with_scopes`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.AuthorizationRequestBuilder.html#method.with_scopes), [`with_resource`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.AuthorizationRequestBuilder.html#method.with_resource) (RFC 8707, repeatable), [`with_state`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.AuthorizationRequestBuilder.html#method.with_state) (override the generated value) and [`with_param`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.AuthorizationRequestBuilder.html#method.with_param) (e.g. the OIDC `nonce` or `prompt`).

::: warning
Always verify the callback `state` with [`matches_state`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.AuthorizationRequest.html#method.matches_state) **before** exchanging the code — it is your CSRF defence.
:::

### Validating the callback

Since **v0.9.6**, [`validate_callback`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.AuthorizationRequest.html#method.validate_callback) checks the whole callback at once — the `state` *and* the RFC 9207 `iss` parameter — and is the recommended replacement for a bare `matches_state`:

```rust compile
use volga_oauth_client::{AuthorizationRequest, AuthorizationServerMetadata, ClientError};

fn check(
    request: &AuthorizationRequest,
    metadata: &AuthorizationServerMetadata,
    state: &str,
    iss: Option<&str>,
) -> Result<(), ClientError> {
    request.validate_callback(metadata, state, iss)?;
    Ok(())
}
```

`iss` is the callback's `iss` query parameter, or `None` when the response carried none. It must match the issuer whenever it is present, and it is **required** once the server advertises `authorization_response_iss_parameter_supported`.

::: warning
Without the `iss` check, a callback can be replayed from a *different* authorization server — the mix-up attack RFC 9207 exists to prevent. If your provider advertises the parameter, use [`validate_callback`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.AuthorizationRequest.html#method.validate_callback); [`matches_state`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.AuthorizationRequest.html#method.matches_state) remains for the `state`-only check.
:::

### Transparent refresh

[`token(key, &metadata)`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.OAuthClient.html#method.token) reads the stored tokens and refreshes a stale access token behind the scenes. It returns `Ok(None)` when interactive authorization is required — nothing is stored, the entry has no refresh token, or the server rejected the refresh token (`invalid_grant`); in the latter cases the dead entry is removed from the store. You can also refresh explicitly with [`refresh`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.OAuthClient.html#method.refresh).

## Client Authentication

Without a credential the client acts as a **public client** (PKCE is the protection OAuth 2.1 prescribes). A confidential client authenticates to the token endpoint with one of three methods, and the choice applies to every grant it sends.

### Shared secret

```rust compile-fragment
use volga_oauth_client::{ClientAuthMethod, OAuthClient};

let client = OAuthClient::new("my-client")
    .with_secret("s3cret")
    // `client_secret_basic` (default) or `client_secret_post`
    .with_auth_method(ClientAuthMethod::Post);
```

### `private_key_jwt`

Since **v0.9.8** (feature `private-key-jwt`), the client can authenticate with an assertion signed by its own key (RFC 7523 §2.2), so no shared secret ever leaves it:

```rust compile
use volga_oauth_client::{ClientError, JwsAlgorithm, OAuthClient, PrivateKeyJwt};

fn build() -> Result<OAuthClient, ClientError> {
    let key = PrivateKeyJwt::from_pem_file("/etc/secrets/client.pem", JwsAlgorithm::RS256)?
        .with_key_id("2026-08");

    Ok(OAuthClient::new("my-client").with_private_key_jwt(key))
}
```

[`PrivateKeyJwt`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.PrivateKeyJwt.html) loads the key ([`from_pem`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.PrivateKeyJwt.html#method.from_pem), [`from_pem_file`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.PrivateKeyJwt.html#method.from_pem_file), [`from_der`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.PrivateKeyJwt.html#method.from_der)) and carries the claims policy — [`with_key_id`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.PrivateKeyJwt.html#method.with_key_id), [`with_lifetime`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.PrivateKeyJwt.html#method.with_lifetime) (60 seconds by default) and [`with_audiences`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.PrivateKeyJwt.html#method.with_audiences). A fresh assertion with a random `jti` is minted per token request, so a captured one is not replayable for long. Attaching it supersedes any [`with_secret`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.OAuthClient.html#method.with_secret) — the assertion is the credential.

::: warning
Symmetric algorithms are refused: an HMAC secret the server already holds proves nothing about who signed. The algorithm is also checked against the server's `token_endpoint_auth_signing_alg_values_supported` when it advertises one.
:::

### Publishing the public key

The authorization server verifies assertions with the public half of the key, which it either fetches from a `jwks_uri` or received inline at registration. [`with_public_jwk`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.PrivateKeyJwt.html#method.with_public_jwk) attaches it and [`jwks()`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.PrivateKeyJwt.html#method.jwks) renders the document to publish:

```rust compile
use volga_oauth_client::{ClientError, JwsAlgorithm, PrivateKeyJwt, PublicJwk};

fn publish(key: PrivateKeyJwt, public: PublicJwk) -> Result<(), ClientError> {
    let key = key.with_public_jwk(public)?;

    // serve this at your `jwks_uri`, or send it as the `jwks` member of a
    // Dynamic Client Registration request
    let document = key.jwks();
    Ok(())
}
```

[`PublicJwk`](https://docs.rs/volga-oauth-core/latest/volga_oauth_core/jwk/struct.PublicJwk.html) (RFC 7517, in `volga-oauth-core`) models **public** signing material exclusively — there is no way to represent the private members, and deserializing a document that carries them fails rather than silently dropping them. It also refuses combinations no verifier could act on: an RSA key declaring `ES256`, a P-384 key declaring `ES256`, a public key declaring an HMAC algorithm, or a curve that does not belong to the key type. `kid` and `alg` are filled in from the signing configuration, so the published document always agrees with what the assertions actually carry.

::: info
Supply the *public* key explicitly — the crate signs, it does not derive public keys from private ones. That is also what makes publishing the signing key by accident impossible.
:::

### What is checked before the request leaves

Since **v0.9.8** the configured method is validated against `token_endpoint_auth_methods_supported` before a token request is sent: a method the server never announced would only earn an `invalid_client` over the network. Metadata listing no methods is not second-guessed — that is what a hand-built [`AuthorizationServerMetadata`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.AuthorizationServerMetadata.html) carries — but a *discovered* document always lists something, since RFC 8414 makes an omitted field mean `client_secret_basic`. A public client presents no credential and is never checked.

::: info
The registered wire identifiers both sides of the protocol agree on live in one place since **v0.9.8** — `volga_oauth_core::protocol`, as the `grant`, `client_auth`, `token_type` and `auth_scheme` constants, re-exported from both `volga::auth::oauth` and `volga_oauth_client`. A server advertises them in its metadata document and a client matches on them, so the two cannot drift.
:::

## Token Store

Persistence goes through the [`TokenStore`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/trait.TokenStore.html) trait. [`InMemoryTokenStore`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.InMemoryTokenStore.html) is the built-in process-local implementation — suitable for CLIs, tests and single-instance services; anything durable (a database, an encrypted file, an OS keychain) is one trait impl away.

```rust compile
use volga_oauth_client::{TokenSet, TokenStore};

struct MyStore;

impl TokenStore for MyStore {
    fn get(&self, key: &str) -> Option<TokenSet> { /* ... */ None }
    fn put(&self, key: &str, tokens: &TokenSet) { /* ... */ }
    fn remove(&self, key: &str) { /* ... */ }
}
```

The key is chosen by the application — typically a user or session identifier, combined with the resource when one client serves several audiences. A [`TokenSet`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.TokenSet.html) carries the access token, an optional refresh token, the granted scope, the OIDC `id_token` (passed through, not validated) and an absolute `expires_at`; tokens are redacted from its `Debug` output.

## Dynamic Client Registration

[`RegistrationClient`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.RegistrationClient.html) submits [`ClientMetadata`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.ClientMetadata.html) to a server's registration endpoint (RFC 7591) and returns the issued credentials. [`OAuthClient::from_registration`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.OAuthClient.html#method.from_registration) adopts them into a ready-to-use client:

```rust compile
use volga_oauth_client::{
    ClientError, ClientMetadata, DiscoveryClient, OAuthClient, RegistrationClient,
};

async fn register() -> Result<(), ClientError> {
    let metadata = DiscoveryClient::new()
        .fetch_server_metadata("https://auth.example.com")
        .await?;

    let registered = RegistrationClient::new()
        .register(
            &metadata,
            &ClientMetadata::new()
                .with_redirect_uris(["https://app.example.com/callback"])
                .with_client_name("My App"),
        )
        .await?;

    // ready-to-use client under the issued credentials
    let client = OAuthClient::from_registration(&registered)?;
    Ok(())
}
```

For servers that do not allow open registration, attach an initial access token with [`with_initial_access_token`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.RegistrationClient.html#method.with_initial_access_token).

Two [`ClientMetadata`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.ClientMetadata.html) fields became first-class in **v0.9.6** and **v0.9.8** respectively:

* [`with_application_type`](https://docs.rs/volga-oauth-core/latest/volga_oauth_core/struct.ClientMetadata.html#method.with_application_type) — `"web"` or `"native"`. Desktop and CLI clients register as `"native"`, which is what makes loopback redirect URIs (`http://127.0.0.1:{port}/...`) acceptable to authorization servers.
* [`with_token_endpoint_auth_signing_alg`](https://docs.rs/volga-oauth-core/latest/volga_oauth_core/struct.ClientMetadata.html#method.with_token_endpoint_auth_signing_alg) — the algorithm this one client signs its assertions with, for a `private_key_jwt` registration.

When the registration authenticates with `private_key_jwt`, adopt it with [`from_registration_with_key`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.OAuthClient.html#method.from_registration_with_key), which also refuses a key the registration would not accept — one signing with an algorithm other than the registered `token_endpoint_auth_signing_alg`, or carrying a `kid` an inlined `jwks` cannot resolve:

```rust compile
use volga_oauth_client::{ClientError, ClientRegistrationResponse, OAuthClient, PrivateKeyJwt};

fn adopt(
    registered: &ClientRegistrationResponse,
    key: PrivateKeyJwt,
) -> Result<OAuthClient, ClientError> {
    OAuthClient::from_registration_with_key(registered, key)
}
```

::: warning
Since **v0.9.8**, a client built by [`from_registration`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.OAuthClient.html#method.from_registration) refuses a grant its registration did not approve — before reaching the network, rather than as an `unauthorized_client` from the token endpoint. An omitted `grant_types` means `authorization_code` alone (RFC 7591 §2), not carte blanche; only a client that never went through a registration is unconstrained. `refresh_token` is never refused, since RFC 6749 §6 makes it the continuation of a grant already held.
:::

::: info
The RFC 7592 management protocol (reading, updating and deleting a registration) is not implemented, but the `registration_access_token` / `registration_client_uri` pair from the response is surfaced for applications that need it.
:::

## Transport Policy & Errors

[`ClientConfig`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.ClientConfig.html) carries the policy shared by every client operation — HTTPS enforcement, per-request timeouts and redirect limits. The defaults are safe for production; the most common override is disabling HTTPS for a local development server:

```rust compile-fragment
use std::time::Duration;
use volga_oauth_client::{ClientConfig, OAuthClient};

let config = ClientConfig::new()
    .require_https(false)              // local development only
    .with_timeout(Duration::from_secs(5))
    .with_max_redirects(0);

let client = OAuthClient::new("my-client").with_config(config);
```

[`ClientError`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/enum.ClientError.html) separates a parsed OAuth error response (`Protocol`, carrying the RFC 6749 §5.2 [`OAuthError`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.OAuthError.html)) from transport, decode, insecure-URL and validation failures — so you can distinguish "the server said `invalid_grant`" from "the connection dropped". Since **v0.9.8** it also carries `Signing`, for a signing configuration that cannot produce the JWS a request needs — a `private_key_jwt` assertion or a DPoP proof.

### Propagating errors from a handler

Since **v0.9.8**, with the `oauth-client` feature enabled on `volga`, a [`ClientError`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/enum.ClientError.html) converts into a [`volga::Error`](https://docs.rs/volga/latest/volga/error/struct.Error.html), so a handler that talks to an authorization server can propagate the failure with `?`:

```rust compile
use volga::{HttpResult, ok};
use volga_oauth_client::{DiscoveryClient};

async fn metadata() -> HttpResult {
    let metadata = DiscoveryClient::new()
        .fetch_server_metadata("https://auth.example.com")
        .await?; // ClientError -> volga::Error

    ok!(metadata.issuer)
}
```

The status describes **where** the failure sits rather than echoing what the authorization server answered — this application was the *client* of the call that failed:

| Failure | Status |
|---|---|
| the server could not be reached (`Transport`) | `503 Service Unavailable` |
| it answered unusably — a protocol error, an unexpected status, an unparseable body | `502 Bad Gateway` |
| this application's own configuration — an insecure URL, metadata that fails validation, a key that cannot sign | `500 Internal Server Error` |

To surface the authorization server's own error code to your caller, match on `ClientError::Protocol` instead of relying on the conversion.

## What's next
* [Machine-to-Machine Grants](/volga-docs/en/security-access/machine-to-machine.html) — `client_credentials`, JWT bearer and token exchange, for flows with no user involved.
* [DPoP](/volga-docs/en/security-access/dpop.html) — binding tokens to a key the client holds, so a stolen token is worth nothing.

## Examples
* [OAuth Flow](https://github.com/RomanEmreis/volga/blob/main/examples/oauth_flow/src/main.rs) — a full discovery → authorization → code exchange → protected call flow driven by `volga-oauth-client`.
