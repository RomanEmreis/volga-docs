# Raw Request Body

Most handlers take a typed extractor — [`Json<T>`](/volga-docs/en/requests-responses/json-payload.html), [`Form<T>`](/volga-docs/en/requests-responses/form.html), [`Multipart`](/volga-docs/en/requests-responses/multipart.html) — and never touch the bytes underneath. When you do need them (a proxy, a webhook whose signature covers the exact payload, a custom wire format), Volga exposes the body itself.

## Reading the Body as Bytes

Starting with **v0.9.4**, [`HttpBody`](https://docs.rs/volga/latest/volga/http/body/struct.HttpBody.html) is an extractor — take it as a handler argument to get the raw request body:

```toml
[dependencies]
volga = { version = "..." }
tokio = { version = "...", features = ["full"] }
http-body-util = "0.1"
```

```rust
use http_body_util::BodyExt;
use volga::{App, HttpBody, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_post("/raw", |body: HttpBody| async move {
        let bytes = body.collect().await?.to_bytes();
        ok!(format!("received {} bytes", bytes.len()))
    });

    app.run().await
}
```

Collecting the body needs the [`Body`](https://docs.rs/http-body/latest/http_body/trait.Body.html) trait methods, which come from the [`BodyExt`](https://docs.rs/http-body-util/latest/http_body_util/trait.BodyExt.html) extension trait of `http-body-util` — Volga does not re-export it.

::: warning
The request body is a stream that can be consumed only once, so [`HttpBody`](https://docs.rs/volga/latest/volga/http/body/struct.HttpBody.html) cannot be combined with another body extractor in the same handler. Extractors that read only the request head — [`Path<T>`](/volga-docs/en/getting-started/route-params.html), [`Query<T>`](/volga-docs/en/getting-started/query-params.html), [`HttpHeaders`](/volga-docs/en/requests-responses/headers.html), [`Dc<T>`](/volga-docs/en/advanced-patterns/di.html) — combine with it freely.
:::

::: tip
The body limit still applies: by default Volga rejects request bodies over 5 MB. Configure it with [`with_body_limit()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.with_body_limit) or lift it entirely with [`without_body_limit()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.without_body_limit).
:::

## Passing the Body Through

[`HttpBody`](https://docs.rs/volga/latest/volga/http/body/struct.HttpBody.html) can also be returned, which makes a pass-through handler a matter of moving it into the response — nothing is buffered:

```rust
use volga::{App, HttpBody, HttpResponse, headers::ContentType};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_post("/trace", |body: HttpBody| async move {
        HttpResponse::builder()
            .status(200)
            .header(ContentType::multipart_form_data("X-BOUNDARY"))
            .body(body)
    });

    app.run().await
}
```

## Streaming the Body

To process the body as it arrives instead of collecting it, take [`HttpBodyStream`](https://docs.rs/volga/latest/volga/http/body/type.HttpBodyStream.html) — a [`ByteStream`](https://docs.rs/volga/latest/volga/http/endpoints/args/byte_stream/struct.ByteStream.html) over the request body, which implements [`Stream<Item = Result<Bytes, Error>>`](https://docs.rs/futures-core/latest/futures_core/stream/trait.Stream.html):

```toml
[dependencies]
volga = { version = "..." }
tokio = { version = "...", features = ["full"] }
futures-util = "0.3"
```

```rust
use futures_util::StreamExt;
use volga::{App, http::HttpBodyStream, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_post("/count", |mut stream: HttpBodyStream| async move {
        let mut total = 0;
        while let Some(chunk) = stream.next().await {
            total += chunk?.len();
        }
        ok!(format!("received {total} bytes"))
    });

    app.run().await
}
```

Use this for bodies you would rather not hold in memory at once — hashing an upload, forwarding chunks to storage, parsing a line-delimited stream.

## Building a Body

The same type constructs response bodies, which is what the [`ok!`](https://docs.rs/volga/latest/volga/macro.ok.html) family of macros does under the hood:

| Constructor | Produces |
|---|---|
| [`HttpBody::full`](https://docs.rs/volga/latest/volga/http/body/struct.HttpBody.html#method.full) | a complete in-memory body from anything convertible into `Bytes` |
| [`HttpBody::empty`](https://docs.rs/volga/latest/volga/http/body/struct.HttpBody.html#method.empty) | an empty body |
| [`HttpBody::json`](https://docs.rs/volga/latest/volga/http/body/struct.HttpBody.html#method.json) / [`form`](https://docs.rs/volga/latest/volga/http/body/struct.HttpBody.html#method.form) | a serialized JSON or form body |
| [`HttpBody::file`](https://docs.rs/volga/latest/volga/http/body/struct.HttpBody.html#method.file) | a streaming body over an open file |
| [`HttpBody::stream`](https://docs.rs/volga/latest/volga/http/body/struct.HttpBody.html#method.stream) / [`stream_bytes`](https://docs.rs/volga/latest/volga/http/body/struct.HttpBody.html#method.stream_bytes) | a streaming body over any `Stream` |

## Examples

You can find a raw body pass-through in the [multipart example](https://github.com/RomanEmreis/volga/blob/main/examples/multipart/src/main.rs).
