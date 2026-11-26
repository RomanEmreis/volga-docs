# Свои экстракторы

Обработчики в Волге получают данные через экстракторы: `Json<T>`, `Query<T>`, `Header<T>`, `Dc<T>` и другие. Экстрактором может быть и значение, которое приложение получает из каждого запроса: вошедший пользователь, тенант, локаль клиента. Реализуйте для него [`FromRequestHead`](https://docs.rs/volga/latest/volga/http/endpoints/args/trait.FromRequestHead.html), и обработчики и middleware будут принимать его так же, как встроенный.

## Свой тип

У `FromRequestHead` один метод — `from_head`. Он получает заголовочную часть запроса (метод, URI и заголовки, без тела) и возвращает значение или ошибку:

```rust compile
use volga::{App, HttpResult, Json, error::Error, ok};
use volga::http::{FromRequestHead, RequestHead, StatusCode};

struct CurrentUser(String);

impl FromRequestHead for CurrentUser {
    fn from_head(head: &RequestHead<'_>) -> Result<Self, Error> {
        head.headers()
            .get("x-user-id")
            .and_then(|id| id.to_str().ok())
            .map(|id| CurrentUser(id.to_owned()))
            .ok_or_else(|| (StatusCode::UNAUTHORIZED, "who are you?").into())
    }
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // POST /notes с `x-user-id: alice` -> 200 alice wrote "buy milk"
    // POST /notes без заголовка        -> 401 who are you?
    app.map_post("/notes", |me: CurrentUser, note: Json<String>| -> HttpResult {
        ok!("{} wrote {:?}", me.0, note.0)
    });

    app.run().await
}
```

`Err` останавливает запрос до обработчика и уходит в [обработчик ошибок](/volga-docs/ru/reliability-observability/errors.html) со своим статусом — так же, как `Err` из обработчика. Тело экстрактор не трогает, поэтому он может стоять рядом с экстрактором тела, например `Json<T>`.

## Где его можно принимать

Одна и та же реализация работает везде, куда подходит встроенный экстрактор заголовочной части:

* как аргумент обработчика;
* в middleware: [`with()`](/volga-docs/ru/middleware-infrastructure/middlewares.html), [`filter()`](/volga-docs/ru/middleware-infrastructure/middleware.html#фильтры), [`tap_req()`](/volga-docs/ru/middleware-infrastructure/middleware.html#обработка-входящего-запроса), `map_ok()`, [`map_err()`](/volga-docs/ru/reliability-observability/errors.html) и [`map_fallback()`](/volga-docs/ru/reliability-observability/errors.html#fallback-обработчик);
* как `Option<T>`, который даёт `None`, если экстрактор не сработал, и как `Result<T, Error>`, который передаёт ошибку обработчику;
* через [`HttpRequest::extract()`](https://docs.rs/volga/latest/volga/http/request/struct.HttpRequest.html#method.extract) в обработчике, который принимает весь запрос.

```rust compile
use volga::{App, error::Error, ok};
use volga::http::{FromRequestHead, RequestHead, StatusCode};

struct Tenant(String);

impl FromRequestHead for Tenant {
    fn from_head(head: &RequestHead<'_>) -> Result<Self, Error> {
        head.headers()
            .get("x-tenant")
            .and_then(|tenant| tenant.to_str().ok())
            .map(|tenant| Tenant(tenant.to_owned()))
            .ok_or_else(|| (StatusCode::BAD_REQUEST, "x-tenant is missing").into())
    }
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.group("/api", |api| {
        // Middleware принимает его так же, как обработчик
        api.filter(|tenant: Tenant| tenant.0 != "suspended");

        api.map_get("/orders", |tenant: Tenant| ok!("orders of {}", tenant.0));
    });

    // Необязательный: `None` вместо 400
    app.map_get("/", |tenant: Option<Tenant>| match tenant {
        Some(tenant) => ok!("hello, {}", tenant.0),
        None => ok!("hello"),
    });

    app.run().await
}
```

## Чтение других экстракторов

[`RequestHead::extract()`](https://docs.rs/volga/latest/volga/http/endpoints/args/struct.RequestHead.html#method.extract) читает любой встроенный экстрактор заголовочной части или другой ваш экстрактор, так что можно опираться на то, что Волга уже разбирает: `Query<T>`, `Path<T>`, `Header<T>`, `Cookies`, `ClientIp`, `Dc<T>`. Здесь локаль берётся из `?lang=`, если он есть в запросе, а иначе из `Accept-Language`:

```rust compile
use serde::Deserialize;
use volga::{App, Query, error::Error, ok};
use volga::http::{FromRequestHead, RequestHead};

#[derive(Deserialize)]
struct LangQuery {
    lang: String,
}

struct Locale(String);

impl FromRequestHead for Locale {
    fn from_head(head: &RequestHead<'_>) -> Result<Self, Error> {
        let from_query = head
            .extract::<Option<Query<LangQuery>>>()?
            .map(|query| query.lang.clone());

        let from_header = head
            .headers()
            .get("accept-language")
            .and_then(|value| value.to_str().ok())
            .and_then(|value| value.split([',', ';', '-']).next())
            .map(str::to_owned);

        Ok(Locale(from_query.or(from_header).unwrap_or_else(|| "en".into())))
    }
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // GET /greeting?lang=fr                -> Bonjour
    // GET /greeting, Accept-Language: de   -> Hallo
    app.map_get("/greeting", |locale: Locale| match locale.0.as_str() {
        "fr" => ok!("Bonjour"),
        "de" => ok!("Hallo"),
        _ => ok!("Hello"),
    });

    app.run().await
}
```

Свой экстрактор может читать и параметры пути — через `Path<T>` или `NamedPath<T>`, даже если обработчик рядом с ним принимает экстрактор пути.

## Сервисы из контейнера

С фичей `di` экстрактор может получить сервис через `Dc<T>`. Объявите его в `dependencies()`: тогда [`App::run()`](/volga-docs/ru/advanced-patterns/di.html#что-принимают-обработчики-и-middleware) при старте проверит, что сервис зарегистрирован, — как для `Dc<T>`, который принимает обработчик. Без объявления отсутствующий сервис ронял бы каждый запрос, дошедший до экстрактора.

```rust compile
use std::collections::HashMap;
use volga::{App, di::{Dc, Dependencies}, error::Error, ok};
use volga::http::{FromRequestHead, RequestHead, StatusCode};

// API-ключ -> имя клиента
struct ApiKeys(HashMap<String, String>);

struct Client(String);

impl FromRequestHead for Client {
    fn from_head(head: &RequestHead<'_>) -> Result<Self, Error> {
        let keys: Dc<ApiKeys> = head.extract()?;
        head.headers()
            .get("x-api-key")
            .and_then(|key| key.to_str().ok())
            .and_then(|key| keys.0.get(key))
            .map(|name| Client(name.clone()))
            .ok_or_else(|| (StatusCode::UNAUTHORIZED, "unknown API key").into())
    }

    fn dependencies(deps: &mut Dependencies) {
        deps.add::<ApiKeys>();
    }
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.add_singleton(ApiKeys(HashMap::from([("k-123".into(), "billing".into())])));

    // GET /whoami с `x-api-key: k-123` -> billing
    app.map_get("/whoami", |client: Client| ok!("{}", client.0));

    app.run().await
}
```

## Асинхронная работа

`from_head` синхронный: чтение заголовочной части ничего не ждёт и само ничего не выделяет. Если значение требует запроса к базе данных или кешу, ожиданием занимается middleware. Результат оно передаёт через [scoped-сервис](/volga-docs/ru/advanced-patterns/di.html), у которого на каждый запрос свой экземпляр, а экстрактор читает его оттуда:

```rust compile
use std::sync::OnceLock;
use volga::{App, di::{Dc, Dependencies}, error::Error, headers::HttpHeaders, middleware::Next, ok};
use volga::http::{FromRequestHead, RequestHead, StatusCode};

#[derive(Clone)]
struct Session {
    user: String,
}

// Один на запрос: middleware заполняет, экстрактор читает
#[derive(Default)]
struct SessionSlot(OnceLock<Session>);

async fn load_session(token: &str) -> Option<Session> {
    // например, запрос к базе данных или кешу
    (token == "s-1").then(|| Session { user: "alice".into() })
}

impl FromRequestHead for Session {
    fn from_head(head: &RequestHead<'_>) -> Result<Self, Error> {
        let slot: Dc<SessionSlot> = head.extract()?;
        slot.0
            .get()
            .cloned()
            .ok_or_else(|| (StatusCode::UNAUTHORIZED, "no session").into())
    }

    fn dependencies(deps: &mut Dependencies) {
        deps.add::<SessionSlot>();
    }
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.add_scoped_default::<SessionSlot>();

    app.with(|headers: HttpHeaders, slot: Dc<SessionSlot>, next: Next| async move {
        if let Some(token) = headers.get_raw("x-session").and_then(|v| v.to_str().ok()) {
            if let Some(session) = load_session(token).await {
                let _ = slot.0.set(session);
            }
        }
        next.await
    });

    // GET /me с `x-session: s-1` -> hello, alice
    app.map_get("/me", |session: Session| ok!("hello, {}", session.user));

    app.run().await
}
```

## Что реализовать

| Чтобы получить | Реализуйте |
|---|---|
| свой аргумент: текущего пользователя, тенант, локаль | `FromRequestHead` |
| значение из одного параметра пути, принимаемое как `Path<T>` | [`FromPathArg`](/volga-docs/ru/getting-started/route-params.html#параметры-собственных-типов) |
| значение из нескольких параметров пути | [`FromPathArgs`](/volga-docs/ru/getting-started/route-params.html#чтение-всех-параметров-сразу) |
| типизированный заголовок, принимаемый как `Header<T>` | [`FromHeaders` или `#[http_header]`](/volga-docs/ru/requests-responses/headers.html) |
| правила, которым должно отвечать значение | [`Validate`](/volga-docs/ru/requests-responses/validation.html) |

`FromRequest` и `FromRequestRef` встречаются в сигнатурах `map_get`, `with` и других методов. Это ограничения, а не точки расширения: они запечатаны, так что `impl` одного из них не скомпилируется. Публичными они остаются для того, чтобы их мог назвать обобщённый помощник над обработчиком.

Формат тела, которого Волга не знает, читается в обработчике — из [`HttpBody`](/volga-docs/ru/requests-responses/body.html) или `ByteStream`, с уже применённым ограничением размера тела.
