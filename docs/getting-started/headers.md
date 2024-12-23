# Headers

Volga makes it possible to easily manage HTTP headers, both for reading from requests and writing to responses.

## Reading Request Headers

To read headers from an incoming request, you can use [`Header<T>`](https://docs.rs/volga/latest/volga/app/endpoints/args/headers/struct.Header.html) to extract a specific header from the request or [`Headers`](https://docs.rs/volga/latest/volga/app/endpoints/args/headers/struct.Headers.html) to get the full [`HeadersMap`](https://docs.rs/http/latest/http/header/struct.HeaderMap.html).

### Using `Header<T>`
```rust
use volga::{App, ok};
use volga::headers::{Header, ContentType};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/hello", |content_type: Header<ContentType>| async move {
        ok!("Content-Type: {content_type}")
    });

    app.run().await
}
```
You can test this by sending a request with the `curl`:
```bash
> curl "http://127.0.0.1:7878/hello" -H "content-type: text/plain"
Content-Type: text/plain
```

### Reading a custom HTTP header with `Header<T>`
If you need to read some custom HTTP header, you can specify a **unit struct** that describes your header and then implement the [`FromHeaders`](https://docs.rs/volga/latest/volga/app/endpoints/args/headers/trait.FromHeaders.html) trait for it, here is the example of how you can do it:
```rust
use volga::{App, ok};
use volga::headers::{Header, FromHeaders, HeaderMap, HeaderValue};

// The `x-api-key` header
struct ApiKey;

// FromHeaders trait implementation for ApiKey header
impl FromHeaders for ApiKey {
    // Reading the header from request's HeaderMap 
    fn from_headers(headers: &HeaderMap) -> Option<&HeaderValue> {
        headers.get(Self::header_type())
    }
    
    // String representation of the header
    fn header_type() -> &'static str {
        "x-api-key"
    }
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/hello", |api_key: Header<ApiKey>| async move {
        ok!("Received x-api-key: {api_key}")
    });

    app.run().await
}
```
Now you can test this by running `curl` command:
```bash
> curl "http://127.0.0.1:7878/hello" -H "x-api-key: 123-321"
Received x-api-key: 123-321
```
### Simplifying custom headers handling with `custom_headers!` macro
The code above can be a way simplified by using the [`custom_headers!`](https://docs.rs/volga/latest/volga/app/endpoints/args/headers/macro.custom_headers.html) macro, expecially if you need to add multiple headers:
```rust
use volga::{App, ok};
use volga::headers::{
    Header,
    cuctom_headers
};

// Custom headers
custom_headers! {
    (ApiKey, "x-api-key"),
    (CorrelationId, "x-corr-id")
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/hello", |api_key: Header<ApiKey>, corr_id: Header<CorrelationId>| async move {
        ok!("Received x-api-key: {api_key}; correlation-id: {corr_id}")
    });

    app.run().await
}
```
And then you can test this by running `curl` command:
```bash
> curl "http://127.0.0.1:7878/hello" -H "x-api-key: 123-321" -H "correlation-id: 456-654"
Received x-api-key: 123-321; correlation-id: 456-654
```
### Using `Headers`
The same can be achieved also by using [`Headers`](https://docs.rs/volga/latest/volga/app/endpoints/args/headers/struct.Headers.html) struct:
```rust
use volga::{App, ok};
use volga::headers::Headers;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/hello", |headers: Headers| async move {
        let api_key = headers.get("x-api-key")
            .unwrap()
            .to_str()
            .unwrap();
        ok!("Received x-api-key: {api_key}")
    });

    app.run().await
}
```
You can test this by sending a request with the `curl`:
```bash
> curl "http://127.0.0.1:7878/hello" -H "x-api-key: 123-321"
Received x-api-key: 123-321
```

## Writing Response Headers
To add custom headers to your response, create a new [`HashMap`](https://docs.rs/http/latest/http/header/struct.HeaderMap.html), populate it with your headers, then wrap it into a [`ResponseContext`](https://docs.rs/volga/latest/volga/app/results/struct.ResponseContext.html) and then use the [`Results::from()`](https://docs.rs/volga/latest/volga/app/results/struct.Results.html#method.from) method:
```rust
use std::collections::HashMap;
use volga::{App, Results, ResponseContext};

#[tokio::main]
async fn main() -> std::io::Result<()> {
   let mut app = App::new();

   app.map_get("/hello", || async {
       let mut headers = HashMap::new();

       // Insert custom headers
       headers.insert(String::from("x-api-key"), String::from("some api key"));
       headers.insert(String::from("Content-Type"), String::from("text/plain"));
       
       Results::from(ResponseContext {
           status: 200,
           content: "Hello World!",
           headers
       })
   });

   app.run().await
}
```
Here we need to use the [`ResponseContext`](https://docs.rs/volga/latest/volga/app/results/struct.ResponseContext.html) struct that allows us to customize the response with specific headers or status.

Both `headers` and `status` fields are required. If the **Content-Type** header is not persisted in the `headers` the `application/json` content type will be used by default. To use the specific one, you can just add it explicitly:
```rust
headers.insert(String::from("Content-Type"), String::from("text/plain"));
```
Execute the following `curl` command to see the headers in action:
```bash
> curl -v "http://127.0.0.1:7878/hello"
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
Volga also provides macros, such as [`headers!`](https://docs.rs/volga/latest/volga/macro.headers.html) and [`ok!`](https://docs.rs/volga/latest/volga/macro.ok.html), which streamline the process of setting headers:
```rust
use volga::{App, Results, ResponseContext, headers};

#[tokio::main]
async fn main() -> std::io::Result<()> {
   let mut app = App::new();

   app.map_get("/hello", || async {
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
Or we can combine them with the [`ok!`](https://docs.rs/volga/latest/volga/macro.ok.html) macro to make this even simpler:
```rust
use volga::{App, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
   let mut app = App::new();

   app.map_get("/hello", || async {
       ok!("Hello World!", [
           ("Content-Type", "text/plain"),
           ("x-api-key", "some api key")
       ])
   });

   app.run().await
}
```
This approach combines response content and headers succinctly, making your code more readable and maintainable.

Check out the full examples [here](https://github.com/RomanEmreis/volga/blob/main/examples/headers.rs) and [here](https://github.com/RomanEmreis/volga/blob/main/examples/custom_request_headers.rs)