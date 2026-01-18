# Headers

Volga makes it possible to easily manage HTTP headers, both for reading from requests and writing to responses.

## Reading Request Headers

To read headers from an incoming request, you can use [`Header<T>`](https://docs.rs/volga/latest/volga/headers/header/struct.Header.html) to extract a specific header from the request or [`HttpHeaders`](https://docs.rs/volga/latest/volga/headers/header/struct.HttpHeaders.html) to get the full [`HeadersMap`](https://docs.rs/http/latest/http/header/struct.HeaderMap.html) readonly snapshot.

### Using `Header<T>`
```rust
use volga::{App, ok};
use volga::headers::{Header, ContentType};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/hello", |content_type: Header<ContentType>| async move {
        ok!("{content_type}")
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
If you need to read some custom HTTP header, you can specify a **unit struct** that describes your header and then implement the [`FromHeaders`](https://docs.rs/volga/latest/volga/headers/trait.FromHeaders.html) trait for it, here is the example of how you can do it:
```rust
use volga::{App, ok};
use volga::headers::{Header, FromHeaders, HeaderMap, HeaderValue};

// The `x-api-key` header
struct ApiKey;

// FromHeaders trait implementation for ApiKey header
impl FromHeaders for ApiKey {
    const NAME: HeaderName = HeaderName::from_static("x-api-key");

    // Reading the header from request's HeaderMap 
    fn from_headers(headers: &HeaderMap) -> Option<&HeaderValue> {
        headers.get(Self::header_type())
    }
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/hello", |api_key: Header<ApiKey>| async move {
        ok!("Received {api_key}")
    });

    app.run().await
}
```
Now you can test this by running `curl` command:
```bash
> curl "http://127.0.0.1:7878/hello" -H "x-api-key: 123-321"
Received x-api-key: 123-321
```
### Simplifying custom headers handling with `headers!` macro
The code above can be a way simplified by using the [`headers!`](https://docs.rs/volga/latest/volga/macro.headers.html) macro, expecially if you need to add multiple headers:
```rust
use volga::{App, ok};
use volga::headers::{
    Header,
    headers
};

// Custom headers
headers! {
    (ApiKey, "x-api-key"),
    (CorrelationId, "x-corr-id")
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/hello", |api_key: Header<ApiKey>, corr_id: Header<CorrelationId>| async move {
        ok!("Received {api_key}; {corr_id}")
    });

    app.run().await
}
```
And then you can test this by running `curl` command:
```bash
> curl "http://127.0.0.1:7878/hello" -H "x-api-key: 123-321" -H "correlation-id: 456-654"
Received x-api-key: 123-321; correlation-id: 456-654
```

### Using `HttpHeaders`
The same can be achieved also by using [`HttpHeaders`](https://docs.rs/volga/latest/volga/headers/header/struct.HttpHeaders.html) struct:
```rust
use volga::{App, ok};
use volga::headers::HttpHeaders;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/hello", |headers: HttpHeaders| async move {
        let api_key = headers.get_raw("x-api-key")
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

### Using `http_header`
Another convenient way to work with custom HTTP headers in Volga is the [`http_header`](https://docs.rs/volga/latest/volga/headers/attr.http_header.html) attribute macro.
It’s especially useful when you want to define strongly-typed header wrappers with clear semantics.

Here’s an example of how to create and use a custom header:
```rust
use volga::{App, ok};
use volga::headers::{Header, HttpHeaders, http_header};

// Define a custom header type
#[http_header("x-api-key")]
struct ApiKey;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/hello", |headers: HttpHeaders| async move {
        let api_key: Header<ApiKey> = headrs.try_get()?;
        ok!("Received {api_key}")
    });

    app.run().await
}
```
You can test the endpoint with `curl`:
```bash
curl "http://127.0.0.1:7878/hello" -H "x-api-key: 123-321"
Received x-api-key: 123-321
```

:::info
The [`http_header`](https://docs.rs/volga/latest/volga/headers/attr.http_header.html) macro is part of the optional `macros` feature.
Make sure to enable it in your `Cargo.toml`:
```toml
volga = { version = "...", features = ["macros"] }
```
:::

## Writing Response Headers

The easiest way to respond with HTTP headers using the [`ok!`](https://docs.rs/volga/latest/volga/macro.ok.html) macro:
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

Check out the full examples [here](https://github.com/RomanEmreis/volga/blob/main/examples/headers/src/main.rs) and [here](https://github.com/RomanEmreis/volga/blob/main/examples/custom_request_headers/src/main.rs)