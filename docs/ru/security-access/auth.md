# Аутентификация и авторизация

Волга предоставляет гибкие инструменты для реализации аутентификации и авторизации в веб-приложениях. Поддерживаются как базовая аутентификация (Basic Auth), так и токены доступа на основе JWT (Bearer Token). Также доступна система контроля доступа по ролям, разрешениям или пользовательским правилам.

## Базовая аутентификация (Basic Auth)

Базовая аутентификация — это простой механизм проверки логина и пароля через HTTP-заголовок `Authorization: Basic`.

### Зависимости

```toml
[dependencies]
volga = { version = "...", features = ["basic-auth"] }
```

### Пример

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
    // В реальном приложении читаем данные из БД или хранилища
    ("foo".into(), "bar".into())
}
```

Структура [`Basic`](https://docs.rs/volga/latest/volga/auth/basic/struct.Basic.html) автоматически извлекает заголовок авторизации и предоставляет методы [`validate()`](https://docs.rs/volga/latest/volga/auth/basic/struct.Basic.html#method.validate) и [`validate_base64()`](https://docs.rs/volga/latest/volga/auth/basic/struct.Basic.html#method.validate_base64) для проверки логина и пароля.

## Аутентификация через JWT (Bearer Token)

JWT (JSON Web Token) предоставляет расширенные возможности: аутентификацию с данными (claims) и авторизацию по ролям и правам доступа.

### Зависимости

```toml
[dependencies]
volga = { version = "...", features = ["jwt-auth-full"] }
```

### Генерация токена

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

### Использование JWT

Промежуточное ПО [authorize()](https://docs.rs/volga/latest/volga/app/struct.App.html#method.authorize) предоставляет инструменты для реализации управления доступом на основе ролей или разрешений и может быть определено для отдельного маршрута, группы маршрутов или всего приложения.

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
Для корректной работы JWT-аутентификации, необходимо использовать один и тот же `JWT_SECRET` как при генерации токена, так и при его проверке на защищённых маршрутах.
Этот секрет используется для подписания токена на этапе генерации и проверки подписи на этапе валидации. Если секреты отличаются - токен будет отклонён как недействительный.
:::

## Определение структуры Claims

Для удобства `jwt-auth-full` включает derive-макрос [`Claims`](https://docs.rs/volga/latest/volga/auth/derive.Claims.html) для объявления структуры claim'ов. Но вы также можете использовать альтернативные способы:

### Макрос `claims!`

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

### Ручная реализация

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

## Декларативный контроль доступа с `Authorizer`

Волга предоставляет гибкую систему контроля доступа с помощью [`Authorizer`](https://docs.rs/volga/latest/volga/auth/authorizer/enum.Authorizer.html). 

Вы можете проверять доступ по:
* [`role("admin")`](https://docs.rs/volga/latest/volga/auth/authorizer/fn.role.html) - одной роли.
* [`roles(["admin", "user"])`](https://docs.rs/volga/latest/volga/auth/authorizer/fn.roles.html) - по списку ролей.
* [`permission("write")`](https://docs.rs/volga/latest/volga/auth/authorizer/fn.permission.html) - по одному разрешению.
* [`permissions(["read", "write"])`](https://docs.rs/volga/latest/volga/auth/authorizer/fn.permissions.html) - по списку разрешений.
* [`predicate(|claims| ...)`](https://docs.rs/volga/latest/volga/auth/authorizer/fn.predicate.html) - кастомная логика.

### Пример

```rust
use volga::auth::{AuthClaims, role, roles, permission, permissions, predicate, Authorizer};
use serde::Deserialize;

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
Вы также можете объединять правила в цепочку с помощью комбинаторов [`and()`](https://docs.rs/volga/latest/volga/auth/authorizer/enum.Authorizer.html#method.and) и [`or()`](https://docs.rs/volga/latest/volga/auth/authorizer/enum.Authorizer.html#method.or) для создания комплексных правил.
:::

## Примеры
* [Basic Auth](https://github.com/RomanEmreis/volga/blob/main/examples/cookies/src/main.rs)
* [JWT](https://github.com/RomanEmreis/volga/blob/main/examples/jwt/src/main.rs)

