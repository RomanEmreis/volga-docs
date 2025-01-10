# Request Decompression

Similarly to compression, Volga provides a middleware feature that decompresses HTTP request bodies based on the `Content-Encoding` header. Currently, Volga supports four decompression algorithms: [Brotli](https://en.wikipedia.org/wiki/Brotli), [Gzip](https://en.wikipedia.org/wiki/Gzip), [Deflate](https://en.wikipedia.org/wiki/Deflate), and [Zstandard](https://en.wikipedia.org/wiki/Zstd).

## Enabling Decompression

To enable request decompression, ensure you include the necessary feature in your `Cargo.toml`. If you're not using the `full` feature set, enable the `decompression-full` feature as follows:

```toml
[dependencies]
volga = { version = "0.4.6", features = ["decompression-full"] }
```

If you only need specific decompression algorithms, specify them explicitly:

```toml
[dependencies]
volga = { version = "0.4.6", features = ["decompression-brotli", "decompression-gzip"] }
```

## Example of usage

To use decompression in your application, call the [`use_decompression()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.use_decompression) method in your `main.rs`:

```rust
use volga::{App, Json, ok};
use serde::Deserialize;
 
#[derive(Deserialize)]
struct User {
    name: String,
    age: i32
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // Enable request body decompression middleware
    app.use_decompression();

    app.map_post("/users", |Json(users): Json<Vec<User>>| async move {
        ok!(users)
    });
    
    app.run().await
}
```
Then you can test it with `curl` command after creating and packing the `users.json.gz` file which you can make from the response of the Response Compressions topic's [example](/volga-docs/getting-started/compression.html#example-of-usage):
```bash
curl -v -X POST --location 'http://127.0.0.1:7878/users' \
    -H "Content-Type: application/json" \
    -H "Content-Encoding: gzip" \
    --compressed \
    --data-binary users.json.gz
```

## How it works

When a request is received, the decompression middleware checks the `Content-Encoding` HTTP header to determine the compression algorithm, wrap the request body in an appropriate decompression stream and removes the `Content-Encoding` HTTP header, indicating that the request body is no longer compressed. If the `Content-Encoding` header is not provided middleware ignores this request and leaves the body as is.

If the `Content-Encoding` header specifies an unsupported algorithm, the middleware responds with a [`415 Unsupported Media Type`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/415) status code.

Here is the [full example](https://github.com/RomanEmreis/volga/blob/main/examples/decompression.rs)