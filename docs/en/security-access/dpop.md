# DPoP — Sender-Constrained Tokens

A bearer token is a password: whoever holds it may use it. DPoP (RFC 9449) binds a token to a key the client holds, and every request carries a freshly signed proof of possession — so a token stolen from a log, a proxy or a compromised store is worth nothing without the key.

Available since **v0.9.8** behind the `dpop` feature of `volga-oauth-client`:

```toml
[dependencies]
volga-oauth-client = { version = "...", features = ["dpop"] }
```

::: info
The feature is off by default because signing is the only part of the crate that needs a JWS backend. It is independent of `private-key-jwt`: a client credential says **who asked** for a token, a DPoP proof says **who holds** it, and one request may carry both.
:::

## The Key

[`Dpop`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.Dpop.html) is the key plus the nonce state of the servers it talks to. [`generate()`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.Dpop.html#method.generate) mints a throwaway `ES256` key — the algorithm every DPoP implementation supports:

```rust
use volga_oauth_client::{ClientError, Dpop, OAuthClient};

fn build() -> Result<(), ClientError> {
    let dpop = Dpop::generate()?;

    let client = OAuthClient::new("my-client")
        .with_secret("s3cret")
        .with_dpop(dpop.clone());

    // the same key protects the resource requests made with its tokens
    let jkt = dpop.thumbprint();
    Ok(())
}
```

The usual lifetime is **one key per session**, not one per process — losing it costs nothing beyond the tokens bound to it, which cannot be used without it anyway. [`generate_with`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.Dpop.html#method.generate_with) also does `ES384` and `EdDSA`; RSA keys are far too slow to generate per session and have to be loaded instead.

For a key that outlives the process — one whose thumbprint a resource has already been told about — use [`from_pem`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.Dpop.html#method.from_pem) or [`from_pem_file`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.Dpop.html#method.from_pem_file), which take the public half explicitly and verify the two halves against each other with one signature at construction, so a mismatched pair is refused there rather than failing remotely on every request it would ever sign.

Cloning a [`Dpop`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.Dpop.html) shares the key **and** the nonces, so the client and the code making resource requests with its tokens stay in step.

## Obtaining Bound Tokens

[`with_dpop`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.OAuthClient.html#method.with_dpop) puts a proof on every token request, whichever grant sends it — Authorization Code, [client credentials, JWT bearer or token exchange](/volga-docs/en/security-access/machine-to-machine.html). Everything else is handled for you:

* the algorithm is checked against `dpop_signing_alg_values_supported` before the request leaves;
* the authorization request names the key in `dpop_jkt` (RFC 9449 §10), binding the code to it, so a stolen code cannot be redeemed by anyone else;
* a `use_dpop_nonce` refusal (§8.2) is answered by repeating the request exactly once with the nonce that refusal demanded;
* the tokens come back as `token_type: DPoP`.

```rust
use volga_oauth_client::{AuthorizationServerMetadata, ClientError, Dpop, OAuthClient};

async fn tokens(metadata: &AuthorizationServerMetadata) -> Result<(), ClientError> {
    let dpop = Dpop::generate()?;

    let tokens = OAuthClient::new("my-service")
        .with_secret("s3cret")
        .with_dpop(dpop.clone())
        .client_credentials(metadata)
        .with_scopes(["inventory:read"])
        .send()
        .await?;

    assert!(tokens.is_dpop());
    assert_eq!(tokens.dpop_jkt.as_deref(), Some(dpop.thumbprint()));
    Ok(())
}
```

::: warning
A token that does **not** come back as `DPoP` is refused rather than handed to the caller and the token store as an unbound credential — a server without DPoP support simply ignores the proof, and silently accepting a bearer token there would give up the binding the key exists for.
:::

[`TokenSet::is_dpop`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.TokenSet.html#method.is_dpop) and [`TokenSet::dpop_jkt`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.TokenSet.html#structfield.dpop_jkt) report the binding recorded by the client that obtained the token. A [`TokenStore`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/trait.TokenStore.html) outlives a process while a generated key does not, so a stored entry is checked against the key in hand before it is served: an entry bound to a key this client cannot prove possession of is dead weight however unexpired it looks. That is not an error — it is a stale cache, so the entry is evicted and a token that fits is obtained instead.

## Protecting Resource Requests

Requests to the resource stay yours to make: this crate mints proofs and owns the nonce state, it does not become an HTTP client for you. [`authorize`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.Dpop.html#method.authorize) fills in both headers — the `Authorization: DPoP <token>` credential and the `DPoP` proof covering it:

```rust
use http::{HeaderMap, Method};
use volga_oauth_client::{ClientError, Dpop, TokenSet};

fn protect(dpop: &Dpop, url: &str, tokens: &TokenSet) -> Result<(), ClientError> {
    let mut headers = HeaderMap::new();
    let sent = dpop.authorize(&mut headers, &Method::GET, url, tokens)?;

    // ...send the request with these headers
    Ok(())
}
```

The proof carries `typ: dpop+jwt`, the public key **by value** in the `jwk` header (never by `kid`, unlike a client assertion), the `htm` / `htu` / `iat` / `jti` claims, and `ath` — the hash of the access token — on every request that presents one. `htu` drops the query and fragment.

::: warning
[`authorize`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.Dpop.html#method.authorize) refuses a token this key cannot present — a bearer token, or one whose recorded binding names a different key — *before* the request, rather than letting the resource refuse it on every one.
:::

Two lower-level pieces are available when `authorize` is not the right shape:

* [`proof`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.Dpop.html#method.proof) builds a proof by hand — [`with_access_token`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.DpopProof.html#method.with_access_token), [`with_nonce`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.DpopProof.html#method.with_nonce), then [`sign`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.DpopProof.html#method.sign);
* [`thumbprint`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.Dpop.html#method.thumbprint) is the `jkt` (RFC 7638) an authorization server binds a token to — the value to hand to a resource that pins keys out of band.

## Nonces

A server may demand that proofs carry a nonce of its choosing. The token endpoint's round is handled internally; the resource's round is yours, because you send those requests:

```rust
use http::{HeaderMap, Method};
use volga_oauth_client::{ClientError, Dpop, TokenSet};

fn with_retry(dpop: &Dpop, url: &str, tokens: &TokenSet) -> Result<(), ClientError> {
    let mut headers = HeaderMap::new();
    let sent = dpop.authorize(&mut headers, &Method::GET, url, tokens)?;

    // ...send the request; then, given a `use_dpop_nonce` refusal:
    let response_headers = HeaderMap::new();
    if let Some(demanded) = dpop.accept_nonce(url, &response_headers)
        && Some(demanded.as_str()) != sent.as_deref()
    {
        dpop.authorize_with_nonce(&mut headers, &Method::GET, url, tokens, &demanded)?;
        // ...and send it once more
    }

    Ok(())
}
```

* [`authorize`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.Dpop.html#method.authorize) returns the nonce the proof it just signed actually carried — resolving and signing are one step, which a separate lookup could not promise while other requests to the same origin are in flight.
* [`accept_nonce`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.Dpop.html#method.accept_nonce) adopts the nonce of any response and returns it.
* [`authorize_with_nonce`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.Dpop.html#method.authorize_with_nonce) puts exactly that nonce in the retry, whatever the shared state has moved on to in the meantime.

::: info
Nonces are remembered per origin **and** per namespace: a token endpoint (§8) and a protected resource (§9) issue unrelated sequences even when one host serves both, so the origin alone cannot be the key.
:::

## Reading a DPoP Challenge

A DPoP-protected resource answers `401` with a `WWW-Authenticate: DPoP ...` challenge whose `error` and `error_description` are the RFC 6750 ones. Since **v0.9.8**, [`BearerChallenge::parse_scheme`](https://docs.rs/volga-oauth-core/latest/volga_oauth_core/struct.BearerChallenge.html#method.parse_scheme) reads a challenge under any scheme:

```rust
use volga_oauth_client::{BearerChallenge, OAuthError, auth_scheme};

fn read(header: &str) -> Result<(), OAuthError> {
    let challenge = BearerChallenge::parse_scheme(header, auth_scheme::DPOP)?;
    Ok(())
}
```

[`with_scheme`](https://docs.rs/volga-oauth-core/latest/volga_oauth_core/struct.BearerChallenge.html#method.with_scheme) and [`scheme`](https://docs.rs/volga-oauth-core/latest/volga_oauth_core/struct.BearerChallenge.html#method.scheme) render and report it, so a parsed challenge re-renders under the scheme it arrived with. `parse` is this method with `auth_scheme::BEARER`.

The two registered DPoP error codes are modelled as well: `OAuthErrorCode::UseDpopNonce` and `OAuthErrorCode::InvalidDpopProof` (RFC 9449 §7.1), which used to surface as `Other`.

::: warning
Three **v0.9.8** changes are worth checking when upgrading:

* `OAuthErrorCode` is `#[non_exhaustive]`, so nothing stops compiling — but code that matched the two DPoP codes as `Other(..)` no longer matches them. The wire form, `as_str` and the serde representation are unchanged.
* [`TokenSet`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.TokenSet.html) gained the `dpop_jkt` field, so code constructing one with a struct literal has to name it (`None` for a bearer token). The wire form is unchanged for anything that carries no binding, so a persisted entry written by an earlier version still reads back.
* [`ClientAuthMethod`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/enum.ClientAuthMethod.html) is no longer `Copy` — the new `PrivateKeyJwt` variant carries a signing key. It stays `Clone`, `Debug`, `PartialEq` and `Eq`.
:::
