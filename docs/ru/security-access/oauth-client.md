# OAuth 2.1 Клиент

`volga-oauth-client` — это клиент OAuth 2.1 / OpenID Connect, построенный на общих типах протокола из `volga-oauth-core`. Он **не зависит от серверного крейта `volga`** — его можно использовать в любом Tokio-приложении (CLI, фоновом воркере или веб-приложении на Волге, реализующем флоу входа).

Он предоставляет три клиента, разделяющих транспортную политику [`ClientConfig`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.ClientConfig.html) и модель ошибок [`ClientError`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/enum.ClientError.html):

* [`DiscoveryClient`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.DiscoveryClient.html) — загружает Authorization Server Metadata (RFC 8414), Protected Resource Metadata (RFC 9728) и конфигурацию провайдера OpenID Connect.
* [`OAuthClient`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.OAuthClient.html) — флоу Authorization Code с обязательным PKCE, refresh-токенами и индикаторами ресурсов, плюс сохранение токенов. С **v0.9.8** он также реализует гранты, аутентифицирующие *сам клиент* — см. [Гранты «сервис-сервис»](/volga-docs/ru/security-access/machine-to-machine.html).
* [`RegistrationClient`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.RegistrationClient.html) — динамическую регистрацию клиентов (RFC 7591).

С **v0.9.8** полученные токены можно привязать к ключу клиента через [`Dpop`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.Dpop.html) (RFC 9449) — см. [DPoP](/volga-docs/ru/security-access/dpop.html).

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
| `private-key-jwt` | аутентификацию клиента `private_key_jwt` (RFC 7523 §2.2) — клиентское утверждение, подписанное собственным ключом клиента |
| `dpop` | токены, привязанные к отправителю, по DPoP (RFC 9449) |

Как минимум один из `http1` / `http2` должен быть включён.

::: info
`private-key-jwt` и `dpop` выключены по-умолчанию, потому что это единственные части крейта, которым нужен бэкенд подписи JWS (`jsonwebtoken` поверх `aws-lc-rs`). Все гранты, методы аутентификации по секрету и публичные клиенты работают без них.
:::

## Discovery

[`DiscoveryClient`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.DiscoveryClient.html) разрешает well-known discovery-URL, загружает документы по HTTPS и проверяет каждый на соответствие идентификатору, для которого он был запрошен (RFC 8414 §3.3 / RFC 9728 §3.3):

```rust compile
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

    // 1. строим запрос авторизации (state и PKCE генерируются)
    let auth = client
        .authorization_request(&metadata)
        .with_scopes(["read"])
        .with_resource("https://api.example.com")
        .build()?;

    // 2. отправляем пользователя на `auth.url`. Провайдер редиректит обратно
    //    на ваш callback с настоящими query-параметрами `code` и `state` —
    //    их и читаем там. (В этом примере переиспользуется сгенерированный
    //    `auth.state`, чтобы проверка ниже проходила на «счастливом пути».)
    let (code, state) = ("the-authorization-code", auth.state.as_str());

    // всегда проверяйте state из callback до обмена — защита от CSRF
    if !auth.matches_state(state) {
        return Ok(()); // отклоняем — возможен CSRF
    }

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

### Валидация callback

Начиная с **v0.9.6**, метод [`validate_callback`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.AuthorizationRequest.html#method.validate_callback) проверяет callback целиком — и `state`, и параметр `iss` из RFC 9207 — и рекомендуется вместо голого `matches_state`:

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

`iss` — это параметр запроса `iss` из callback или `None`, если ответ его не содержал. Он обязан совпадать с издателем, когда присутствует, и становится **обязательным**, как только сервер объявляет `authorization_response_iss_parameter_supported`.

::: warning
Без проверки `iss` callback можно воспроизвести от *другого* сервера авторизации — это и есть атака подмены (mix-up), ради которой существует RFC 9207. Если провайдер объявляет этот параметр, используйте [`validate_callback`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.AuthorizationRequest.html#method.validate_callback); [`matches_state`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.AuthorizationRequest.html#method.matches_state) остаётся для проверки только `state`.
:::

### Прозрачное обновление

[`token(key, &metadata)`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.OAuthClient.html#method.token) читает сохранённые токены и незаметно обновляет устаревший access-токен. Он возвращает `Ok(None)`, когда требуется интерактивная авторизация — ничего не сохранено, у записи нет refresh-токена или сервер отклонил refresh-токен (`invalid_grant`); в последних случаях «мёртвая» запись удаляется из хранилища. Можно также обновить явно через [`refresh`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.OAuthClient.html#method.refresh).

## Аутентификация клиента

Без учётных данных клиент работает как **публичный** (защитой служит PKCE, как и предписывает OAuth 2.1). Конфиденциальный клиент аутентифицируется на token-эндпоинте одним из трёх способов, и выбранный способ применяется ко всем грантам, которые он отправляет.

### Общий секрет

```rust compile-fragment
use volga_oauth_client::{ClientAuthMethod, OAuthClient};

