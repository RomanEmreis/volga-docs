# Multipart Responses

Starting from `0.9.2`, [`Multipart`](https://docs.rs/volga/latest/volga/http/endpoints/args/multipart/struct.Multipart.html) in Volga is bidirectional: in addition to acting as a request extractor (see [Working with Files](./files.md)), it implements [`IntoResponse`](https://docs.rs/volga/latest/volga/http/response/into_response/trait.IntoResponse.html) and can be returned from handlers to produce a `multipart/*` response.

This is useful for:
* Returning multiple related blobs in a single response (form-data style).
* Serving partial content for HTTP `Range` requests as `multipart/byteranges`.
* Returning a heterogeneous bundle of parts as `multipart/mixed`.
* Proxying or forwarding an incoming multipart back to a client.

Like the request side, multipart responses are gated by the `multipart` feature. If you're not using the `full` feature set, enable it explicitly in your `Cargo.toml`:
```toml
[dependencies]
volga = { version = "...", features = ["multipart"] }
```

## Returning a Multipart Response

The simplest way to build an outgoing multipart is [`Multipart::from_parts`](https://docs.rs/volga/latest/volga/http/endpoints/args/multipart/struct.Multipart.html#method.from_parts), which accepts any `IntoIterator<Item = Part>`:
```rust
use volga::{App, Multipart, multipart::Part};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // GET /form
    app.map_get("/form", || async {
        Multipart::from_parts([
            Part::text("greeting", "hello"),
            Part::text("name", "world"),
        ])
    });

    app.run().await
}
```

The response gets a `Content-Type: multipart/form-data; boundary=...` header with an auto-generated boundary, and each [`Part`](https://docs.rs/volga/latest/volga/http/endpoints/args/multipart/struct.Part.html) is encoded with its own `Content-Disposition` and (where applicable) `Content-Type` headers.

## Building Parts

[`Part`](https://docs.rs/volga/latest/volga/http/endpoints/args/multipart/struct.Part.html) provides a small builder API for the common cases:

| Method | Use it for |
| --- | --- |
| [`Part::text(name, value)`](https://docs.rs/volga/latest/volga/http/endpoints/args/multipart/struct.Part.html#method.text) | A simple `text/plain; charset=utf-8` field. |
| [`Part::bytes(name, bytes)`](https://docs.rs/volga/latest/volga/http/endpoints/args/multipart/struct.Part.html#method.bytes) | A binary field with `application/octet-stream`. |
| [`Part::file(name, filename, bytes)`](https://docs.rs/volga/latest/volga/http/endpoints/args/multipart/struct.Part.html#method.file) | An in-memory file. `Content-Type` is auto-inferred from the filename via `mime_guess`. |
| [`Part::stream(name, filename, ct, stream)`](https://docs.rs/volga/latest/volga/http/endpoints/args/multipart/struct.Part.html#method.stream) | A streaming-body file part — the body is sent lazily, chunk by chunk. |
| [`Part::new(body)`](https://docs.rs/volga/latest/volga/http/endpoints/args/multipart/struct.Part.html#method.new) | A bare part with no `Content-Disposition`; use the `with_*` builders to attach headers. |

Each builder has a fallible `try_*` counterpart (`try_text`, `try_bytes`, `try_file`, `try_stream`, `try_with_disposition`) — the static-input constructors panic on invalid header bytes, and the `try_*` variants should be preferred when the name or filename comes from untrusted input.

A typical mixed example combining a text field and an in-memory file:
```rust
use bytes::Bytes;
use volga::{App, Multipart, multipart::Part};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/report", || async {
        Multipart::from_parts([
            Part::text("greeting", "hello"),
            Part::file("logo", "logo.bin", Bytes::from_static(b"\x01\x02\x03")),
        ])
    });

    app.run().await
}
```

## Streaming Parts

When a part's body is large or produced incrementally, use [`Part::stream`](https://docs.rs/volga/latest/volga/http/endpoints/args/multipart/struct.Part.html#method.stream) to send it without buffering. The body must be a `Stream<Item = Result<Bytes, volga::error::Error>>`:
```rust
use bytes::Bytes;
use futures_util::{StreamExt, stream};
use volga::{App, Multipart, multipart::Part};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/stream", || async {
        let chunks = stream::iter([
            Bytes::from_static(b"alpha-"),
            Bytes::from_static(b"beta-"),
            Bytes::from_static(b"gamma"),
        ])
        .map(Ok::<_, volga::error::Error>);

        let part = Part::stream(
            "log",
            "log.txt",
            volga::headers::ContentType::text_utf_8(),
            chunks,
        );
        Multipart::from_parts([part])
    });

    app.run().await
}
```

If the parts themselves are produced lazily (e.g. enumerating files, computing byte ranges on demand), use [`Multipart::from_stream`](https://docs.rs/volga/latest/volga/http/endpoints/args/multipart/struct.Multipart.html#method.from_stream) — it accepts any `Stream<Item = Part>` and emits each part as the stream yields it.

## Choosing a Subtype

By default, outgoing multiparts use the `multipart/form-data` subtype. To switch to `mixed`, `byteranges`, or any other RFC 2046 subtype, call [`Multipart::with_subtype`](https://docs.rs/volga/latest/volga/http/endpoints/args/multipart/struct.Multipart.html#method.with_subtype):
```rust
use bytes::Bytes;
use volga::{App, Multipart, multipart::{MultipartSubtype, Part}};
use volga::headers::{ContentType, HeaderName, HeaderValue};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/ranges", || async {
        let part1 = Part::new(b"first" as &[u8])
            .with_content_type(ContentType::text_utf_8())
            .with_header_raw(
                HeaderName::from_static("content-range"),
                HeaderValue::from_static("bytes 0-4/10"),
            );
        let part2 = Part::new(b"five!" as &[u8])
            .with_content_type(ContentType::text_utf_8())
            .with_header_raw(
                HeaderName::from_static("content-range"),
                HeaderValue::from_static("bytes 5-9/10"),
            );

        Multipart::from_parts([part1, part2])
            .with_subtype(MultipartSubtype::ByteRanges)
    });

    app.run().await
}
```

The supported variants are:
* [`MultipartSubtype::FormData`](https://docs.rs/volga/latest/volga/http/endpoints/args/multipart/enum.MultipartSubtype.html#variant.FormData) — the default; canonical form / file upload subtype.
* [`MultipartSubtype::Mixed`](https://docs.rs/volga/latest/volga/http/endpoints/args/multipart/enum.MultipartSubtype.html#variant.Mixed) — heterogeneous parts.
* [`MultipartSubtype::ByteRanges`](https://docs.rs/volga/latest/volga/http/endpoints/args/multipart/enum.MultipartSubtype.html#variant.ByteRanges) — partial-content responses for HTTP `Range` requests.
* [`MultipartSubtype::Custom(s)`](https://docs.rs/volga/latest/volga/http/endpoints/args/multipart/enum.MultipartSubtype.html#variant.Custom) — any other subtype, e.g. `alternative`, `related`.

## Customizing the Boundary

The boundary is generated automatically and is RFC 2046 §5.1.1 compliant. To pin it (useful in tests or when interoperating with a strict client), use [`Multipart::with_boundary`](https://docs.rs/volga/latest/volga/http/endpoints/args/multipart/struct.Multipart.html#method.with_boundary). It validates the input and returns an error if the boundary is malformed:
```rust
use volga::{App, Multipart, multipart::Part};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/fixed", || async {
        Multipart::from_parts([Part::text("k", "v")])
            .with_boundary("MY-FIXED-BOUNDARY")
    });

    app.run().await
}
```

## Forwarding an Incoming Multipart

When you need to proxy or forward an incoming multipart body back to a client, use [`Multipart::into_outgoing`](https://docs.rs/volga/latest/volga/http/endpoints/args/multipart/struct.Multipart.html#method.into_outgoing). It re-encodes the request multipart as a streaming outgoing one — each field becomes a `Part` with a streaming body:
```rust
use volga::{App, Multipart};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // POST /echo — re-emits the incoming multipart back to the caller
    app.map_post("/echo", |multipart: Multipart| async move {
        multipart.into_outgoing()
    });

    app.run().await
}
```

> Note: `into_outgoing` is **not byte-perfect** — the boundary is regenerated and header ordering may differ. For byte-perfect passthrough, skip the `Multipart` extractor and forward the raw [`HttpBody`](https://docs.rs/volga/latest/volga/http/body/struct.HttpBody.html).

Volga also accepts any `multipart/*` subtype on the request side (not only `multipart/form-data`), so forwarding `multipart/byteranges`, `multipart/mixed`, etc. works out of the box.

## OpenAPI

If you're using OpenAPI integration, [`OpenApiRouteConfig::produces_multipart(status)`](https://docs.rs/volga/latest/volga/struct.OpenApiRouteConfig.html#method.produces_multipart) describes a `multipart/form-data` response for a given status code in the generated spec.

A robust runnable example is available [here](https://github.com/RomanEmreis/volga/blob/main/examples/multipart/src/main.rs).
