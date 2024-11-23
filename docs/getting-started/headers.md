# Headers

Volga makes it possible to easily manage HTTP headers, both for reading from requests and writing to responses.

## Reading Request Headers

To read headers from an incoming request, you can call the `headers()` method, which returns a `HashMap` containing all the headers:
```rust
use volga::{App, AsyncEndpointsMapping, Params, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::build("localhost:7878").await?;

    app.map_get("/hello", |request| async move {
        let api_key = request
            .headers()
            .get("x-api-key")
            .unwrap_or_else(|| "No API key provided");

        ok!("The api-key is: {:?}", api_key)
    });

    app.run().await
}
```
You can test this by sending a request with the `curl`:
```bash
> curl "http://127.0.0.1:7878/health" -H "x-api-key: test"
The api-key is: "test"
```
## Writing Response Headers
To add custom headers to your response, create a new HashMap, populate it with your headers, and pass it to `ResponseContext`:
```rust
use volga::{App, AsyncEndpointsMapping, Results, ResponseContext};
use std::collections::HashMap;

#[tokio::main]
async fn main() -> std::io::Result<()> {
   let mut app = App::build("localhost:7878").await?;

   app.map_get("/hello", |request| async move {
       let mut headers = HashMap::new();

       // Insert custom headers
       headers.insert(String::from("x-api-key"), String::from("some api key"));
       headers.insert(String::from("Content-Type"), String::from("text/plain"));
       
       Results::from(ResponseContext {
           status: 200,
           content: String::from("Hello World!"),
           headers
       })
   });

   app.run().await
}
```
Here we need to use the `ResponseContext` struct that allows us to customize the response with specific headers or status.

Both `headers` and `status` fields are requred. If the **Content-Type** header is not persisted in the `headers` the `application/json` content type will be used by default. To use the specific one you can just add it explicitly:
```rust
headers.insert(String::from("Content-Type"), String::from("text/plain"));
```
Execute the following `curl` command to see the headers in action::
```bash
> curl -v "http://127.0.0.1:7878/health"
```
The response will include your custom headers:
```bash
* Host localhost:7878 was resolved.
* IPv6: ::1
* IPv4: 127.0.0.1
*   Trying [::1]:7878...
* Connected to localhost (::1) port 7878
> GET /hello HTTP/1.1
> Host: localhost:7878
> User-Agent: curl/8.9.1
> Accept: */*
>
* Request completely sent off
< HTTP/1.1 200 OK
< date: Sun, 6 Oct 2024 08:22:17 +0000
< server: Volga
< content-length: 12
< content-type: text/plain
< x-api-key: some api key
<
* Connection #0 to host localhost left intact
Hello World!
```
## Simplifying Header Handling with `headers!` and `ok!`
Volga also provides macros, such as `headers!` and `ok!`, which streamline the process of setting headers:
```rust
use volga::{App, AsyncEndpointsMapping, Results, headers, ResponseContext};

#[tokio::main]
async fn main() -> std::io::Result<()> {
   let mut app = App::build("localhost:7878").await?;

   app.map_get("/hello", |request| async move {
       let mut headers = headers![
           ("x-api-key", "some api key"),
           ("Content-Type", "text/plain")
       ];

       Results::from(ResponseContext {
           status: 200
           content: "Hello World!",
           headers
       })
   });

   app.run().await
}
```
Or we can combine them with the `ok!` macro to make this even simpler:
```rust
use volga::{App, AsyncEndpointsMapping, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
   let mut app = App::build("localhost:7878").await?;

   app.map_get("/hello", |request| async move {
       ok!("Hello World!", [
           ("Content-Type", "text/plain"),
           ("x-api-key", "some api key")
       ])
   });

   app.run().await
}
```
This approach combines response content and headers succinctly, making your code more readable and maintainable.

Check out the full example [here](https://github.com/RomanEmreis/volga/blob/main/examples/headers.rs)