# Headers

Volga supports both reading request headers and writing response headers. 

If you need to read a request header you can call a `headers()` method that returns a `HashMap` collection of all the request headers:
```rust
use volga::{App, AsyncEndpointsMapping, Results, Params};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::build("localhost:7878").await?;

    app.map_get("/hello", |request| async move {
        let api_key = request.headers().get("x-api-key").unwrap();

        Results::text(&format!("The api-key is: {:?}", api_key))
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
           content: Box::new(String::from("Hello World!")),
           headers: Some(headers),
           content_type: None
       })
   });

   app.run().await
}
```
Here we need to use the `ResponseContext` struct that allows us to customize the response with specific Headers and Content-Type.

Both `headers` and `content_type` fields are of `Option<T>` type, So if we only need to specify one of them, like in the example above we assign the `headers`, so the `content_type` can be `None`. In that case, it will be the `text/plain` by default. If we need an explicit Content-Type, we can set it as `Some(mime::TEXT_PLAIN)` or anything else.

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