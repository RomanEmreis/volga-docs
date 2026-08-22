# DPoP — токены, привязанные к отправителю

Bearer-токен — это пароль: им может воспользоваться любой, кто его держит. DPoP (RFC 9449) привязывает токен к ключу, которым владеет клиент, и каждый запрос несёт свежеподписанное доказательство владения — поэтому токен, утёкший из лога, прокси или скомпрометированного хранилища, без ключа ничего не стоит.

Доступно с **v0.9.8** под флагом `dpop` крейта `volga-oauth-client`:

```toml
[dependencies]
volga-oauth-client = { version = "...", features = ["dpop"] }
```

::: info
Флаг выключен по-умолчанию, потому что подпись — единственная часть крейта, которой нужен бэкенд JWS. Он независим от `private-key-jwt`: учётные данные клиента говорят, **кто попросил** токен, а доказательство DPoP — **кто им владеет**, и один запрос может нести оба.
:::

## Ключ

[`Dpop`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.Dpop.html) — это ключ плюс состояние nonce тех серверов, с которыми он общается. [`generate()`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.Dpop.html#method.generate) создаёт одноразовый ключ `ES256` — алгоритм, который поддерживает любая реализация DPoP:

```rust compile
use volga_oauth_client::{ClientError, Dpop, OAuthClient};

fn build() -> Result<(), ClientError> {
    let dpop = Dpop::generate()?;

    let client = OAuthClient::new("my-client")
        .with_secret("s3cret")
        .with_dpop(dpop.clone());

    // тот же ключ защищает запросы к ресурсу, выполняемые с его токенами
    let jkt = dpop.thumbprint();
    Ok(())
}
```

Обычное время жизни — **один ключ на сессию**, а не на процесс: его потеря не стоит ничего, кроме привязанных к нему токенов, которые без него всё равно бесполезны. [`generate_with`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.Dpop.html#method.generate_with) умеет также `ES384` и `EdDSA`; RSA-ключи генерируются слишком медленно для «одного на сессию», поэтому их можно только загрузить.

Для ключа, живущего дольше процесса — например, такого, чей отпечаток уже сообщён ресурсу — используйте [`from_pem`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.Dpop.html#method.from_pem) или [`from_pem_file`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.Dpop.html#method.from_pem_file): открытая половина передаётся явно, и при создании обе половины сверяются одной подписью — так несогласованная пара отклоняется сразу, а не приводит к удалённому отказу на каждом подписанном ею запросе.

Клонирование [`Dpop`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.Dpop.html) разделяет и ключ, **и** nonce, поэтому клиент и код, выполняющий запросы к ресурсу с его токенами, остаются согласованными.

## Получение привязанных токенов

[`with_dpop`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.OAuthClient.html#method.with_dpop) добавляет доказательство к каждому запросу токена, каким бы грантом он ни отправлялся — Authorization Code, [client credentials, JWT bearer или обмен токенов](/volga-docs/ru/security-access/machine-to-machine.html). Остальное берёт на себя крейт:

* алгоритм проверяется по `dpop_signing_alg_values_supported` до отправки запроса;
* запрос авторизации называет ключ в `dpop_jkt` (RFC 9449 §10), привязывая к нему код, так что украденный код никто другой не обменяет;
* отказ `use_dpop_nonce` (§8.2) отрабатывается ровно одним повтором запроса с тем nonce, которого этот отказ потребовал;
* токены возвращаются с `token_type: DPoP`.

```rust compile
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
Токен, вернувшийся **не** как `DPoP`, отклоняется, а не отдаётся вызывающей стороне и хранилищу как непривязанные учётные данные: сервер без поддержки DPoP просто игнорирует доказательство, и молчаливое согласие на bearer-токен свело бы на нет ту самую привязку, ради которой ключ и заводился.
:::

[`TokenSet::is_dpop`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.TokenSet.html#method.is_dpop) и [`TokenSet::dpop_jkt`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.TokenSet.html#structfield.dpop_jkt) сообщают привязку, записанную клиентом, который получил токен. [`TokenStore`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/trait.TokenStore.html) живёт дольше процесса, а сгенерированный ключ — нет, поэтому сохранённая запись сверяется с имеющимся ключом перед выдачей: запись, привязанная к ключу, владение которым клиент доказать не может, бесполезна, каким бы неистёкшим ни выглядел токен. Это не ошибка, а устаревший кеш — запись удаляется, и вместо неё запрашивается подходящий токен.

## Защита запросов к ресурсу

Запросы к ресурсу остаются за вами: крейт выпускает доказательства и владеет состоянием nonce, но не становится HTTP-клиентом вместо вас. [`authorize`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.Dpop.html#method.authorize) заполняет оба заголовка — учётные данные `Authorization: DPoP <token>` и доказательство `DPoP`, покрывающее их:

```rust compile
use http::{HeaderMap, Method};
use volga_oauth_client::{ClientError, Dpop, TokenSet};

fn protect(dpop: &Dpop, url: &str, tokens: &TokenSet) -> Result<(), ClientError> {
    let mut headers = HeaderMap::new();
    let sent = dpop.authorize(&mut headers, &Method::GET, url, tokens)?;

    // ...отправляем запрос с этими заголовками
    Ok(())
}
```

Доказательство несёт `typ: dpop+jwt`, открытый ключ **по значению** в заголовке `jwk` (никогда по `kid`, в отличие от клиентского утверждения), claims `htm` / `htu` / `iat` / `jti`, а также `ath` — хеш токена доступа — на каждом запросе, который этот токен предъявляет. Из `htu` отбрасываются строка запроса и фрагмент.

::: warning
[`authorize`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.Dpop.html#method.authorize) отклоняет токен, который этот ключ предъявить не может — bearer-токен или токен, чья записанная привязка называет другой ключ — *до* запроса, вместо того чтобы ресурс отклонял каждый такой запрос.
:::

Когда `authorize` не подходит по форме, есть два более низкоуровневых инструмента:

* [`proof`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.Dpop.html#method.proof) собирает доказательство вручную — [`with_access_token`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.DpopProof.html#method.with_access_token), [`with_nonce`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.DpopProof.html#method.with_nonce), затем [`sign`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.DpopProof.html#method.sign);
* [`thumbprint`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.Dpop.html#method.thumbprint) — это `jkt` (RFC 7638), к которому сервер авторизации привязывает токен; его и передают ресурсу, если ключи фиксируются вне протокола.

## Nonce

Сервер может потребовать, чтобы доказательства несли выбранный им nonce. Раунд с token-эндпоинтом обрабатывается внутри, а раунд с ресурсом — за вами, ведь эти запросы отправляете вы:

```rust compile
use http::{HeaderMap, Method};
use volga_oauth_client::{ClientError, Dpop, TokenSet};

fn with_retry(dpop: &Dpop, url: &str, tokens: &TokenSet) -> Result<(), ClientError> {
    let mut headers = HeaderMap::new();
    let sent = dpop.authorize(&mut headers, &Method::GET, url, tokens)?;

    // ...отправляем запрос; затем, получив отказ `use_dpop_nonce`:
    let response_headers = HeaderMap::new();
    if let Some(demanded) = dpop.accept_nonce(url, &response_headers)
        && Some(demanded.as_str()) != sent.as_deref()
    {
        dpop.authorize_with_nonce(&mut headers, &Method::GET, url, tokens, &demanded)?;
        // ...и отправляем ещё раз
    }

    Ok(())
}
```

* [`authorize`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.Dpop.html#method.authorize) возвращает nonce, который реально нёс только что подписанный им proof — разрешение и подпись здесь один шаг, чего не гарантировал бы отдельный запрос значения, пока к тому же origin летят другие запросы.
* [`accept_nonce`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.Dpop.html#method.accept_nonce) принимает nonce любого ответа и возвращает его.
* [`authorize_with_nonce`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.Dpop.html#method.authorize_with_nonce) кладёт в повтор именно этот nonce, что бы за это время ни успело измениться в общем состоянии.

::: info
Nonce запоминаются по origin **и** по пространству имён: token-эндпоинт (§8) и защищённый ресурс (§9) выдают независимые последовательности даже когда их обслуживает один хост, поэтому один только origin ключом быть не может.
:::

## Чтение DPoP-челленджа

Защищённый по DPoP ресурс отвечает `401` с челленджем `WWW-Authenticate: DPoP ...`, у которого `error` и `error_description` — те же, что в RFC 6750. Начиная с **v0.9.8**, [`BearerChallenge::parse_scheme`](https://docs.rs/volga-oauth-core/latest/volga_oauth_core/struct.BearerChallenge.html#method.parse_scheme) читает челлендж для любой схемы:

```rust compile
use volga_oauth_client::{BearerChallenge, OAuthError, auth_scheme};

fn read(header: &str) -> Result<(), OAuthError> {
    let challenge = BearerChallenge::parse_scheme(header, auth_scheme::DPOP)?;
    Ok(())
}
```

[`with_scheme`](https://docs.rs/volga-oauth-core/latest/volga_oauth_core/struct.BearerChallenge.html#method.with_scheme) и [`scheme`](https://docs.rs/volga-oauth-core/latest/volga_oauth_core/struct.BearerChallenge.html#method.scheme) отображают и сообщают схему, поэтому разобранный челлендж рендерится обратно в той схеме, в которой пришёл. `parse` — это тот же метод с `auth_scheme::BEARER`.

Оба зарегистрированных кода ошибок DPoP тоже смоделированы: `OAuthErrorCode::UseDpopNonce` и `OAuthErrorCode::InvalidDpopProof` (RFC 9449 §7.1) — раньше они попадали в `Other`.

::: warning
При обновлении стоит проверить три изменения из **v0.9.8**:

* `OAuthErrorCode` помечен `#[non_exhaustive]`, поэтому ничего не перестанет компилироваться — но код, сопоставлявший два кода DPoP как `Other(..)`, больше их не поймает. Представление на проводе, `as_str` и serde-представление не изменились.
* У [`TokenSet`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/struct.TokenSet.html) появилось поле `dpop_jkt`, поэтому код, собирающий его структурным литералом, обязан его указать (`None` для bearer-токена). Для всего, что не несёт привязки, представление на проводе не изменилось, так что сохранённая ранней версией запись по-прежнему читается.
* [`ClientAuthMethod`](https://docs.rs/volga-oauth-client/latest/volga_oauth_client/enum.ClientAuthMethod.html) больше не `Copy` — новый вариант `PrivateKeyJwt` несёт ключ подписи. `Clone`, `Debug`, `PartialEq` и `Eq` сохранены.
:::
