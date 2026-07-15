# OAuth 2.1 Клиент

`volga-oauth-client` — это клиент OAuth 2.1 / OpenID Connect, построенный на общих типах протокола из `volga-oauth-core`. Он **не зависит от серверного крейта `volga`** — его можно использовать в любом Tokio-приложении (CLI, фоновом воркере или веб-приложении на Волге, реализующем флоу входа).

Он предоставляет три клиента, разделяющих транспортную политику [`ClientConfig`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.ClientConfig.html) и модель ошибок [`ClientError`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/enum.ClientError.html):

* [`DiscoveryClient`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.DiscoveryClient.html) — загружает Authorization Server Metadata (RFC 8414), Protected Resource Metadata (RFC 9728) и конфигурацию провайдера OpenID Connect.
* [`OAuthClient`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.OAuthClient.html) — флоу Authorization Code с обязательным PKCE, refresh-токенами и индикаторами ресурсов, плюс сохранение токенов.
* [`RegistrationClient`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.RegistrationClient.html) — динамическую регистрацию клиентов (RFC 7591).

## Зависимости

```toml
[dependencies]
volga-oauth-client = { version = "..." }
```

### Feature-флаги

| Флаг | Что включает |
|---|---|
| `http1` (по-умолчанию) | HTTP/1.1 через hyper |
| `http2` | HTTP/2 через hyper; согласуется через TLS ALPN при совместном использовании с `http1`, либо используется эксклюзивно (prior knowledge поверх plaintext) без него |

Как минимум один из двух должен быть включён.

## Discovery

[`DiscoveryClient`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.DiscoveryClient.html) разрешает well-known discovery-URL, загружает документы по HTTPS и проверяет каждый на соответствие идентификатору, для которого он был запрошен (RFC 8414 §3.3 / RFC 9728 §3.3):

```rust
use volga_oauth_client::{ClientError, DiscoveryClient};

async fn discover() -> Result<(), ClientError> {
    let client = DiscoveryClient::new();

    // напрямую по идентификатору эмитента (RFC 8414 или путь OIDC):
    let server = client.fetch_server_metadata("https://auth.example.com").await?;

    // или начиная с ресурса и следуя к его серверу авторизации:
    let resource = client.fetch_resource_metadata("https://api.example.com").await?;
    let server = client.discover_authorization_server(&resource).await?;

    assert!(server.token_endpoint.is_some());
    Ok(())
}
```

