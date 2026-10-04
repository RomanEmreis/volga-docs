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

```rust compile
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
The body limit still applies: by default Volga answers `413 Content Too Large` to a request body over 5 MB, however the handler reads it. See [Limiting the Body Size](#limiting-the-body-size) for setting it per application, route group or route.
:::

## Passing the Body Through

[`HttpBody`](https://docs.rs/volga/latest/volga/http/body/struct.HttpBody.html) can also be returned, which makes a pass-through handler a matter of moving it into the response — nothing is buffered:

```rust compile
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

```rust compile
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

## Limiting the Body Size

Every request body has a limit — 5 MB unless you set another. A body over it is answered [`413 Content Too Large`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/413), whichever way the handler reads it: [`Json<T>`](/volga-docs/en/requests-responses/json-payload.html), [`Form<T>`](/volga-docs/en/requests-responses/form.html), [`File`](/volga-docs/en/requests-responses/files.html), [`Multipart`](/volga-docs/en/requests-responses/files.html#multipart-uploading), `HttpBody` or a stream.

The application-wide limit is set with [`with_body_limit()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.with_body_limit), or with the `body_limit_bytes` key of the `[server]` section in a [configuration file](/volga-docs/en/middleware-infrastructure/config-files.html#built-in-sections):

```rust compile
use volga::{App, Limit};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    // 1 MB for every request body
    let app = App::new().with_body_limit(Limit::Limited(1024 * 1024));

    app.run().await
}
```

### Per Route Group and per Route

Since **0.13.1** a [route group](/volga-docs/en/getting-started/route-groups.html) and a single route can set a limit of their own with [`RouteGroup::with_body_limit()`](https://docs.rs/volga/latest/volga/app/router/struct.RouteGroup.html#method.with_body_limit) and [`Route::with_body_limit()`](https://docs.rs/volga/latest/volga/app/router/struct.Route.html#method.with_body_limit). It replaces the application's, so it can raise the limit as well as lower it — an API keeps a tight limit for its JSON endpoints and still takes files on the one route that needs them:

```rust compile
use futures_util::StreamExt;
use volga::{App, Json, Limit, http::HttpBodyStream, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.group("/api", |api| {
        // All a JSON API needs
        api.with_body_limit(Limit::Limited(64 * 1024));

        api.map_post("/messages", |Json(text): Json<String>| async move {
            ok!(text)
        });

        // The one route that takes a file
        api.map_post("/attachments", |mut stream: HttpBodyStream| async move {
            let mut total = 0;
            while let Some(chunk) = stream.next().await {
                total += chunk?.len();
            }
            ok!(format!("stored {total} bytes"))
        })
        .with_body_limit(Limit::Limited(20 * 1024 * 1024));
    });

    app.run().await
}
```

Which limit a request gets is decided by where it was routed:

* **The most specific limit wins.** A route's own limit over its group's, a nested group's over the one around it, a group's over the application's. Where nothing sets one, the application's applies.
* **A group's limit reaches every route it registered**, its nested groups' routes included, whatever the order inside the closure — like the rest of a group's [configuration](/volga-docs/en/getting-started/route-groups.html#group-wide-configuration). A route or a nested group that set a limit of its own keeps it.
* **A group's [fallback](/volga-docs/en/getting-started/route-groups.html#a-fallback-for-the-group) takes the group's limit.** A request that no route or group claims takes the application's.
* **`Limit::Default` is the framework default**, 5 MB — not the limit of the group or the application around it. To inherit that one, don't set a limit at all.

[`HttpRequest::body_limit()`](https://docs.rs/volga/latest/volga/http/request/struct.HttpRequest.html#method.body_limit) reports the limit the request got, in bytes, or `None` when it has none — in a handler or in [middleware](/volga-docs/en/middleware-infrastructure/middleware.html).

### Lifting the Limit

[`without_body_limit()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.without_body_limit) removes the limit — for the whole application, or, since **0.13.1**, for one group or one route. `Limit::Unlimited` does the same. It is meant for a handler that streams the body and enforces a limit of its own, such as a proxy that passes the body through:

```rust compile
use volga::{App, HttpBody, HttpResponse};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // The upstream decides how much it accepts
    app.map_post("/proxy", |body: HttpBody| async move {
        HttpResponse::builder()
            .status(200)
            .body(body)
    })
    .without_body_limit();

    app.run().await
}
```

::: warning
Without a limit the client decides how much the server reads. Lift it only on a route that counts the bytes itself, or hands them to something that does — never on one that collects the body into memory.
:::

### When the `413` Is Sent

The limit is enforced as the body is read, so a handler that never reads the body is not affected by it. When it does read it:

* **A declared length over the limit is refused before any of the body is read.** If `Content-Length` already says the body won't fit, the first read fails with `413` — even a handler that wanted only the first few bytes gets it. A client that sent `Expect: 100-continue` is answered `413` instead of `100 Continue`, and never uploads the body at all.
* **A body of undeclared length** (chunked) is refused once it has sent more than fits.
* **A refused body fails once and then ends.** The read that goes over the limit returns the `413` error, and every read after it returns the end of the body, so a loop that logs the error and reads on does not spin or pull in the rest of the upload. Return the error with `?` and it reaches the [error handler](/volga-docs/en/reliability-observability/errors.html) as any other error does, with its `413` status.

::: tip
Over HTTP/1 a connection can't be reused while part of a body is left unread, so it is closed after a response like this one. While the client may still be sending, Volga keeps reading and discarding what arrives — for 2 seconds at most, and 500 ms once nothing arrives — so the client gets the `413` rather than a connection reset. A [graceful shutdown](/volga-docs/en/reliability-observability/graceful-shutdown.html) waits for such a connection too. HTTP/2 ends just the stream and keeps the connection.
:::

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
