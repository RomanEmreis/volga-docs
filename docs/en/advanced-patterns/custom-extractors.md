# Extractors of Your Own

Handlers in Volga take their inputs as extractors: `Json<T>`, `Query<T>`, `Header<T>`, `Dc<T>` and the rest. A value your application derives from every request (the signed-in user, the tenant, the client's locale) can be an extractor too. Implement [`FromRequestHead`](https://docs.rs/volga/latest/volga/http/endpoints/args/trait.FromRequestHead.html) for it, and handlers and middleware take it like any built-in one.

## A Type of Your Own

`FromRequestHead` has one method, `from_head`. It gets the head of the request (the method, URI and headers, without the body) and returns the value or an error:

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

    // POST /notes with `x-user-id: alice` -> 200 alice wrote "buy milk"
    // POST /notes without the header      -> 401 who are you?
    app.map_post("/notes", |me: CurrentUser, note: Json<String>| -> HttpResult {
        ok!("{} wrote {:?}", me.0, note.0)
    });

    app.run().await
}
```

An `Err` stops the request before the handler runs, and goes to the [error handler](/volga-docs/en/reliability-observability/errors.html) with its status, as a handler's `Err` would. The extractor leaves the body alone, so it can stand next to a body extractor such as `Json<T>`.

## Where It Can Be Taken

The same impl serves everywhere a built-in extractor of the head goes:

* as a handler argument;
* in middleware: [`with()`](/volga-docs/en/middleware-infrastructure/middlewares.html), [`filter()`](/volga-docs/en/middleware-infrastructure/middleware.html#filters), [`tap_req()`](/volga-docs/en/middleware-infrastructure/middleware.html#handling-incoming-requests), `map_ok()`, [`map_err()`](/volga-docs/en/reliability-observability/errors.html) and [`map_fallback()`](/volga-docs/en/reliability-observability/errors.html#the-fallback-handler);
* as `Option<T>`, which reads `None` where the extractor fails, and as `Result<T, Error>`, which hands the failure to the handler;
* through [`HttpRequest::extract()`](https://docs.rs/volga/latest/volga/http/request/struct.HttpRequest.html#method.extract), in a handler that takes the whole request.

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
        // Middleware takes it the way a handler does
        api.filter(|tenant: Tenant| tenant.0 != "suspended");

        api.map_get("/orders", |tenant: Tenant| ok!("orders of {}", tenant.0));
    });

    // Optional: `None` instead of a 400
    app.map_get("/", |tenant: Option<Tenant>| match tenant {
        Some(tenant) => ok!("hello, {}", tenant.0),
        None => ok!("hello"),
    });

    app.run().await
}
```

## Reading Other Extractors

[`RequestHead::extract()`](https://docs.rs/volga/latest/volga/http/endpoints/args/struct.RequestHead.html#method.extract) reads any built-in extractor of the head, or another extractor of your own, so you can build on what Volga already parses: `Query<T>`, `Path<T>`, `Header<T>`, `Cookies`, `ClientIp`, `Dc<T>`. Here a locale comes from `?lang=` when the request has one, and from `Accept-Language` otherwise:

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

An extractor of your own can read the path parameters as well, through `Path<T>` or `NamedPath<T>`, even when the handler takes a path extractor next to it.

## Services From the Container

With the `di` feature, an extractor can resolve a service through `Dc<T>`. Declare it in `dependencies()`: [`App::run()`](/volga-docs/en/advanced-patterns/di.html#what-handlers-and-middleware-take) then checks at startup that the service is registered, as it does for a `Dc<T>` a handler takes. Without the declaration, a missing service would fail every request that reaches the extractor.

```rust compile
use std::collections::HashMap;
use volga::{App, di::{Dc, Dependencies}, error::Error, ok};
use volga::http::{FromRequestHead, RequestHead, StatusCode};

// API key -> client name
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

    // GET /whoami with `x-api-key: k-123` -> billing
    app.map_get("/whoami", |client: Client| ok!("{}", client.0));

    app.run().await
}
```

## Asynchronous Work

`from_head` is synchronous: reading the head needs no awaiting, and it allocates nothing on its own. When the value takes a database or a cache lookup, a middleware does the awaiting. It hands the result over through a [scoped service](/volga-docs/en/advanced-patterns/di.html), of which every request gets its own instance, and the extractor reads it from there:

```rust compile
use std::sync::OnceLock;
use volga::{App, di::{Dc, Dependencies}, error::Error, headers::HttpHeaders, middleware::Next, ok};
use volga::http::{FromRequestHead, RequestHead, StatusCode};

#[derive(Clone)]
struct Session {
    user: String,
}

// One per request: the middleware fills it, the extractor reads it
#[derive(Default)]
struct SessionSlot(OnceLock<Session>);

async fn load_session(token: &str) -> Option<Session> {
    // e.g. a database or a cache lookup
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

    // GET /me with `x-session: s-1` -> hello, alice
    app.map_get("/me", |session: Session| ok!("hello, {}", session.user));

    app.run().await
}
```

## What to Implement

| To get | Implement |
|---|---|
| an argument of your own: a current user, a tenant, a locale | `FromRequestHead` |
| a value read from one path parameter, taken as `Path<T>` | [`FromPathArg`](/volga-docs/en/getting-started/route-params.html#parameters-of-your-own-types) |
| a value read from several path parameters | [`FromPathArgs`](/volga-docs/en/reference/routing.html#reading-every-parameter-at-once) |
| a typed header, taken as `Header<T>` | [`FromHeaders` or `#[http_header]`](/volga-docs/en/requests-responses/headers.html) |
| rules a value has to meet | [`Validate`](/volga-docs/en/requests-responses/validation.html) |

`FromRequest` and `FromRequestRef` show up in the signatures of `map_get`, `with` and the rest. They are bounds rather than extension points: they are sealed, so an `impl` of one does not compile. They stay public, so that a helper generic over a handler can name them.

A body format Volga does not know is read in the handler, from [`HttpBody`](/volga-docs/en/requests-responses/body.html) or `ByteStream`, with the body limit already applied.