let client = OAuthClient::new("my-client")
    .with_secret("s3cret")
    // `client_secret_basic` (по-умолчанию) или `client_secret_post`
    .with_auth_method(ClientAuthMethod::Post);
```

### `private_key_jwt`

Начиная с **v0.9.8** (флаг `private-key-jwt`), клиент может аутентифицироваться утверждением, подписанным его собственным ключом (RFC 7523 §2.2) — при этом общий секрет никогда не покидает клиент:

```rust compile
use volga_oauth_client::{ClientError, JwsAlgorithm, OAuthClient, PrivateKeyJwt};

fn build() -> Result<OAuthClient, ClientError> {
    let key = PrivateKeyJwt::from_pem_file("/etc/secrets/client.pem", JwsAlgorithm::RS256)?
        .with_key_id("2026-08");

    Ok(OAuthClient::new("my-client").with_private_key_jwt(key))
}
```

[`PrivateKeyJwt`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.PrivateKeyJwt.html) загружает ключ ([`from_pem`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.PrivateKeyJwt.html#method.from_pem), [`from_pem_file`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.PrivateKeyJwt.html#method.from_pem_file), [`from_der`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.PrivateKeyJwt.html#method.from_der)) и несёт политику claims — [`with_key_id`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.PrivateKeyJwt.html#method.with_key_id), [`with_lifetime`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.PrivateKeyJwt.html#method.with_lifetime) (по-умолчанию 60 секунд) и [`with_audiences`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.PrivateKeyJwt.html#method.with_audiences). На каждый запрос токена выпускается новое утверждение со случайным `jti`, поэтому перехваченное живёт недолго. Подключение ключа отменяет любой [`with_secret`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.OAuthClient.html#method.with_secret) — учётными данными становится утверждение.

::: warning
Симметричные алгоритмы отклоняются: HMAC-секрет, который сервер и так знает, ничего не доказывает о том, кто подписал. Алгоритм также проверяется по `token_endpoint_auth_signing_alg_values_supported`, если сервер его объявляет.
:::

### Публикация открытого ключа

Сервер авторизации проверяет утверждения открытой половиной ключа, которую он либо забирает по `jwks_uri`, либо получил при регистрации. [`with_public_jwk`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.PrivateKeyJwt.html#method.with_public_jwk) прикрепляет её, а [`jwks()`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.PrivateKeyJwt.html#method.jwks) формирует документ для публикации:

```rust compile
use volga_oauth_client::{ClientError, JwsAlgorithm, PrivateKeyJwt, PublicJwk};

