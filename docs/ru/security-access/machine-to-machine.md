# Гранты «сервис-сервис»

[Флоу Authorization Code](/volga-docs/ru/security-access/oauth-client.html#authorization-code-pkce) существует, чтобы получить токен *от имени пользователя*. Но в изрядной части трафика пользователя нет вовсе: фоновый воркер, вызывающий внутренний API, планировщик задач, сервис, которому нужен токен для самого себя. Начиная с **v0.9.8**, `volga-oauth-client` реализует три гранта для таких случаев — где субъектом является сам клиент.

Все три оформлены как построители на [`OAuthClient`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.OAuthClient.html), принимают одни и те же опции [`with_scopes`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.ClientCredentialsRequest.html#method.with_scopes) / [`with_resource`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.ClientCredentialsRequest.html#method.with_resource) (RFC 8707) / [`with_param`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.ClientCredentialsRequest.html#method.with_param) и отправляются через `send()`:

| Метод | Грант | Когда применять |
|---|---|---|
| [`client_credentials`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.OAuthClient.html#method.client_credentials) | RFC 6749 §4.4 | сервис действует от своего имени, со своими учётными данными |
| [`jwt_bearer`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.OAuthClient.html#method.jwt_bearer) | RFC 7523 §2.1 | другой авторитет уже выдал JWT, который за него ручается |
| [`exchange_token`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.OAuthClient.html#method.exchange_token) | RFC 8693 | один токен нужно обменять на другой |

::: tip
Этим грантам нужна [аутентификация клиента](/volga-docs/ru/security-access/oauth-client.html#аутентификация-клиента) — секрет или ключ `private_key_jwt`. Публичному клиенту предъявить нечего, и любой вменяемый сервер ему откажет.
:::

## Client Credentials

Базовый грант «сервис-сервис». Запроса авторизации, который нёс бы скоупы, здесь нет, поэтому скоупы указываются в самом запросе токена — либо опускаются, и тогда сервер применяет грант по-умолчанию для этого клиента:

```rust compile
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

### Хранение сервисного токена

По RFC 6749 §4.4.3 этот грант **не выдаёт refresh-токен**, поэтому [`OAuthClient::token`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.OAuthClient.html#method.token) нечем обновлять сохранённый токен — обновлением служит повторный запуск самого гранта. Именно это делает [`ClientCredentialsRequest::token`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.ClientCredentialsRequest.html#method.token): отдаёт сохранённый токен, пока он свежий, и заново выполняет грант — с теми же скоупами и индикаторами ресурсов — когда это уже не так.

```rust compile
use std::sync::Arc;
use volga_oauth_client::{
    AuthorizationServerMetadata, ClientError, InMemoryTokenStore, OAuthClient,
};

async fn run(metadata: &AuthorizationServerMetadata) -> Result<(), ClientError> {
    let client = OAuthClient::new("my-service")
        .with_secret("s3cret")
        .with_token_store(Arc::new(InMemoryTokenStore::new()));

    // первый вызов делает запрос, остальные обслуживаются из хранилища,
    // пока токен не приблизится к истечению
    let tokens = client
        .client_credentials(metadata)
        .with_scopes(["inventory:read"])
        .token("inventory")
        .await?;

    Ok(())
}
```

::: warning
Сохранённый токен, время жизни которого сервер не сообщил, запрашивается заново, а не отдаётся: `expires_in` по RFC 6749 §5.1 лишь РЕКОМЕНДУЕТСЯ, а неизвестное время жизни не является доказательством свежести. Против сервера, который его не присылает, грант будет выполняться на каждый вызов — это один запрос, а тот, кто всё же хочет кешировать, может держать [`TokenSet`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.TokenSet.html) из [`send()`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.ClientCredentialsRequest.html#method.send) по своей политике.

Метод **паникует**, если [`TokenStore`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/trait.TokenStore.html) не подключён.
:::

## JWT Bearer

Предъявляет JWT в качестве гранта авторизации. Утверждение передаётся вызывающей стороной, а не выпускается здесь: это то, что уже выдал другой авторитет — токен workload-идентичности платформы, на которой работает клиент, или утверждение личности, полученное предыдущим обменом.

```rust compile
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
Отказ здесь окончателен: утверждение либо принимается, либо нет. Не повторяйте запрос и не переключайтесь на другой тип гранта — чините само утверждение. `invalid_grant` означает, что отклонено именно оно.
:::

::: info
`jwt_bearer` и `private_key_jwt` оба отправляют подписанный JWT, и их легко перепутать. Они отвечают на разные вопросы: **грант** JWT bearer — это *почему* токен должен быть выдан, а клиентское утверждение `private_key_jwt` — *кто просит*. Один запрос может нести оба.
:::

## Обмен токенов

Меняет один токен на другой (RFC 8693) — грант делегирования и олицетворения. `subject_token` представляет сторону, для которой запрашивается новый токен, а `subject_token_type` определяет, что это такое: одна из констант [`token_type`](https://docs.rs/volga-oauth-core/latest/volga_oauth_core/protocol/token_type/index.html) или любой URI, понятный серверу.

```rust compile
use volga_oauth_client::{
    AuthorizationServerMetadata, ClientError, OAuthClient, token_type,
};

async fn run(
    idp: &AuthorizationServerMetadata,
    resource_server: &AuthorizationServerMetadata,
    id_token: &str,
) -> Result<(), ClientError> {
    let client = OAuthClient::new("my-app").with_secret("s3cret");

    // меняем ID-токен пользователя на утверждение, которое примет
    // сервер авторизации нужного ресурса...
    let exchanged = client
        .exchange_token(idp, id_token, token_type::ID_TOKEN)
        .with_requested_token_type(token_type::ID_JAG)
        .with_audience("https://api.example.com")
        .send()
        .await?;

    // ...и предъявляем его там как грант JWT bearer
    let tokens = client
        .jwt_bearer(resource_server, &exchanged.token)
        .send()
        .await?;

    Ok(())
}
```

В отличие от двух других грантов, обмен может вернуть **не** bearer-токен доступа, поэтому он отвечает типом [`ExchangedToken`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.ExchangedToken.html), а не [`TokenSet`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.TokenSet.html):

* `issued_token_type` — что именно решил выдать сервер;
* [`is_bearer()`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.ExchangedToken.html#method.is_bearer) — годится ли он как учётные данные `Authorization: Bearer`;
* [`is_expired()`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.ExchangedToken.html#method.is_expired) / [`expires_within()`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.ExchangedToken.html#method.expires_within) — та же работа с абсолютным сроком истечения, что и у `TokenSet`.

Помимо общих опций, запрос принимает [`with_requested_token_type`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.TokenExchangeRequest.html#method.with_requested_token_type), [`with_audience`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.TokenExchangeRequest.html#method.with_audience) и [`with_actor_token`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.TokenExchangeRequest.html#method.with_actor_token) (делегирование, где действующая сторона указывается рядом с субъектом).

## Что отклоняется до обращения к сети

Все три гранта скорее откажут в запросе, чем отправят заведомо безнадёжный. Грант должны разрешать **обе** стороны:

* сервер обязан перечислить его в `grant_types_supported`;
* клиент, созданный через [`from_registration`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.OAuthClient.html#method.from_registration), должен иметь его в одобренных регистрацией `grant_types`.

Проверка регистрации распространяется и на флоу Authorization Code: `authorization_request().build()` и `exchange_code` откажут, вместо того чтобы отправить пользователя во флоу, который клиент, возможно, не сможет завершить. Отсутствующий `grant_types` означает только `authorization_code` (RFC 7591 §2); неограничен лишь клиент, который вообще не проходил регистрацию, а `refresh_token` не отклоняется никогда.

Оба отказа возвращаются как `ClientError::Validation` — это более внятный сигнал, чем `unauthorized_client`, которым ответил бы token-эндпоинт.
