# Route Groups

Volga provides a convenient mechanism for grouping routes using prefixes. This helps organize and manage related endpoints more effectively. You can achieve this by using the [`group`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.group) method. Once a group is defined, you can apply the same mapping methods (e.g., [`map_get`](https://docs.rs/volga/latest/volga/app/router/struct.RouteGroup.html#method.map_get) or [`map_post`](https://docs.rs/volga/latest/volga/app/router/struct.RouteGroup.html#method.map_post)) as you would on the main application.

### Example Usage

Here is an example demonstrating how to use route groups in a Volga application:

```rust compile
use volga::{App, HttpResult, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // Group routes under the "/user" prefix
    app.group("/user", |g| {
      g.map_get("/{id}", get_user);              // GET /user/{id}
      g.map_post("/create/{name}", create_user); // POST /user/create/{name}
    });

    app.run().await
}

async fn get_user(_id: i32) -> HttpResult {
    // Read a user
    ok!("John")
}

async fn create_user(name: String) -> HttpResult {
    // Create a user
    ok!("User {name} created!")
}
```

### Explanation

- **Route Group Definition**:  
  The [`group`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.group) method creates a [`RouteGroup`](https://docs.rs/volga/latest/volga/app/router/struct.RouteGroup.html) that shares a common prefix, in this case, `/user`.  
- **Mapping Methods**:  
  Within the group, routes are defined using methods like [`map_get`](https://docs.rs/volga/latest/volga/app/router/struct.RouteGroup.html#method.map_get) and [`map_post`](https://docs.rs/volga/latest/volga/app/router/struct.RouteGroup.html#method.map_post). These work just like they do on the root application object but inherit the prefix defined in the group.

## Group-Wide Configuration

A group is a **scope**: everything it holds — middleware (`wrap`, `with`, `filter`, `map_ok`, `map_err`, `tap_req`, `attach`), a CORS policy, rate limiting, `authorize`, OpenAPI metadata — applies to every route the group registered, whatever the order inside the closure.

```rust compile
use volga::{App, HttpResult, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.group("/admin", |g| {
        g.map_get("/report", report);

        // Reaches /admin/report too, even though it is written below it
        g.filter(|| async { true });
    });

    app.run().await
}

async fn report() -> HttpResult {
    ok!("report")
}
```

::: warning Upgrading from 0.9.x
A group's configuration was read at each `map_*` call, so anything registered *below* a route did not reach it. It reaches every route now: a route mapped above its group's `authorize` or `token_bucket` answers `401` / `403` / `429` where it answered `200`.
:::

### Ordering rules

* Middleware still **runs** in registration order.
* A group's middleware runs before that of a route or of a nested group inside it — an outer scope always wraps an inner one.
* A sub-group inherits the parent's configuration wherever it is declared.
* A CORS policy that a route or a nested group chose for itself is **not** replaced by the enclosing group's.

```rust compile
use volga::{App, HttpResult, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.group("/api", |api| {
        api.filter(|| async { true });     // runs first

        api.group("/v1", |v1| {
            v1.filter(|| async { true });  // runs second

            v1.map_get("/ping", ping)
                .filter(|| async { true }); // runs third
        });
    });

    app.run().await
}

async fn ping() -> HttpResult {
    ok!("pong")
}
```

## A Fallback for the Group

Since **0.11.1** a group can answer for its own part of the URL space. [`map_fallback()`](https://docs.rs/volga/latest/volga/app/router/struct.RouteGroup.html#method.map_fallback) on a [`RouteGroup`](https://docs.rs/volga/latest/volga/app/router/struct.RouteGroup.html) answers a request aimed under the group's prefix that no route is mapped at, whatever its method — it is [`App::map_fallback()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_fallback) for one branch of the tree:

```rust compile
use volga::{App, http::Uri, not_found, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.group("/api", |api| {
        api.map_get("/models", || async { ok!("models") });

        // GET /api/nope, POST /api/v1/whatever, DELETE /api  -> this handler
        // POST /api/models                                   -> 405, a route is there
        api.map_fallback(|uri: Uri| async move {
            not_found!("no endpoint at {}", uri.path())
        });
    });

    app.run().await
}
```

The router resolves it the way it resolves routes, so there is no extra rule to keep in mind:

* **The most specific prefix wins.** The fallback of `/api` answers `/api/nope` ahead of anything mapped under `/` — a `/{*path}` route, or an SPA shell served from the root — and the fallback of `/api/v2` answers ahead of the one on `/api`.
* **A route still answers first.** A route mapped at the path the request is aimed at answers it for its own method, and a request for another method is that route's `405` with the methods it does have. That holds at the prefix itself too.
* **The group's middleware and CORS policy wrap it**, along with those of every group around it. An unknown path under an `authorize`d group is refused the way a known one is, instead of telling the caller which paths exist.

The handler takes what `App::map_fallback` takes — anything implementing [`FromRequestParts`](https://docs.rs/volga/latest/volga/http/endpoints/args/trait.FromRequestParts.html) — and reads the path it was aimed at from `Uri`. It also binds the parameters its prefix declares, and nothing else, the same at the prefix and below it:

```rust compile
use volga::{App, NamedPath, not_found, ok};
use serde::Deserialize;

#[derive(Deserialize)]
struct Tenant {
    tenant: String,
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.group("/tenants/{tenant}", |g| {
        g.map_get("/users", || async { ok!("users") });

        // Reads {tenant} for /tenants/acme, /tenants/acme/nope and /tenants/acme/a/b alike
        g.map_fallback(|params: NamedPath<Tenant>| async move {
            not_found!("tenant {} has no such endpoint", params.tenant)
        });
    });

    app.run().await
}
```

Under a prefix that ends in a catch-all — `group("/files/{*path}", ..)` — the fallback answers everything that catch-all reads, and binds it under the name the prefix gave it.

A group fallback is not a route: it is not printed with the routes at startup, not described in OpenAPI, and [`matched_route()`](https://docs.rs/volga/latest/volga/middleware/struct.HttpContext.html#method.matched_route) reads `false` for a request it answers — so a CORS preflight for a path only it answers is not answered as though an endpoint were there. Mapping a second fallback at one prefix replaces the first.

::: tip When to reach for one
An API and a single-page application in one server. The shell is served under `/` and turns every unknown path into the application, which is right for `/settings` and wrong for `/api/uesrs` — the client asked for JSON and got HTML. A `map_fallback` on the `/api` group gives that half of the URL space an answer its clients can parse, and the router prefers it for being deeper. Shape it like the rest of the API's errors — the same [Problem Details](/volga-docs/en/reliability-observability/errors.html#problem-details) body, the same fields — and a caller handles a wrong path with the code it already has for a wrong payload.
:::

## One Route, One Registration

A route is registered under the name the router reads, so `/x`, `/x/` and `//x` are one route everywhere it is remembered — not only in the route tree. A group configures each of its routes once, whether it mapped it twice itself or a sub-group mapped it again.

Mapping a route that is already mapped **replaces** it, along with everything bound to the registration being replaced. A handler and its middleware are written together and stand or fall together, and the OpenAPI operation is built from the configuration the route currently holds.

:::warning
A group prefix is a route pattern like any other, so it counts towards the [route parameter naming rules](/volga-docs/en/getting-started/route-params.html#parameter-names-are-per-route): `group("/{tenant}", ..)` beside `map_get("/{id}/items", ..)` is one route under two names, and panics at registration.
:::

You can find more examples [here](https://github.com/RomanEmreis/volga/blob/main/examples/route_groups/src/main.rs).
