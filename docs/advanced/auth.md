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

```rust
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
        status!(401, "Unauthorized", [
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

## Defining Claims

The `jwt-auth-full` feature enables the [`Claims`](https://docs.rs/volga/latest/volga/auth/derive.Claims.html) derive macro for defining JWT claims. Alternatively, you can define claims using:

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

```rust
use volga::auth::AuthClaims;

#[derive(Deserialize)]
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

### Example

```rust
use serde::Deserialize;
use volga::auth::{
    AuthClaims, Authorizer
    role, roles, permission, permissions, predicate
};

#[derive(Deserialize)]
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

## Examples
* [Basic Auth Example](https://github.com/RomanEmreis/volga/blob/main/examples/cookies/src/main.rs)
* [JWT Example](https://github.com/RomanEmreis/volga/blob/main/examples/jwt/src/main.rs)
