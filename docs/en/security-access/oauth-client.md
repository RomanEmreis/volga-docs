# OAuth 2.1 Client

`volga-oauth-client` is an OAuth 2.1 / OpenID Connect client built on the shared protocol types from `volga-oauth-core`. It is **independent of the `volga` server crate** — usable from any Tokio application (a CLI, a background worker, or a volga web app driving a login flow).

It provides three clients, all sharing the transport policy of [`ClientConfig`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.ClientConfig.html) and the error model of [`ClientError`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/enum.ClientError.html):

* [`DiscoveryClient`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.DiscoveryClient.html) — fetches Authorization Server Metadata (RFC 8414), Protected Resource Metadata (RFC 9728) and the OpenID Connect provider configuration.
* [`OAuthClient`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.OAuthClient.html) — the Authorization Code flow with mandatory PKCE, refresh tokens and resource indicators, plus token persistence.
* [`RegistrationClient`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.RegistrationClient.html) — Dynamic Client Registration (RFC 7591).

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

At least one of the two must be enabled.

## Discovery

[`DiscoveryClient`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.DiscoveryClient.html) resolves the well-known discovery URLs, fetches the documents over HTTPS and validates each against the identifier it was requested for (RFC 8414 §3.3 / RFC 9728 §3.3):

```rust
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

```rust
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

    // 2. send the user to `auth.url`; then, in the redirect callback:
    let (code, state) = ("code", "state");
    assert!(auth.matches_state(state)); // always verify — CSRF protection

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

### Transparent refresh

[`token(key, &metadata)`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.OAuthClient.html#method.token) reads the stored tokens and refreshes a stale access token behind the scenes. It returns `Ok(None)` when interactive authorization is required — nothing is stored, the entry has no refresh token, or the server rejected the refresh token (`invalid_grant`); in the latter cases the dead entry is removed from the store. You can also refresh explicitly with [`refresh`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.OAuthClient.html#method.refresh).

### Confidential clients

Without a secret the client acts as a **public client** (PKCE is the protection). Attach a secret to authenticate to the token endpoint:

```rust
use volga_oauth_client::{ClientAuthMethod, OAuthClient};

let client = OAuthClient::new("my-client")
    .with_secret("s3cret")
    // `client_secret_basic` (default) or `client_secret_post`
    .with_auth_method(ClientAuthMethod::Post);
```

## Token Store

Persistence goes through the [`TokenStore`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/trait.TokenStore.html) trait. [`InMemoryTokenStore`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.InMemoryTokenStore.html) is the built-in process-local implementation — suitable for CLIs, tests and single-instance services; anything durable (a database, an encrypted file, an OS keychain) is one trait impl away.

```rust
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

```rust
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

::: info
The RFC 7592 management protocol (reading, updating and deleting a registration) is not implemented, but the `registration_access_token` / `registration_client_uri` pair from the response is surfaced for applications that need it.
:::

## Transport Policy & Errors

[`ClientConfig`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.ClientConfig.html) carries the policy shared by every client operation — HTTPS enforcement, per-request timeouts and redirect limits. The defaults are safe for production; the most common override is disabling HTTPS for a local development server:

```rust
use std::time::Duration;
use volga_oauth_client::{ClientConfig, OAuthClient};

let config = ClientConfig::new()
    .require_https(false)              // local development only
    .with_timeout(Duration::from_secs(5))
    .with_max_redirects(0);

let client = OAuthClient::new("my-client").with_config(config);
```

[`ClientError`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/enum.ClientError.html) separates a parsed OAuth error response (`Protocol`, carrying the RFC 6749 §5.2 [`OAuthError`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.OAuthError.html)) from transport, decode, insecure-URL and validation failures — so you can distinguish "the server said `invalid_grant`" from "the connection dropped".

## Examples
* [OAuth Flow](https://github.com/RomanEmreis/volga/blob/main/examples/oauth_flow/src/main.rs) — a full discovery → authorization → code exchange → protected call flow driven by `volga-oauth-client`.