* [`fetch_server_metadata`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.DiscoveryClient.html#method.fetch_server_metadata) / [`fetch_oidc_metadata`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.DiscoveryClient.html#method.fetch_oidc_metadata) — один и тот же вид документа по путям RFC 8414 и OIDC Discovery.
* [`fetch_resource_metadata`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.DiscoveryClient.html#method.fetch_resource_metadata) / [`fetch_resource_metadata_from_url`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.DiscoveryClient.html#method.fetch_resource_metadata_from_url) — второй берёт URL `resource_metadata` прямо из заголовка `WWW-Authenticate`.
* [`discover_authorization_server`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.DiscoveryClient.html#method.discover_authorization_server) — берёт первый объявленный сервер авторизации и загружает его метаданные, автоматически откатываясь с пути RFC 8414 на путь OIDC.
* [`fetch_jwks`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.DiscoveryClient.html#method.fetch_jwks) / [`fetch_jwks_from_url`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.DiscoveryClient.html#method.fetch_jwks_from_url) — набор ключей JSON Web Key Set эмитента в виде сырого JSON.

::: tip
Подключите [`MetadataCache`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/trait.MetadataCache.html) через [`with_cache(...)`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.DiscoveryClient.html#method.with_cache), чтобы переиспользовать имеющееся хранилище; discovery-документы меняются редко. Загрузки JWKS намеренно обходят кэш в обе стороны — ключи подписи ротируются, поэтому политика свежести остаётся за вами.
:::

## Authorization Code + PKCE

[`OAuthClient`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.OAuthClient.html) реализует флоу OAuth 2.1 Authorization Code. PKCE (S256) генерируется и применяется автоматически — это защита, которую OAuth 2.1 предписывает для публичных клиентов.

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

    // 1. строим запрос авторизации (state и PKCE генерируются)
    let auth = client
        .authorization_request(&metadata)
        .with_scopes(["read"])
        .with_resource("https://api.example.com")
        .build()?;

    // 2. отправляем пользователя на `auth.url`; затем в callback-редиректе:
    let (code, state) = ("code", "state");
    assert!(auth.matches_state(state)); // всегда проверяйте — защита от CSRF

    // 3. обмениваем код на токены (verifier PKCE идёт вместе с запросом)
    let tokens = client.exchange_code(&metadata, code, &auth).await?;
    client.store_tokens("alice", &tokens);

    // 4. позже — отдаётся из хранилища, прозрачно обновляется при устаревании:
    let tokens = client.token("alice", &metadata).await?;
    Ok(())
}
```

[`AuthorizationRequest`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.AuthorizationRequest.html), возвращаемый методом [`build()`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.AuthorizationRequestBuilder.html#method.build), содержит `url` для редиректа, `state` для проверки в callback и пару PKCE. Он реализует `Serialize`/`Deserialize`, так что веб-приложение может сохранить его в сессии между редиректом и callback.

Построитель запроса принимает [`with_scopes`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.AuthorizationRequestBuilder.html#method.with_scopes), [`with_resource`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.AuthorizationRequestBuilder.html#method.with_resource) (RFC 8707, можно повторять), [`with_state`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.AuthorizationRequestBuilder.html#method.with_state) (переопределить сгенерированное значение) и [`with_param`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.AuthorizationRequestBuilder.html#method.with_param) (например, OIDC `nonce` или `prompt`).

::: warning
Всегда проверяйте `state` из callback через [`matches_state`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.AuthorizationRequest.html#method.matches_state) **до** обмена кода — это ваша защита от CSRF.
:::

### Прозрачное обновление

[`token(key, &metadata)`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.OAuthClient.html#method.token) читает сохранённые токены и незаметно обновляет устаревший access-токен. Он возвращает `Ok(None)`, когда требуется интерактивная авторизация — ничего не сохранено, у записи нет refresh-токена или сервер отклонил refresh-токен (`invalid_grant`); в последних случаях «мёртвая» запись удаляется из хранилища. Можно также обновить явно через [`refresh`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.OAuthClient.html#method.refresh).

### Конфиденциальные клиенты

Без секрета клиент работает как **публичный клиент** (защитой служит PKCE). Добавьте секрет, чтобы аутентифицироваться на token-эндпоинте:

```rust
use volga_oauth_client::{ClientAuthMethod, OAuthClient};

let client = OAuthClient::new("my-client")
    .with_secret("s3cret")
    // `client_secret_basic` (по-умолчанию) или `client_secret_post`
    .with_auth_method(ClientAuthMethod::Post);
```

## Хранилище токенов

Сохранение выполняется через трейт [`TokenStore`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/trait.TokenStore.html). [`InMemoryTokenStore`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.InMemoryTokenStore.html) — встроенная реализация в памяти процесса, подходящая для CLI, тестов и одноинстансовых сервисов; всё долговременное (БД, зашифрованный файл, связка ключей ОС) реализуется одной реализацией трейта.

```rust
use volga_oauth_client::{TokenSet, TokenStore};

struct MyStore;

impl TokenStore for MyStore {
    fn get(&self, key: &str) -> Option<TokenSet> { /* ... */ None }
    fn put(&self, key: &str, tokens: &TokenSet) { /* ... */ }
    fn remove(&self, key: &str) { /* ... */ }
}
```

Ключ выбирает приложение — обычно идентификатор пользователя или сессии, при необходимости в сочетании с ресурсом, когда один клиент обслуживает несколько аудиторий. [`TokenSet`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.TokenSet.html) содержит access-токен, опциональный refresh-токен, выданный scope, OIDC `id_token` (передаётся как есть, без валидации) и абсолютное время `expires_at`; в выводе `Debug` токены скрыты.

## Динамическая регистрация клиентов

[`RegistrationClient`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.RegistrationClient.html) отправляет [`ClientMetadata`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.ClientMetadata.html) на registration-эндпоинт сервера (RFC 7591) и возвращает выданные учётные данные. [`OAuthClient::from_registration`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.OAuthClient.html#method.from_registration) принимает их и создаёт готовый к использованию клиент:

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

    // готовый к использованию клиент с выданными учётными данными
    let client = OAuthClient::from_registration(&registered)?;
    Ok(())
}
```

Для серверов, не разрешающих открытую регистрацию, добавьте начальный токен доступа через [`with_initial_access_token`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.RegistrationClient.html#method.with_initial_access_token).

::: info
Протокол управления RFC 7592 (чтение, обновление и удаление регистрации) не реализован, но пара `registration_access_token` / `registration_client_uri` из ответа доступна для приложений, которым она нужна.
:::

## Транспортная политика и ошибки

[`ClientConfig`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.ClientConfig.html) несёт политику, общую для всех операций клиента — принудительный HTTPS, таймауты на запрос и лимиты редиректов. Значения по-умолчанию безопасны для продакшена; чаще всего переопределяют отключение HTTPS для локального сервера разработки:

```rust
use std::time::Duration;
use volga_oauth_client::{ClientConfig, OAuthClient};

let config = ClientConfig::new()
    .require_https(false)              // только для локальной разработки
    .with_timeout(Duration::from_secs(5))
    .with_max_redirects(0);

let client = OAuthClient::new("my-client").with_config(config);
```

[`ClientError`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/enum.ClientError.html) отделяет разобранный ответ об ошибке OAuth (`Protocol`, несущий [`OAuthError`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.OAuthError.html) из RFC 6749 §5.2) от ошибок транспорта, декодирования, небезопасного URL и валидации — так вы можете отличить «сервер ответил `invalid_grant`» от «соединение оборвалось».

## Примеры
* [OAuth Flow](https://github.com/RomanEmreis/volga/blob/main/examples/oauth_flow/src/main.rs) — полный флоу discovery → авторизация → обмен кода → вызов защищённого маршрута, реализованный через `volga-oauth-client`.
