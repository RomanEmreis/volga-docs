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

## One Route, One Registration

A route is registered under the name the router reads, so `/x`, `/x/` and `//x` are one route everywhere it is remembered — not only in the route tree. A group configures each of its routes once, whether it mapped it twice itself or a sub-group mapped it again.

Mapping a route that is already mapped **replaces** it, along with everything bound to the registration being replaced. A handler and its middleware are written together and stand or fall together, and the OpenAPI operation is built from the configuration the route currently holds.

:::warning
A group prefix is a route pattern like any other, so it counts towards the [route parameter naming rules](/volga-docs/en/getting-started/route-params.html#parameter-names-are-per-route): `group("/{tenant}", ..)` beside `map_get("/{id}/items", ..)` is one route under two names, and panics at registration.
:::

You can find more examples [here](https://github.com/RomanEmreis/volga/blob/main/examples/route_groups/src/main.rs).
