# Extractors

A handler declares what it needs from the request in its signature, and Volga reads those values before calling it. Each argument type that can be read this way is an **extractor**. If you have used ASP.NET Core minimal APIs, this is model binding; in Go terms, it replaces reading `r.URL.Query()` or decoding `r.Body` by hand.

```rust compile
use serde::Deserialize;
use volga::{App, Json, Query, ok};

#[derive(Deserialize)]
struct Paging {
    page: u32,
}

#[derive(Deserialize)]
struct Item {
    name: String,
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // PUT /lists/7?page=2  with the body {"name": "milk"}
    app.map_put("/lists/{id}", |id: u64, paging: Query<Paging>, item: Json<Item>| {
        ok!("list {id}, page {}: {}", paging.page, item.name)
    });

    app.run().await
}
```

If a value cannot be read (a missing query field, a body that is not valid JSON, a path segment that is not a number), the handler is not called. The request is answered `400 Bad Request` through the [error handler](/volga-docs/en/reliability-observability/errors.html).

`Json<T>`, `Query<T>`, `Form<T>` and `NamedPath<T>` deserialize with [serde](https://serde.rs), so a project using them also depends on `serde` with the `derive` feature.

## What You Can Extract

### From the Path and the Query String

| Type | Reads | Page |
|---|---|---|
| `u32`, `i64`, `String`, `bool`, `PathBuf`, `IpAddr`, … | one path parameter, by position | [Route Parameters](/volga-docs/en/getting-started/route-params.html) |
| `Path<T>` | path parameters by position, into a tuple or a type of your own | [Route Parameters](/volga-docs/en/getting-started/route-params.html#using-path-t) |
| `NamedPath<T>` | path parameters by name, into a struct | [Route Parameters](/volga-docs/en/getting-started/route-params.html#using-namedpath-t) |
| `Query<T>` | the query string, into a struct or a `HashMap` | [Query Parameters](/volga-docs/en/getting-started/query-params.html) |

### From the Body

| Type | Reads | Page |
|---|---|---|
| `Json<T>` | a JSON body | [Handling JSON](/volga-docs/en/requests-responses/json-payload.html) |
| `Vec<T>` | a JSON array, the same as `Json<Vec<T>>` | |
| `Form<T>` | an `application/x-www-form-urlencoded` body | [Form Data](/volga-docs/en/requests-responses/form.html) |
| `File` | the body as an uploaded file | [Working with Files](/volga-docs/en/requests-responses/files.html) |
| `Multipart` | a `multipart/form-data` body (feature `multipart`) | [Working with Files](/volga-docs/en/requests-responses/files.html#multipart-uploading) |
| `HttpBody`, `ByteStream` | the raw body, whole or as a stream | [Raw Request Body](/volga-docs/en/requests-responses/body.html) |
| `HttpRequest` | the whole request: head and body | |

### From the Head of the Request

| Type | Reads | Page |
|---|---|---|
| `Header<T>`, `HttpHeaders` | one header, or all of them | [Headers](/volga-docs/en/requests-responses/headers.html) |
| `Cookies`, `SignedCookies`, `PrivateCookies` | cookies (features `cookie`, `signed-cookie`, `private-cookie`) | [Cookies](/volga-docs/en/requests-responses/cookie.html) |
| `Method`, `Uri` | the request's method and URI | |
| `ClientIp` | the client's address | |
| `Bearer`, `Basic`, `Authenticated<T>` | credentials and verified claims (feature `auth`) | [Authentication](/volga-docs/en/security-access/auth.html) |

### From the Application

| Type | Gives | Page |
|---|---|---|
| `Dc<T>` | a service from the DI container (feature `di`) | [Dependency Injection](/volga-docs/en/advanced-patterns/di.html) |
| `Config<T>` | a section of the configuration file (feature `config`) | [Configuration Files](/volga-docs/en/middleware-infrastructure/config-files.html) |
| `CancellationToken` | a signal that the client has gone | [Request Cancellation](/volga-docs/en/reliability-observability/cancellation.html) |
| `ShutdownHandle` | a way to stop the server from a handler | [Graceful Shutdown](/volga-docs/en/reliability-observability/graceful-shutdown.html) |

A type of your own becomes an extractor through one trait, as described in [Extractors of Your Own](/volga-docs/en/advanced-patterns/custom-extractors.html).

## Optional and Fallible Values

Wrap an extractor in `Option<T>` to receive `None` instead of a `400`, or in `Result<T, Error>` to receive the error and decide yourself:

```rust compile
use serde::Deserialize;
use volga::{App, Query, error::Error, headers::{Header, ContentType}, ok};

#[derive(Deserialize)]
struct Search {
    q: String,
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // GET /search and GET /search?q=rust both reach the handler
    app.map_get("/search", |search: Option<Query<Search>>| match search {
        Some(s) => ok!("searching for {}", s.q),
        None => ok!("nothing to search for"),
    });

    app.map_post("/echo", |ct: Result<Header<ContentType>, Error>| match ct {
        Ok(ct) => ok!("{ct}"),
        Err(err) => ok!("no content type: {err}"),
    });

    app.run().await
}
```

To check the extracted value against rules of your own (a non-empty name, a page size in range), wrap it in `Valid<E>`; see [Validating Requests](/volga-docs/en/requests-responses/validation.html).

## Combining Extractors

A handler may take any number of extractors that read the path, the query string, the head and the application, plus **one** that reads the body. Three combinations fail to compile, with an error that names the rule:

* **Two extractors of the body**, such as `Json<A>` and `Form<B>`. The body is a stream and can be read only once.
* **An argument after `HttpRequest`.** It takes the whole request, so it stands last.
* **Positional parameters next to `Path<T>` or `NamedPath<T>`.** A handler reads its path parameters one way or the other.

More on the rules in [Handlers](/volga-docs/en/getting-started/handlers.html#extractors-that-go-together).
