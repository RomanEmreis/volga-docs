# Route parameters

Volga supports a rich routing configuration that can be configured by a pattern when mapping a request handler. Calling the `params()` method allows to access all the request parameters `HashMap` collection:
```rust
use volga::{App, AsyncEndpointsMapping, Results, Params};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::build("localhost:7878").await?;

    app.map_get("/hello/{name}", |request| async move {
        let params = request.params().unwrap();
        let name = params.get("name").unwrap();

        Results::text(&format!("Hello {name}!"))
    }).await;

    app.run().await
}
```
In the code above, in the curly brackets, we described the GET route with a `name` parameter, so if we run requests like below over the Web API it will call the same handler and pass an appropriate `name` as a route parameter.
```bash
> curl http://localhost:7878/hello/world
Hello world!

> curl http://localhost:7878/hello/earth
Hello earth!

> curl http://localhost:7878/hello/sun
Hello sun!
```
You can also configure multiple parameters:
```rust
use volga::{App, AsyncEndpointsMapping, Results, Params};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::build("localhost:7878").await?;

    app.map_get("/hello/{descr}/{name}", |request| async move {
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
> curl "http://localhost:7878/hello/beautiful/world"
Hello beautiful world!
```
Alternative, and in some cases a more convenient way to get the route parameters:
```rust
use volga::{App, AsyncEndpointsMapping, Results, Params};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::build("localhost:7878").await?;

    app.map_get("/hello/{descr}/{name}", |request| async move {
        let name = request.param("name")?;
        let descr = request.param("descr")?;

        Results::text(&format!("Hello {descr} {name}!"))
    }).await;

    app.run().await
}
```
The example above technically works the same but in this case, if the parameters weren't provided it will return the `Bad Request 400`