# Headers

Volga supports both reading request headers and writing response headers. 

If you need to read a request header you can call a `headers()` method that returns a `HashMap` collection of all the request headers:
```rust
use volga::{App, AsyncEndpointsMapping, Params, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::build("localhost:7878").await?;

    app.map_get("/hello", |request| async move {
        let api_key = request.headers().get("x-api-key").unwrap();

        ok!("The api-key is: {:?}", api_key)
    });

    app.run().await
}
```
And then you can run the following command to test it:
```bash
> curl "http://127.0.0.1:7878/health" -H "x-api-key: test"
The api-key is: "test"
```
To add your custom headers, you need to create a new `HashMap` and insert all the keyvalues whatever you want:
```rust
use volga::{App, AsyncEndpointsMapping, Results, ResponseContext};
use std::collections::HashMap;

#[tokio::main]
async fn main() -> std::io::Result<()> {
   let mut app = App::build("localhost:7878").await?;

   app.map_get("/hello", |request| async move {
       let mut headers = HashMap::new();

       // Insert a custom header
       headers.insert(String::from("x-api-key"), String::from("some api key"));
       
       Results::from(ResponseContext {
           status: 200,
           content: String::from("Hello World!"),
           headers
       })
   });

   app.run().await
}
```
Here we need to use the `ResponseContext` struct that allows us to customize the response with specific headers, status or content type.

Both `headers` and `status` fields are requred. If the "Content-Type" header is not persisted in the `headers` map the `application/json` content type will be used by default. To use the specific one you can just add it explicitly:
```rust
headers.insert(String::from("Content-Type"), String::from("text/plain"));
```

Then we can run the following command:
```bash
> curl -v "http://127.0.0.1:7878/health"
```
and the result will be like this:
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
< content-length: 14
< content-type: text/plain
< x-api-key: some api key
<
* Connection #0 to host localhost left intact
Hello World!
```
## headers! and ok!
However, there is a more convenient way to deal with headers using `headers!` or `ok!` macro that is a syntax sugar for the code above.
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
Or we can simply combine this with the `ok!` macro:
```rust
use volga::{App, AsyncEndpointsMapping, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
   let mut app = App::build("localhost:7878").await?;

   app.map_get("/hello", |request| async move {
       ok!("Hello World!", [
           ("x-api-key", "some api key"),
           ("Content-Type", "text/plain")
       ])
   });

   app.run().await
}
```