# OAuth 2.1 и OpenID Connect

Волга предоставляет полноценную основу для OAuth 2.1 / OpenID Connect поверх [аутентификации через Bearer Token](./auth.md). Она позволяет создавать **сервер ресурсов (resource server)**, который валидирует токены по опубликованным ключам OAuth 2.1 / OIDC-эмитента (issuer) — без общего секрета — а также **отдавать документы метаданных (discovery)**, необходимые клиентам для запуска флоу.

Типы уровня протокола (модели ошибок, документы метаданных, построитель заголовка `WWW-Authenticate`, вывод well-known URL) находятся в модуле [`volga::auth::oauth`](https://docs.rs/volga/latest/volga/auth/oauth/index.html) и совместно используются с отдельным [OAuth-клиентом](./oauth-client.md).

## Feature-флаги

| Feature | Что включает |
|---|---|
| `oauth` | Базовые типы OAuth 2.1 / OIDC в `volga::auth::oauth` и отдачу метаданных (включается вместе с `jwt-auth`). |
| `oauth-client` | Валидацию токенов по эмитенту — `App::with_oauth` / `App::use_oauth`. Включает `jwt-auth`. |

```toml
[dependencies]
volga = { version = "...", features = ["oauth-client"] }
```

## Валидация токенов по эмитенту

Вместо настройки статического [`DecodingKey`](https://docs.rs/volga/latest/volga/auth/decoding_key/struct.DecodingKey.html) можно направить Bearer-аутентификацию на OAuth 2.1 / OIDC-эмитента. Волга загружает метаданные сервера эмитента (RFC 8414, с откатом на OpenID Connect Discovery) и объявленный им набор ключей JSON Web Key Set, после чего валидирует входящие JWT, выбирая ключ по `kid` каждого токена.

Опишите эмитента через [`with_oauth(...)`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.with_oauth) и явно активируйте через [`use_oauth()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.use_oauth):

```rust
use serde::Deserialize;
use volga::{
    App, ok,
    auth::{AuthClaims, roles},
};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new()
        // аудитория, срок действия и прочие проверки токена остаются здесь
        .with_bearer_auth(|auth| auth.with_aud(["https://api.example.com"]))
        // ключи и ограничение `iss` приходят от эмитента
        .with_oauth(|oauth| oauth.with_issuer("https://auth.example.com"));

    // явное подключение — до этого вызова валидация по эмитенту не работает
    app.use_oauth();

    app.map_get("/protected", protected)
        .authorize::<Claims>(roles(["admin"]));

    app.run().await
}

async fn protected() -> &'static str {
    "Hello from the protected route!"
}

#[derive(Clone, Deserialize)]
struct Claims {
    role: String,
}

impl AuthClaims for Claims {
    fn role(&self) -> Option<&str> {
        Some(&self.role)
    }
}
```

При валидации по эмитенту статический ключ расшифровки не нужен — ключи разрешаются во время выполнения. Всё остальное (`aud`, срок действия, scope и роли) по-прежнему берётся из [`with_bearer_auth`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.with_bearer_auth).

::: info
Claim `iss` автоматически ограничивается настроенным эмитентом и делается **обязательным** — токены без него или с другим эмитентом отклоняются.
:::

### Жизненный цикл ключей

Ключи загружаются лениво при первом запросе и кэшируются, поэтому в типичном случае валидация токена не требует обращения по сети. Кэш поддерживает себя сам:

* Токен с **неизвестным `kid`** запускает обновление (ротация ключей), ограниченное по частоте через [`with_refresh_cooldown`](https://docs.rs/volga/latest/volga/auth/oauth_client/struct.OAuthConfig.html#method.with_refresh_cooldown) (по-умолчанию 60 с); одновременные промахи разделяют одно обновление.
* Известные `kid` **перепроверяются** у эмитента, как только кэшированный набор становится старше [`with_max_key_age`](https://docs.rs/volga/latest/volga/auth/oauth_client/struct.OAuthConfig.html#method.with_max_key_age) (по-умолчанию 15 минут), так что отозванный или переизданный `kid` перестаёт валидироваться без перезапуска.
* Пока эмитент **недоступен**, а ключи уже были загружены, продолжает работать последний известный набор — сбой эмитента не роняет валидацию токенов. Если же ключи ни разу не загрузились, защищённые маршруты отвечают `503` (проблема на стороне сервера), а не обвиняют токен.

### Конфигурация

Эмитент обязателен; у всего остального есть безопасные для продакшена значения по-умолчанию.

```rust
use std::time::Duration;
use volga::App;

let app = App::new()
    .with_bearer_auth(|auth| auth.with_aud(["https://api.example.com"]))
    .with_oauth(|oauth| oauth
        .with_issuer("https://auth.example.com")
        .with_refresh_cooldown(Duration::from_secs(30))
        .with_max_key_age(Duration::from_secs(600))
        // транспортная политика для discovery / JWKS
        .with_client_config(|client| client.require_https(true)));
```

Для локального эмитента, работающего по обычному HTTP, ослабьте транспортную политику:

```rust
let app = App::new()
    .with_oauth(|oauth| oauth
        .with_issuer("http://127.0.0.1:5000")
        .with_client_config(|client| client.require_https(false)));
```

С feature `config` те же параметры можно описать в секции `[oauth.client]` файла конфигурации — поля из файла переопределяют вызовы построителя, неизвестные ключи приводят к ошибке при старте, а активация всё так же требует явного вызова `App::use_oauth()` в коде:

```toml
[oauth.client]
issuer = "https://auth.example.com"
refresh_cooldown_secs = 60   # опционально
max_key_age_secs = 900       # опционально
require_https = true         # опционально
timeout_secs = 30            # опционально
max_redirects = 5            # опционально
```

## Отдача документов метаданных

Сервер ресурсов сообщает клиентам, где аутентифицироваться; сервер авторизации публикует свои эндпоинты и ключи. Волга отдаёт оба discovery-документа прямо из вашего приложения.

### Protected Resource Metadata (RFC 9728)

Настройте через [`with_oauth_resource_metadata`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.with_oauth_resource_metadata) (или [`set_oauth_resource_metadata`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.set_oauth_resource_metadata) для передачи значения целиком, включая сокращение через `&str`-идентификатор) и отдайте через [`use_oauth_resource_metadata`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.use_oauth_resource_metadata):

```rust
let mut app = App::new()
    .with_oauth_resource_metadata(|metadata| metadata
        .with_resource("https://api.example.com")
        .with_authorization_servers(["https://auth.example.com"])
        .with_scopes(["read", "write"])
        .with_bearer_methods(["header"]));

// GET /.well-known/oauth-protected-resource
app.use_oauth_resource_metadata();
```

Когда настроена Bearer-аутентификация, выведенный URL метаданных автоматически объявляется в заголовках `WWW-Authenticate` (RFC 9728 §5.1), так что неаутентифицированный клиент может узнать, где ему аутентифицироваться, и начать флоу.

### Authorization Server Metadata (RFC 8414) и OIDC Discovery

Приложения, которые сами являются сервером авторизации, публикуют свои эндпоинты через [`with_oauth_server_metadata`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.with_oauth_server_metadata) и отдают документ по одному или обоим discovery-путям:

```rust
let mut app = App::new()
    .with_oauth_server_metadata(|metadata| metadata
        .with_issuer("https://auth.example.com")
        .with_authorization_endpoint("https://auth.example.com/authorize")
        .with_token_endpoint("https://auth.example.com/token")
        .with_jwks_uri("https://auth.example.com/jwks"));

// серверы авторизации обычно публикуют один и тот же документ по обоим путям:
app.use_oauth_server_metadata()  // GET /.well-known/oauth-authorization-server
   .use_oidc_metadata();         // GET /.well-known/openid-configuration
```

::: tip
Замыкание для метаданных сервера предзаполняется значениями OAuth 2.1: `response_types_supported = ["code"]` и `grant_types_supported = ["authorization_code"]`. OIDC-специфичные поля, обязательные для совместимого документа провайдера (`subject_types_supported`, `id_token_signing_alg_values_supported`, `userinfo_endpoint`, …), можно задать через [`with_additional_field(...)`](https://docs.rs/volga/latest/volga/auth/oauth/struct.AuthorizationServerMetadata.html#method.with_additional_field).
:::

Два поля, которые стоит назвать отдельно, стали типизированными построителями в **v0.9.6** и **v0.9.8**:

```rust
let mut app = App::new()
    .with_oauth_server_metadata(|metadata| metadata
        .with_issuer("https://auth.example.com")
        // RFC 9207: параметр `iss` возвращается в ответах авторизации,
        // что позволяет клиентам обнаружить подмену сервера авторизации
        .with_authorization_response_iss_parameter(true)
        // RFC 9449: алгоритмы, принимаемые в доказательствах DPoP
        .with_dpop_signing_algs(["ES256"]));
```

Объявление поддержки RFC 9207 делает её **обязательной** для клиентов: [валидация callback](/volga-docs/ru/security-access/oauth-client.html#валидация-callback) в `volga-oauth-client` после этого отклонит ответ без `iss`. Метод `with_authorization_response_iss_parameter` также принимается в секции `[oauth.server]` файла конфигурации. Клиентская половина второго описана в разделе [DPoP](/volga-docs/ru/security-access/dpop.html); на стороне ресурса поле `dpop_signing_alg_values_supported` доступно у [`ProtectedResourceMetadata`](https://docs.rs/volga/latest/volga/auth/oauth/struct.ProtectedResourceMetadata.html) под тем же именем.

Оба документа также могут приходить из секций `[oauth.resource]` / `[oauth.server]` файла конфигурации (feature `config`); файл переопределяет предыдущие вызовы построителя. Сокращение `set_*` настраивает минимальный документ только по идентификатору:

```rust
let mut app = App::new()
    .set_oauth_resource_metadata("https://api.example.com")
    .set_oauth_server_metadata("https://auth.example.com");

app.use_oauth_resource_metadata();
app.use_oauth_server_metadata().use_oidc_metadata();
```

## Полный флоу

Собирая всё вместе, серверу ресурсов нужно всего несколько строк — валидация токенов напрямую привязана к опубликованным ключам эмитента, и нигде не настроен ни один секрет:

```rust
use volga::{App, auth::{AuthClaims, roles}, ok};
use serde::Deserialize;

#[derive(Clone, Deserialize)]
struct Claims { role: String }

impl AuthClaims for Claims {
    fn role(&self) -> Option<&str> { Some(&self.role) }
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new()
        .with_oauth(|oauth| oauth.with_issuer("https://auth.example.com"))
        // объявляется в заголовках WWW-Authenticate
        .with_oauth_resource_metadata(|m| m
            .with_resource("https://api.example.com")
            .with_authorization_servers(["https://auth.example.com"]));

    app.use_oauth();
    app.use_oauth_resource_metadata();

    app.map_get("/protected", || async { ok!("Hello from the protected route!") })
        .authorize::<Claims>(roles(["admin"]));

    app.run().await
}
```

Клиентская сторона того же флоу — discovery, обмен Authorization Code + PKCE и вызов защищённого маршрута — описана на странице [OAuth 2.1 Клиент](./oauth-client.md).

## Примеры
* [OAuth Flow](https://github.com/RomanEmreis/volga/blob/main/examples/oauth_flow/src/main.rs) — полный флоу Authorization Code + PKCE между сервером авторизации, сервером ресурсов и клиентом в одном процессе.
* [OAuth Metadata](https://github.com/RomanEmreis/volga/blob/main/examples/oauth_metadata/src/main.rs) — отдача discovery-документов RFC 8414 / RFC 9728 / OIDC.
