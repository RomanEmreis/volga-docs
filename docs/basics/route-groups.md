# Route Groups

Volga provides a convenient mechanism for grouping routes using prefixes. This helps organize and manage related endpoints more effectively. You can achieve this by using the [`map_group`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_group) method. Once a group is defined, you can apply the same mapping methods (e.g., [`map_get`](https://docs.rs/volga/latest/volga/app/router/struct.RouteGroup.html#method.map_get) or [`map_post`](https://docs.rs/volga/latest/volga/app/router/struct.RouteGroup.html#method.map_post)) as you would on the main application.

### Example Usage

Here is an example demonstrating how to use route groups in a Volga application:

```rust
use volga::{App, HttpResult, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // Group routes under the "/user" prefix
    app.map_group("/user")
        .map_get("/{id}", get_user)               // GET /user/{id}
        .map_post("/create/{name}", create_user); // POST /user/create/{name}

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
  The [`map_group`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_group) method creates a [`RouteGroup`](https://docs.rs/volga/latest/volga/app/router/struct.RouteGroup.html) that shares a common prefix, in this case, `/user`.  
- **Mapping Methods**:  
  Within the group, routes are defined using methods like [`map_get`](https://docs.rs/volga/latest/volga/app/router/struct.RouteGroup.html#method.map_get) and [`map_post`](https://docs.rs/volga/latest/volga/app/router/struct.RouteGroup.html#method.map_post). These work just like they do on the root application object but inherit the prefix defined in the group.

You can find more examples [here](https://github.com/RomanEmreis/volga/blob/main/examples/route_groups/src/main.rs).
