# Machine-to-Machine Grants

The [Authorization Code flow](/volga-docs/en/security-access/oauth-client.html#authorization-code-pkce) exists to get a token *on behalf of a user*. Plenty of traffic has no user in it: a background worker calling an internal API, a job runner, a service that needs a token for itself. Since **v0.9.8**, `volga-oauth-client` drives the three grants for those cases, where the client is the subject.

All three are builders on [`OAuthClient`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.OAuthClient.html), share the same [`with_scopes`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.ClientCredentialsRequest.html#method.with_scopes) / [`with_resource`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.ClientCredentialsRequest.html#method.with_resource) (RFC 8707) / [`with_param`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.ClientCredentialsRequest.html#method.with_param) options, and are sent with `send()`:

| Method | Grant | Use it when |
|---|---|---|
| [`client_credentials`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.OAuthClient.html#method.client_credentials) | RFC 6749 §4.4 | the service acts as itself, with its own credential |
| [`jwt_bearer`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.OAuthClient.html#method.jwt_bearer) | RFC 7523 §2.1 | some other authority already issued a JWT that vouches for it |
| [`exchange_token`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.OAuthClient.html#method.exchange_token) | RFC 8693 | one token has to be traded for another |

::: tip
These grants need [client authentication](/volga-docs/en/security-access/oauth-client.html#client-authentication) — a secret or a `private_key_jwt` key. A public client has nothing to present, and any sane server will refuse it.
:::

## Client Credentials

The plain machine-to-machine grant. There is no authorization request to carry scopes here, so they go on the token request itself — or are omitted, leaving the server to apply the client's default grant:

```rust
use volga_oauth_client::{AuthorizationServerMetadata, ClientError, OAuthClient};

async fn run(metadata: &AuthorizationServerMetadata) -> Result<(), ClientError> {
    let client = OAuthClient::new("my-service").with_secret("s3cret");

    let tokens = client
        .client_credentials(metadata)
        .with_scopes(["inventory:read"])
        .with_resource("https://api.example.com")
        .send()
        .await?;

    Ok(())
}
```

### Holding a service token

RFC 6749 §4.4.3 issues **no refresh token** for this grant, so there is nothing for [`OAuthClient::token`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.OAuthClient.html#method.token) to renew a stored token *with* — re-running the grant is the renewal. That is what [`ClientCredentialsRequest::token`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.ClientCredentialsRequest.html#method.token) does: it serves the stored token while it is fresh and runs the grant again — with the same scopes and resource indicators — when it is not.

```rust
use std::sync::Arc;
use volga_oauth_client::{
    AuthorizationServerMetadata, ClientError, InMemoryTokenStore, OAuthClient,
};

async fn run(metadata: &AuthorizationServerMetadata) -> Result<(), ClientError> {
    let client = OAuthClient::new("my-service")
        .with_secret("s3cret")
        .with_token_store(Arc::new(InMemoryTokenStore::new()));

    // the first call requests, the rest are served from the store
    // until the token nears its expiry
    let tokens = client
        .client_credentials(metadata)
        .with_scopes(["inventory:read"])
        .token("inventory")
        .await?;

    Ok(())
}
```

::: warning
A stored token whose lifetime the server never stated is re-requested rather than served: `expires_in` is only RECOMMENDED by RFC 6749 §5.1, and an unknown lifetime is no evidence of freshness. Against a server that omits it, this therefore runs the grant on every call — that grant is a single request, and a caller who would rather cache anyway can hold the [`TokenSet`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.TokenSet.html) from [`send()`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.ClientCredentialsRequest.html#method.send) under its own policy.

The method **panics** when no [`TokenStore`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/trait.TokenStore.html) is attached.
:::

## JWT Bearer

Presents a JWT as an authorization grant. The assertion is supplied by the caller rather than minted here: it is what some other authority already issued — a workload identity token from the platform the client runs on, or an identity assertion obtained from a prior exchange.

```rust
use volga_oauth_client::{AuthorizationServerMetadata, ClientError, OAuthClient};

async fn run(
    metadata: &AuthorizationServerMetadata,
    workload_jwt: &str,
) -> Result<(), ClientError> {
    let tokens = OAuthClient::new("my-workload")
        .jwt_bearer(metadata, workload_jwt)
        .with_scopes(["inventory:read"])
        .send()
        .await?;

    Ok(())
}
```

::: warning
A failure here is final: the assertion is either accepted or it is not. Do not retry it and do not fall back to another grant type — fix the assertion instead. An `invalid_grant` means the assertion itself was rejected.
:::

::: info
`jwt_bearer` and `private_key_jwt` both send a signed JWT and are easy to confuse. They answer different questions: the JWT bearer **grant** is *why* a token should be issued, a `private_key_jwt` **client assertion** is *who is asking*. One request can carry both.
:::

## Token Exchange

Trades one token for another (RFC 8693) — the delegation and impersonation grant. `subject_token` represents the party the new token is requested for, and `subject_token_type` identifies what it is: one of the [`token_type`](https://docs.rs/volga-oauth-core/latest/volga_oauth_core/protocol/token_type/index.html) constants, or any URI the server understands.

```rust
use volga_oauth_client::{
    AuthorizationServerMetadata, ClientError, OAuthClient, token_type,
};

async fn run(
    idp: &AuthorizationServerMetadata,
    resource_server: &AuthorizationServerMetadata,
    id_token: &str,
) -> Result<(), ClientError> {
    let client = OAuthClient::new("my-app").with_secret("s3cret");

    // exchange the user's ID token for an assertion the resource's
    // authorization server accepts...
    let exchanged = client
        .exchange_token(idp, id_token, token_type::ID_TOKEN)
        .with_requested_token_type(token_type::ID_JAG)
        .with_audience("https://api.example.com")
        .send()
        .await?;

    // ...and present it there as a JWT bearer grant
    let tokens = client
        .jwt_bearer(resource_server, &exchanged.token)
        .send()
        .await?;

    Ok(())
}
```

Unlike the other two, an exchange may hand back something that is **not** a bearer access token, so it answers with an [`ExchangedToken`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.ExchangedToken.html) rather than a [`TokenSet`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.TokenSet.html):

* `issued_token_type` — what the server decided to issue;
* [`is_bearer()`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.ExchangedToken.html#method.is_bearer) — whether it is usable as an `Authorization: Bearer` credential;
* [`is_expired()`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.ExchangedToken.html#method.is_expired) / [`expires_within()`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.ExchangedToken.html#method.expires_within) — the same absolute expiry handling as a `TokenSet`.

Besides the shared options, the request takes [`with_requested_token_type`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.TokenExchangeRequest.html#method.with_requested_token_type), [`with_audience`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.TokenExchangeRequest.html#method.with_audience) and [`with_actor_token`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.TokenExchangeRequest.html#method.with_actor_token) (delegation, where the acting party is named alongside the subject).

## What Is Refused Before the Network

All three grants refuse a request rather than send one that cannot succeed. **Both** sides have to allow the grant:

* the server has to list it in `grant_types_supported`;
* a client built by [`from_registration`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.OAuthClient.html#method.from_registration) has to have had it approved in the registration's `grant_types`.

The registration check applies to the Authorization Code flow too — `authorization_request().build()` and `exchange_code` refuse it rather than redirect a user into a flow the client may not complete. An omitted `grant_types` means `authorization_code` alone (RFC 7591 §2); only a client that never went through a registration is unconstrained, and `refresh_token` is never refused.

Both failures surface as `ClientError::Validation`, which is a clearer signal than the `unauthorized_client` the token endpoint would have answered with.
