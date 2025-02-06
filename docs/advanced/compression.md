# Response Compression

Volga provides a middleware feature that compresses HTTP response bodies based on the `Accept-Encoding` header. Currently, Volga supports four compression algorithms: [Brotli](https://en.wikipedia.org/wiki/Brotli), [Gzip](https://en.wikipedia.org/wiki/Gzip), [Deflate](https://en.wikipedia.org/wiki/Deflate), and [Zstandard](https://en.wikipedia.org/wiki/Zstd).

## Enabling Compression

To enable response compression, ensure you include the necessary feature in your `Cargo.toml`. If you're not using the `full` feature set, enable the `compression-full` feature as follows:

```toml
[dependencies]
volga = { version = "0.4.6", features = ["compression-full"] }
```

If you only need specific compression algorithms, specify them explicitly:

```toml
[dependencies]
volga = { version = "0.4.6", features = ["compression-brotli", "compression-gzip"] }
```

## Example of usage

To use compression in your application, call the [`use_compression()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.use_compression) method in your `main.rs`:

```rust
use volga::{App, ok};
use serde::Serialize;
 
#[derive(Serialize)]
struct User {
    name: String,
    age: i32
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // Enable response body compression middleware
    app.use_compression();

    app.map_get("/users", || async {
        let mut values = Vec::new();
        for i in 0..10000 {
            values.push(User { 
                age: i, 
                name: i.to_string()
            });
        }
        ok!(values)
    });
    
    app.run().await
}
```
Then you can test in with the `curl` command:
```bash
> curl -v --location "http://127.0.0.1:7878/users" \
      -H "Accept-Encoding: br" \
      -H "Content-Type: application/json"
```
```bash
*   Trying 127.0.0.1:7878...
* Connected to 127.0.0.1 (127.0.0.1) port 7878
> GET /hello HTTP/1.1
> Host: 127.0.0.1:7878
> User-Agent: curl/8.9.1
> Accept: */*
> Accept-Encoding: br
> Content-Type: application/json
>
* Request completely sent off
< HTTP/1.1 200 OK
< server: Volga
< content-type: application/json
< vary: accept-encoding
< content-encoding: br
< transfer-encoding: chunked
< date: Fri, 10 Jan 2025 14:14:37 GMT
<
...binary data
```

## How it works

When a request is received, the compression middleware examines the `Accept-Encoding` HTTP header to determine the appropriate compression algorithm, considering the availability of the required feature and the q-value (q-factor) if multiple options are provided. The middleware then compresses the response body using the selected algorithm and sets the `Content-Encoding` HTTP header accordingly.

If the `Accept-Encoding` header specifies an unsupported algorithm, the middleware responds with a [`406 Not Acceptable`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/406) status code.

Here is the [full example](https://github.com/RomanEmreis/volga/blob/main/examples/compression.rs)