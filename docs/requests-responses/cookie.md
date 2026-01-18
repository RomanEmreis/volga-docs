# Cookies

Volga provides full support for cookies through seamless integration with the [`cookie`](https://crates.io/crates/cookie) crate. This guide explains how to enable and use cookie functionality in your application, including basic usage, customization, and secure (signed and private) cookies.


## Enabling Cookie Support

To use cookies in your app, you need to enable the appropriate feature flags in your `Cargo.toml`. If you're not using the `full` feature set, add the `cookie` feature manually:

```toml
[dependencies]
volga = { version = "...", features = ["cookie"] }

# Optional: explicitly depend on the cookie crate
cookie = "0.18.1"
```

For signed or private cookies, see the [Signed & Private Cookies](#signed--private-cookies) section.


## Basic Usage

Here's how to create and read cookies:

```rust
use volga::{
    App, HttpResult,
    http::Cookies,
    headers::{Header, Authorization},
    error::Error,
    status, ok, see_other
};

async fn login(cookies: Cookies, auth: Header<Authorization>) -> Result<(HttpResult, Cookies), Error> {
    let session_id = authorize(auth)?;
    Ok((see_other!("/me"), cookies.add(("session-id", session_id))))
}

async fn me(cookies: Cookies) -> HttpResult {
    if cookies.get("session-id").is_some() {
        ok!("Success")
    } else {
        status!(401, "Unauthorized")
    }
}

fn authorize(auth: Header<Authorization>) -> Result<String, Error> {
    // Dummy implementation. Replace with your own logic.
    Ok("generated-session-id".to_string())
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_post("/login", login);
    app.map_get("/me", me);

    app.run().await
}
```

### Notes:

* The [`Cookies`](https://docs.rs/volga/latest/volga/http/cookie/struct.Cookies.html) extractor handles reading from [`Cookie`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cookie) headers and automatically sets [`Set-Cookie`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie) headers for responses.
* You can chain multiple cookie additions using [`.add(...)`](https://docs.rs/volga/latest/volga/http/cookie/struct.Cookies.html#method.add).


## Creating Secure Cookies

For secure or customized cookies (e.g., `HttpOnly`, `Secure`, custom domain/path), use the [`CookieBuilder`](https://docs.rs/cookie/latest/cookie/struct.CookieBuilder.html):

```rust
use cookie::{Cookie, time::Duration};

let cookie = Cookie::build(("session-id", session_id))
    .domain("www.example.org")
    .path("/")
    .secure(true)
    .http_only(true)
    .max_age(Duration::days(1))
    .build();

cookies.add(cookie);
```
::: tip
[`Cookie::build(...)`](https://docs.rs/cookie/latest/cookie/struct.Cookie.html#method.build) takes either a name/value tuple or just a name, depending on your needs.
:::

## Reading Cookies

To access a cookie by name:

```rust
if let Some(cookie) = cookies.get("session-id") {
    println!("Session ID: {}", cookie.value());
}
```


## Signed & Private Cookies

To protect cookie integrity or privacy, Volga supports two secure cookie modes:

| Type           | Use Case                            | Crate Feature    | API              |
| -------------- | ----------------------------------- | ---------------- | ---------------- |
| **Signed**     | Detect tampering (readable)         | `signed-cookie`  | [`SignedCookies`](https://docs.rs/volga/latest/volga/http/cookie/signed/struct.SignedCookies.html)  |
| **Private**    | Tamper-proof and encrypted (hidden) | `private-cookie` | [`PrivateCookies`](https://docs.rs/volga/latest/volga/http/cookie/private/struct.PrivateCookies.html) |

### Enable Secure Cookie Support

Update your `Cargo.toml` to include the desired feature and the DI system (`di`):

```toml
# For signed cookies
volga = { version = "...", features = ["signed-cookie", "di"] }

# For private cookies
volga = { version = "...", features = ["private-cookie", "di"] }

# For all cookies features
volga = { version = "...", features = ["cookie-full", "di"] }
```

### Register Secret Keys

Signed and private cookies require secret keys, provided via DI:

```rust
use volga::http::SignedKey;

app.add_singleton(SignedKey::generate()); // or use your own key
```

Alternatively, for private cookies:

```rust
use volga::http::PrivateKey;

app.add_singleton(PrivateKey::generate()); // or use your own key
```

Once registered, you can extract [`SignedCookies`](https://docs.rs/volga/latest/volga/http/cookie/signed/struct.SignedCookies.html) or [`PrivateCookies`](https://docs.rs/volga/latest/volga/http/cookie/private/struct.PrivateCookies.html) just like [`Cookies`](https://docs.rs/volga/latest/volga/http/cookie/struct.Cookies.html).

## Best Practices

* **Use `HttpOnly` and `Secure` flags** for session or authentication cookies to prevent XSS and eavesdropping.
* **Set a `SameSite` policy** (via `cookie::CookieBuilder`) for cross-site protection.
* **Rotate signing/encryption keys** periodically if you use `SignedCookies` or `PrivateCookies`.
* **Avoid storing sensitive data** directly in cookies unless encrypted via private cookies.

## Additional Examples

* [Basic Cookies](https://github.com/RomanEmreis/volga/blob/main/examples/cookies/src/main.rs)
* [Signed Cookies](https://github.com/RomanEmreis/volga/blob/main/examples/signed_cookies/src/main.rs)
* [Private Cookies](https://github.com/RomanEmreis/volga/blob/main/examples/private_cookies/src/main.rs)

