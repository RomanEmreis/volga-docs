# Query parameters

The request's query parameters can be extracted in the same way as the route parameters. They live in the same `HashMap` collection and cannot share the names. If the query parameter appears to have the same name as the route parameter, it will be overwritten by the value from the route parameter.

This is how we can access them:
```rust
use volga::{App, AsyncEndpointsMapping, Results, Params};

#[tokio::main]
async fn main() -> tokio::io::Result<()> {
    let mut app = App::build("localhost:7878").await?;

    app.map_get("/hello", |request| async move {
        let params = request.params().unwrap();
        let id = params.get("name").unwrap();

        Results::text(&format!("Hello {name}!"))
    }).await;

    app.run().await
}
```
And if we run this code and try to make some requests, it will return the following:
```bash
> curl http://localhost:7878/hello?name=world
Hello world!

> curl http://localhost:7878/hello?name=earth
Hello earth!

> curl http://localhost:7878/hello?name=sun
Hello sun!
```
Similar idea if it is required to apply multiple query parameters:
```rust
use volga::{App, AsyncEndpointsMapping, Results, Params};

#[tokio::main]
async fn main() -> tokio::io::Result<()> {
    let mut app = App::build("localhost:7878").await?;

    app.map_get("/hello", |request| async move {
        let params = request.params().unwrap();
        let name = params.get("name").unwrap();
        let descr = params.get("descr").unwrap();

        Results::text(&format!("Hello {descr} {name}!"))
    }).await;

    app.run().await
}
```
And the if you run this command, it will return this result:
```bash
> curl "http://localhost:7878/hello?descr=beautiful&name=world"
Hello beautiful world!
```
