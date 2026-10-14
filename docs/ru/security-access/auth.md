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

### Конфигурация Bearer Auth

[`BearerAuthConfig`](https://docs.rs/volga/latest/volga/auth/bearer/struct.BearerAuthConfig.html) применяет следующие политики безопасности по-умолчанию:

* **[`require_https`](https://docs.rs/volga/latest/volga/auth/bearer/struct.BearerAuthConfig.html#method.require_https)** **включён** — non-TLS запросы (кроме loopback) отклоняются с `400 Bad Request`. Отключите этот флаг для развёртываний за обратным прокси, где TLS терминируется выше.
* **[`strip_token_from_request`](https://docs.rs/volga/latest/volga/auth/bearer/struct.BearerAuthConfig.html#method.strip_token_from_request)** **включён** — заголовок `Authorization` удаляется из запроса после успешной валидации. Отключите, если нижестоящим обработчикам нужен доступ к токену.

```rust
let mut app = App::new()
    .with_bearer_auth(|auth| auth
        .set_decoding_key(DecodingKey::from_secret(secret.as_bytes()))
        .require_https(false)             // отключить для развёртываний за обратным прокси
        .strip_token_from_request(false)  // оставить заголовок Authorization для дальнейших обработчиков
    );
```

При настройке валидации аудитории через [`with_aud(...)`](https://docs.rs/volga/latest/volga/auth/bearer/struct.BearerAuthConfig.html#method.with_aud) claim `aud` автоматически добавляется в список обязательных — токены без него отклоняются. Чтобы разрешить токены без `aud`, вызовите [`without_strict_aud()`](https://docs.rs/volga/latest/volga/auth/bearer/struct.BearerAuthConfig.html#method.without_strict_aud):

```rust
let mut app = App::new()
    .with_bearer_auth(|auth| auth
        .set_decoding_key(DecodingKey::from_secret(secret.as_bytes()))
        .with_aud(["my-service"])
        .without_strict_aud()
    );
```

Валидация эмитента через [`with_iss(...)`](https://docs.rs/volga/latest/volga/auth/bearer/struct.BearerAuthConfig.html#method.with_iss) работает так же, но без возможности отказаться: начиная с **0.13.3** claim `iss` становится обязательным, поэтому токен без него отклоняется с `401` — так же, как токен с эмитентом не из списка. Пустой список оставляет конфигурацию как есть.

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
`with_iss` — это то, чем сервер ресурсов отличает свои токены от остальных, подписанных тем же ключом, например HMAC-секретом, общим для нескольких сервисов. Если часть токенов, которые он должен принимать, не несёт `iss`, начиная с **0.13.3** они отклоняются: попросите эмитента добавить claim или не задавайте `with_iss`.
:::

::: info
`EncodingKey`, `DecodingKey` и `Algorithm` — собственные типы Волги в `volga::auth::*`, а не реэкспорты из `jsonwebtoken`, поэтому `jsonwebtoken::ErrorKind` и его конструкторы ключей недоступны: ключи создаются конструкторами PEM / base64 / secret / env / file, которые предоставляет Волга, а начиная с **0.13.2** — и из [JSON Web Key](#ключ-опубликованныи-как-json-web-key). Параметры валидации токена настраиваются через [`BearerAuthConfig`](https://docs.rs/volga/latest/volga/auth/bearer/struct.BearerAuthConfig.html).

Начиная с **v0.9.8**, `volga::auth::Algorithm` — это реэкспорт [`JwsAlgorithm`](https://docs.rs/volga-oauth-core/latest/volga_oauth_core/enum.JwsAlgorithm.html) из `volga-oauth-core`: варианты, значение по-умолчанию `HS256` и поведение не изменились, но теперь тип общий с клиентскими крейтами — утверждение `private_key_jwt` и bearer-токен, который выпускает сервер, описываются одним словарём. Он также реэкспортируется из `volga::auth::oauth`, где его можно назвать без флага `jwt-auth`.
:::

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

### Алгоритмы и типы ключей

Если не указано иное, токены подписываются и проверяются алгоритмом `HS256` с HMAC-секретом. Любой другой алгоритм — и любой ключ RSA, EC или Ed25519 — задаётся через [`with_alg()`](https://docs.rs/volga/latest/volga/auth/bearer/struct.BearerAuthConfig.html#method.with_alg). Первый вызов заменяет `HS256` по-умолчанию, а последующие добавляют алгоритмы в список:

```rust compile-fragment
use volga::auth::{Algorithm, DecodingKey, EncodingKey};

let app = App::new()
    .with_bearer_auth(|auth| auth
        .set_encoding_key(EncodingKey::from_pem_file("/etc/volga/rs256.pem"))
        .set_decoding_key(DecodingKey::from_pem_file("/etc/volga/rs256.pub.pem"))
        .with_alg(Algorithm::RS256)   // заменяет HS256
        .with_alg(Algorithm::PS256)); // и принимает ещё и токены PS256
```

Токен принимается, только если он подписан одним из алгоритмов списка. [`BearerTokenService::encode`](https://docs.rs/volga/latest/volga/auth/bearer/struct.BearerTokenService.html#method.encode) подписывает первым из них — здесь `RS256`, а если `with_alg` не вызывался, то `HS256`.

Каждый алгоритм относится к своему семейству, и каждому семейству нужен свой вид ключа:

| Алгоритмы | Ключ | Конструкторы |
|---|---|---|
| `HS256`, `HS384`, `HS512` | HMAC-секрет | `from_secret`, `from_base64_secret`, `from_file`, `from_env`, `from_env_base64`, JWK вида `oct` |
| `RS256`, `RS384`, `RS512`, `PS256`, `PS384`, `PS512` | RSA-ключ | `from_rsa_pem`, `from_pem_file`, JWK вида `RSA` |
| `ES256`, `ES384` | EC-ключ (P-256, P-384) | `from_ec_pem`, `from_pem_file`, JWK вида `EC` |
| `EdDSA` | ключ Ed25519 | `from_ed_pem`, `from_pem_file`, JWK вида `OKP` |

Ключ проверки (decoding) должен подходить **каждому** алгоритму, который называет `with_alg`, а ключ подписи (encoding) — **первому**. Начиная с **0.13.3** неподходящий ключ останавливает приложение при старте: `App::run` возвращает ошибку, в которой названы ключ, алгоритмы, которые он обслужить не может, и те, которые может.

```text
Bearer auth: the decoding key is an RSA key, which cannot verify HS256 tokens (the default without `with_alg`); `with_alg` must name only RS256, RS384, RS512, PS256, PS384 or PS512
```

::: tip
Ключ RSA, EC или Ed25519 всегда идёт вместе с `with_alg`: без него в списке остаётся `HS256` по-умолчанию, а его обслуживает только HMAC-секрет, — это и есть ошибка выше. А поскольку ключ проверки один, все перечисленные алгоритмы относятся к одному семейству.
:::

::: warning
`with_alg` задаёт список целиком. Начиная с **0.13.3**, один `.with_alg(Algorithm::HS512)` принимает только токены `HS512`; чтобы по-прежнему принимать и `HS256` — например, пока клиенты переходят с одного на другой, — назовите оба, первым тот, которым должен подписывать `encode`:

```rust compile-fragment
use volga::auth::{Algorithm, DecodingKey, EncodingKey};

let secret = std::env::var("JWT_SECRET")?;

let app = App::new()
    .with_bearer_auth(|auth| auth
        .set_encoding_key(EncodingKey::from_secret(secret.as_bytes()))
        .set_decoding_key(DecodingKey::from_secret(secret.as_bytes()))
        .with_alg(Algorithm::HS512)   // токены, выпускаемые с этого момента
        .with_alg(Algorithm::HS256)); // выпущенные раньше, пока не истекут
```
:::

[Валидации по эмитенту](#валидация-токенов-по-oauth-2-1-oidc-эмитенту) `with_alg` для проверки токенов не нужен: статического ключа проверки нет, и каждый токен проверяется алгоритмом, который JWKS эмитента указывает для его ключа.

### Ключ, опубликованный как JSON Web Key

Эмитенты публикуют ключи проверки подписи в виде JSON Web Key (RFC 7517), а не PEM-файлов. Начиная с **0.13.2**, [`DecodingKey::from_jwk()`](https://docs.rs/volga/latest/volga/auth/decoding_key/struct.DecodingKey.html#method.from_jwk) создаёт ключ из такого описания — RSA, EC, Ed25519 (`OKP`) или симметричный `oct`. Он принимает один ключ в виде JSON-текста, например один элемент массива `keys` из JWKS эмитента:

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

Собственные поля ключа `alg`, `use` и `key_ops` не читаются: алгоритм, которым должны быть подписаны токены, задаётся через [`with_alg()`](https://docs.rs/volga/latest/volga/auth/bearer/struct.BearerAuthConfig.html#method.with_alg) — так же, как для PEM-ключа. `from_jwk` возвращает ошибку, если текст не является JSON Web Key — целый набор ключей (`{"keys": [...]}`) тоже им не является — или указывает неподдерживаемый тип ключа или кривую.

::: warning
Ключ, загруженный таким образом, статичен: он не следует за ротацией ключей эмитента, и токены, подписанные новым ключом, отклоняются до повторного развёртывания приложения. Для эмитента, который ротирует ключи, используйте валидацию по эмитенту (ниже) — с [`with_jwks_uri`](./oauth.md#когда-url-эмитента-недоступен-с-сервера), если сервер не может достучаться до собственного URL эмитента.
:::

### Валидация токенов по OAuth 2.1 / OIDC-эмитенту

Вместо настройки статического ключа сервер ресурсов может валидировать Bearer-токены по опубликованным ключам OAuth 2.1 / OIDC-эмитента — без общего секрета. Опишите эмитента через [`with_oauth(...)`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.with_oauth) и подключите через [`use_oauth()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.use_oauth):

```rust compile-fragment
let mut app = App::new()
    .with_bearer_auth(|auth| auth.with_aud(["https://api.example.com"]))
    .with_oauth(|oauth| oauth.with_issuer("https://auth.example.com"));

app.use_oauth();
```

Полный флоу (валидация по эмитенту, ротация ключей и отдача метаданных) описан на странице [OAuth 2.1 и OpenID Connect](./oauth.md), а запуск флоу Authorization Code + PKCE — на странице [OAuth 2.1 Клиент](./oauth-client.md).

## Определение структуры Claims

Для удобства `jwt-auth-full` включает derive-макрос [`Claims`](https://docs.rs/volga/latest/volga/auth/derive.Claims.html) для объявления структуры claim'ов. Но вы также можете использовать альтернативные способы:

::: warning
Derive работает только со **структурами**: payload JWT — это JSON-объект, поэтому `#[derive(Claims)]` на enum или union — ошибка компиляции. Структура, в которой нет ни одного из полей `role` / `roles` / `permissions`, допустима: у всех методов трейта есть реализация по умолчанию.
:::

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

## Декларативный контроль доступа с `Authorizer`

Волга предоставляет гибкую систему контроля доступа с помощью [`Authorizer`](https://docs.rs/volga/latest/volga/auth/authorizer/enum.Authorizer.html). 

Вы можете проверять доступ по:
* [`role("admin")`](https://docs.rs/volga/latest/volga/auth/authorizer/fn.role.html) - одной роли.
* [`roles(["admin", "user"])`](https://docs.rs/volga/latest/volga/auth/authorizer/fn.roles.html) - по списку ролей.
* [`permission("write")`](https://docs.rs/volga/latest/volga/auth/authorizer/fn.permission.html) - по одному разрешению.
* [`permissions(["read", "write"])`](https://docs.rs/volga/latest/volga/auth/authorizer/fn.permissions.html) - по списку разрешений.
* [`predicate(|claims| ...)`](https://docs.rs/volga/latest/volga/auth/authorizer/fn.predicate.html) - кастомная логика.

::: info
Все пять реэкспортируются из `volga::auth`; полный путь — [`volga::auth::authorizer::permission`](https://docs.rs/volga/latest/volga/auth/authorizer/fn.permission.html) и остальные — тоже работает. В **0.9.8 и раньше** `permission` доступна только по полному пути, а подсказка компилятора, `permissions`, — это другая функция.
:::

### Пример

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
Вы также можете объединять правила в цепочку с помощью комбинаторов [`and()`](https://docs.rs/volga/latest/volga/auth/authorizer/enum.Authorizer.html#method.and) и [`or()`](https://docs.rs/volga/latest/volga/auth/authorizer/enum.Authorizer.html#method.or) для создания комплексных правил.
:::

## Чем отвечает сервер на отклонённый запрос

Каждый отказ middleware аутентификации несёт тот статус и тот вызов `WWW-Authenticate`, которые назначает ему RFC 6750 §3.1, — чтобы клиент мог отличить «почини заголовок» от «получи новый токен» и от «вернись позже», не разбирая текст сообщения:

| Что произошло | Статус | Challenge |
|---|---|---|
| Заголовка `Authorization` нет вовсе | `401` | голый `Bearer` — без кода ошибки, чтобы клиент мог найти метаданные ресурса и начать флоу |
| Заголовок `Authorization` есть, но это не корректное bearer-удостоверение — другая схема, пустой токен | `400` | `invalid_request` |
| Запрос по обычному HTTP при включённом [`require_https`](https://docs.rs/volga/latest/volga/auth/bearer/struct.BearerAuthConfig.html#method.require_https) | `400` | `invalid_request`, `HTTPS required` |
| Токен не прошёл проверку: истёк, ещё не действителен, неверная подпись, неверные `iss` / `aud` / `sub` / алгоритм, отсутствует обязательный claim — или он вовсе не декодируется | `401` | `invalid_token`, причина — в `error_description` |
| Токен действителен, но не несёт роли или разрешения, которых требует маршрут | `403` | `insufficient_scope` |
| Проверку не удалось выполнить — нечитаемый ключ проверки, недоступный issuer | `503` | нет: чинить клиенту нечего |

::: warning При переходе с 0.10.0
Токен, не прошедший проверку, получал `403`, а некорректный — `400`. Теперь и то и другое — `401`, поэтому всё, что трактует `403` как «этот токен обновлять бесполезно» — тест, триггер обновления в клиенте, алерт, — нужно перевести на `401`.
:::

## Примеры
* [Basic Auth](https://github.com/RomanEmreis/volga/blob/main/examples/cookies/src/main.rs)
* [JWT](https://github.com/RomanEmreis/volga/blob/main/examples/jwt/src/main.rs)