fn publish(key: PrivateKeyJwt, public: PublicJwk) -> Result<(), ClientError> {
    let key = key.with_public_jwk(public)?;

    // отдавайте это по вашему `jwks_uri` либо отправьте как поле `jwks`
    // в запросе динамической регистрации клиента
    let document = key.jwks();
    Ok(())
}
```

[`PublicJwk`](https://docs.rs/volga-oauth-core/latest/volga_oauth_core/jwk/struct.PublicJwk.html) (RFC 7517, из `volga-oauth-core`) моделирует исключительно **открытый** материал подписи — приватные поля в нём выразить нельзя, а десериализация документа, который их несёт, завершается ошибкой, а не молчаливым отбрасыванием. Он также отклоняет сочетания, с которыми не сможет работать ни один проверяющий: RSA-ключ, объявляющий `ES256`, ключ P-384 с `ES256`, открытый ключ с HMAC-алгоритмом или кривую, не принадлежащую типу ключа. Поля `kid` и `alg` заполняются из конфигурации подписи, поэтому опубликованный документ всегда согласован с тем, что реально несут утверждения.

::: info
Открытый ключ передаётся явно — крейт подписывает, но не выводит открытые ключи из закрытых. Именно это делает невозможной случайную публикацию ключа подписи.
:::

### Что проверяется до отправки запроса

Начиная с **v0.9.8**, настроенный способ аутентификации проверяется по `token_endpoint_auth_methods_supported` до отправки запроса токена: способ, который сервер не объявлял, принёс бы по сети лишь `invalid_client`. Метаданные, не перечисляющие ни одного способа, под сомнение не ставятся — именно так выглядит [`AuthorizationServerMetadata`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.AuthorizationServerMetadata.html), собранный вручную — но *обнаруженный* через discovery документ всегда что-то перечисляет, поскольку по RFC 8414 отсутствие поля означает `client_secret_basic`. Публичный клиент не предъявляет учётных данных и не проверяется.

::: info
Зарегистрированные идентификаторы протокола, о которых договариваются обе стороны, с **v0.9.8** живут в одном месте — `volga_oauth_core::protocol`, в виде констант `grant`, `client_auth`, `token_type` и `auth_scheme`, реэкспортируемых и из `volga::auth::oauth`, и из `volga_oauth_client`. Сервер объявляет их в своих метаданных, а клиент по ним сопоставляет — так они не могут разойтись.
:::

## Хранилище токенов

Сохранение выполняется через трейт [`TokenStore`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/trait.TokenStore.html). [`InMemoryTokenStore`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.InMemoryTokenStore.html) — встроенная реализация в памяти процесса, подходящая для CLI, тестов и одноинстансовых сервисов; всё долговременное (БД, зашифрованный файл, связка ключей ОС) реализуется одной реализацией трейта.

```rust compile
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

    // готовый к использованию клиент с выданными учётными данными
    let client = OAuthClient::from_registration(&registered)?;
    Ok(())
}
```

Для серверов, не разрешающих открытую регистрацию, добавьте начальный токен доступа через [`with_initial_access_token`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.RegistrationClient.html#method.with_initial_access_token).

Два поля [`ClientMetadata`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.ClientMetadata.html) стали полноценными в **v0.9.6** и **v0.9.8** соответственно:

* [`with_application_type`](https://docs.rs/volga-oauth-core/latest/volga_oauth_core/struct.ClientMetadata.html#method.with_application_type) — `"web"` или `"native"`. Десктопные и CLI-клиенты регистрируются как `"native"` — именно это делает loopback-адреса перенаправления (`http://127.0.0.1:{port}/...`) приемлемыми для серверов авторизации.
* [`with_token_endpoint_auth_signing_alg`](https://docs.rs/volga-oauth-core/latest/volga_oauth_core/struct.ClientMetadata.html#method.with_token_endpoint_auth_signing_alg) — алгоритм, которым именно этот клиент подписывает свои утверждения, для регистрации с `private_key_jwt`.

Если регистрация использует `private_key_jwt`, принимайте её через [`from_registration_with_key`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.OAuthClient.html#method.from_registration_with_key) — он также отклонит ключ, который регистрация не приняла бы: подписывающий алгоритмом, отличным от зарегистрированного `token_endpoint_auth_signing_alg`, или с `kid`, который не разрешается встроенным `jwks`:

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
Начиная с **v0.9.8**, клиент, созданный через [`from_registration`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.OAuthClient.html#method.from_registration), отклоняет грант, который не был одобрен его регистрацией — до обращения к сети, а не в виде `unauthorized_client` от token-эндпоинта. Отсутствующий `grant_types` означает только `authorization_code` (RFC 7591 §2), а не полную свободу; неограничен лишь клиент, который вообще не проходил регистрацию. `refresh_token` не отклоняется никогда, поскольку по RFC 6749 §6 это продолжение уже полученного гранта.
:::

::: info
Протокол управления RFC 7592 (чтение, обновление и удаление регистрации) не реализован, но пара `registration_access_token` / `registration_client_uri` из ответа доступна для приложений, которым она нужна.
:::

## Транспортная политика и ошибки

[`ClientConfig`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.ClientConfig.html) несёт политику, общую для всех операций клиента — принудительный HTTPS, таймауты на запрос и лимиты редиректов. Значения по-умолчанию безопасны для продакшена; чаще всего переопределяют отключение HTTPS для локального сервера разработки:

```rust compile-fragment
use std::time::Duration;
use volga_oauth_client::{ClientConfig, OAuthClient};

let config = ClientConfig::new()
    .require_https(false)              // только для локальной разработки
    .with_timeout(Duration::from_secs(5))
    .with_max_redirects(0);

let client = OAuthClient::new("my-client").with_config(config);
```

[`ClientError`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/enum.ClientError.html) отделяет разобранный ответ об ошибке OAuth (`Protocol`, несущий [`OAuthError`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.OAuthError.html) из RFC 6749 §5.2) от ошибок транспорта, декодирования, небезопасного URL и валидации — так вы можете отличить «сервер ответил `invalid_grant`» от «соединение оборвалось». С **v0.9.8** к ним добавился `Signing` — конфигурация подписи не может создать JWS, нужный запросу: утверждение `private_key_jwt` или доказательство DPoP.

### Проброс ошибок из обработчика

Начиная с **v0.9.8**, при включённом на `volga` флаге `oauth-client`, [`ClientError`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/enum.ClientError.html) преобразуется в [`volga::Error`](https://docs.rs/volga/latest/volga/error/struct.Error.html), поэтому обработчик, общающийся с сервером авторизации, может пробрасывать ошибку через `?`:

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

Статус описывает, **где** произошёл сбой, а не повторяет ответ сервера авторизации — ведь в этом вызове *клиентом* было ваше приложение:

| Сбой | Статус |
|---|---|
| до сервера не удалось достучаться (`Transport`) | `503 Service Unavailable` |
| сервер ответил непригодно — ошибка протокола, неожиданный статус, неразбираемое тело | `502 Bad Gateway` |
| собственная конфигурация приложения — небезопасный URL, метаданные, не прошедшие валидацию, ключ, которым нельзя подписать | `500 Internal Server Error` |

Чтобы показать вызывающей стороне код ошибки самого сервера авторизации, сопоставляйте `ClientError::Protocol` вместо того, чтобы полагаться на это преобразование.

## Что дальше
* [Гранты «сервис-сервис»](/volga-docs/ru/security-access/machine-to-machine.html) — `client_credentials`, JWT bearer и обмен токенов, для сценариев без участия пользователя.
* [DPoP](/volga-docs/ru/security-access/dpop.html) — привязка токенов к ключу клиента, чтобы украденный токен ничего не стоил.

## Примеры
* [OAuth Flow](https://github.com/RomanEmreis/volga/blob/main/examples/oauth_flow/src/main.rs) — полный флоу discovery → авторизация → обмен кода → вызов защищённого маршрута, реализованный через `volga-oauth-client`.
