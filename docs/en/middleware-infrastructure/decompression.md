# Request Decompression

Similarly to compression, Volga provides a middleware feature that decompresses HTTP request bodies based on the `Content-Encoding` header. Currently, Volga supports four decompression algorithms: [Brotli](https://en.wikipedia.org/wiki/Brotli), [Gzip](https://en.wikipedia.org/wiki/Gzip), [Deflate](https://en.wikipedia.org/wiki/Deflate), and [Zstandard](https://en.wikipedia.org/wiki/Zstd).

## Enabling Decompression

To enable request decompression, ensure you include the necessary feature in your `Cargo.toml`. If you're not using the `full` feature set, enable the `decompression-full` feature as follows:

```toml
[dependencies]
volga = { version = "0.15", features = ["decompression-full"] }
```

If you only need specific decompression algorithms, specify them explicitly:

```toml
[dependencies]
volga = { version = "0.15", features = ["decompression-brotli", "decompression-gzip"] }
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
Then you can test it with `curl` command after creating and packing the `users.json.gz` file which you can make from the response of the Response Compressions topic's [example](/volga-docs/en/middleware-infrastructure/compression.html#example-of-usage):
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

A body that is not a valid stream of its `Content-Encoding`, garbage or a stream cut short, is answered [`400 Bad Request`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/400) with the text `Decompression error: InvalidCompressedBody` since **0.15.1**. Before, most such bodies got `500`.

A body that goes over a decompression limit, set with [`with_decompression_limits()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.with_decompression_limits) (or, since **0.14.1**, installed whole with [`set_decompression_limits()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.set_decompression_limits)), is answered [`413 Content Too Large`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/413), as one over the [request body limit](/volga-docs/en/requests-responses/body.html#limiting-the-body-size) is. The body limit is counted on the decompressed body.

An algorithm Volga does not have goes into a [`tap_req`](/volga-docs/en/middleware-infrastructure/middleware.html#replacing-the-body) of your own: `req.try_map_body(decode)` wraps the body into your decoder, under the same body limit.

### Window Sizes

A decoder allocates the window a stream declares before any output exists for the limits to count, so the window is bounded on its own. Since **0.15.1**:

* **Brotli** streams are held to RFC 7932, whose window is at most 16 MiB. A stream with the large-window extension, whose window goes up to 1 GiB, is answered `400`: before, a body of a few bytes could make the server allocate a gigabyte.
* **zstd** frames may declare a window of up to 8 MiB, the limit RFC 9659 sets for the `zstd` content coding, where zstd itself allows 128 MiB. A frame with a larger window is answered `400`. zstd keeps within 8 MiB up to level 19; the `--ultra` levels 20 to 22 and `--long` use larger windows on large inputs, so a client should not compress request bodies with them.

Here is the [full example](https://github.com/RomanEmreis/volga/blob/main/examples/decompression/src/main.rs)