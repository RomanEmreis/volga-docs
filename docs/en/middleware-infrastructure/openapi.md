# OpenAPI

Volga describes an application in [OpenAPI 3.0](https://spec.openapis.org/oas/v3.0.3) from what is already written: the route templates, the extractors a handler takes and the types it returns. There are no macros to add and no reflection at runtime; what a route cannot say about itself is added next to it, in code.

## Enabling OpenAPI

If you're not using the `full` feature set, enable the `openapi` feature in your `Cargo.toml`:

```toml
[dependencies]
volga = { version = "...", features = ["openapi"] }
```

## Serving the Document

Configuring the document and serving it are two steps, as everywhere in Volga: [`with_open_api()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.with_open_api) describes it, [`use_open_api()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.use_open_api) maps the endpoints that serve it.

```rust compile
use volga::App;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new()
        .with_open_api(|config| config
            .with_title("Example API")
            .with_version("1.0.0")
            .with_ui());

    app.use_open_api();

    app.map_get("/hello", || "Hello, World!");

    app.run().await
}
```

The document is served at `/openapi.json`, and with [`with_ui()`](https://docs.rs/volga/latest/volga/openapi/struct.OpenApiConfig.html#method.with_ui) a Swagger UI at `/openapi` (moved with `with_ui_path(..)`). The UI page is served with an `ETag` and a `Cache-Control` header.

::: warning
`with_open_api()` alone serves nothing — debug builds say so at startup — and `use_open_api()` without a configuration panics. Nothing is exposed until `use_open_api()` is called, so a build that should not publish its API can leave that call out.
:::

The same settings can come from the [`[openapi]` section](/volga-docs/en/middleware-infrastructure/config-files.html) of a configuration file:

```toml
[openapi]
title = "Example API"
version = "1.0.0"
ui_enabled = true
```

## Describing a Route

The request side of a route is inferred: the path parameters from its template, where a typed segment such as `{age:integer}` gives the parameter its type, and the body and the query from the `Deserialize` types of `Json<T>`, `Form<T>`, `Query<T>` and `NamedPath<T>`, with the rules of a [validated](/volga-docs/en/requests-responses/validation.html#openapi) extractor published on them. A type that is only `Serialize` cannot be inspected the same way, so the responses built from one are named by hand.

Everything else is set with `open_api(..)` on the route, or on a group for every route it holds; a group's settings merge with each route's own.

```rust compile
use serde::{Deserialize, Serialize};
use volga::{App, Json, NamedPath, ok};

#[derive(Default, Deserialize, Serialize)]
struct User {
    name: String,
    age: u64,
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new().with_open_api(|config| config.with_ui());
    app.use_open_api();

    app.group("/users", |api| {
        api.open_api(|cfg| cfg.with_tag("users"));

        api.map_get("/{name}/{age}", |user: NamedPath<User>| ok!(user.into_inner()))
            .open_api(|cfg| cfg
                .with_summary("Echoes a user back")
                .produces_json::<User>(200)
                .produces_no_schema(400));

        api.map_post("/", |user: Json<User>| user)
            .open_api(|cfg| cfg.produces_json_example(201, User {
                name: "John".into(),
                age: 30,
            }));
    });

    app.run().await
}
```

The [`OpenApiRouteConfig`](https://docs.rs/volga/latest/volga/openapi/struct.OpenApiRouteConfig.html) builder covers the rest of an operation:

| Method | Describes |
|---|---|
| `with_summary`, `with_description`, `with_operation_id`, `with_tag` / `with_tags` | the operation itself |
| `produces_json::<T>(status)`, `produces_json_example(status, value)` | a JSON response |
| `produces_text(status)`, `produces_no_schema(status)` | a text response, a response without a body |
| `produces_problem(status)`, `produces_problem_example(status, value)` | an `application/problem+json` response |
| `produces_form::<T>(status)`, `produces_multipart(status)`, `produces_stream(status)`, `produces_sse(status)` | the other response kinds |
| `consumes_json::<T>()`, `consumes_form::<T>()`, `consumes_query::<T>()`, `consumes_multipart()`, `consumes_stream()` | an input no extractor names |
| `with_request_schema(schema)`, `with_query_schema(schema)`, `with_response_schema(status, schema)` | anything, [by hand](#describing-a-type-by-hand) |

A handler returning `Result<T, E>` is described with the responses of both `T` and `E`: an error type says what it answers with through [`IntoError::describe_openapi()`](/volga-docs/en/reliability-observability/errors.html#describing-errors-in-openapi).

## Several Documents

An API with versions can publish one document per version. Each spec is served at `/{name}/openapi.json`, and a route or a group is bound to the documents it belongs to with `with_doc(..)` / `with_docs(..)`; a route bound to none is described in the first one.

```rust compile
use volga::App;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new().with_open_api(|config| config
        .with_specs(["v1", "v2"])
        .with_ui());

    app.use_open_api();

    // Only in /v1/openapi.json
    app.map_get("/users", || "users");

    // In both documents
    app.group("/health", |api| {
        api.open_api(|cfg| cfg.with_docs(["v1", "v2"]));
        api.map_get("/", || "ok");
    });

    // Only in /v2/openapi.json
    app.map_post("/users", || "created")
        .open_api(|cfg| cfg.with_doc("v2"));

    app.run().await
}
```

## Describing a Type by Hand

serde reads a struct with a `#[serde(flatten)]` field as a map, so that it can collect the keys the struct does not name — and a map does not say which keys it takes. None of such a struct's fields can be inferred, including the ones declared beside the flattened member: a `Json<T>` or `Form<T>` body is described as an object without properties (or as any value, when the struct sits inside it, as in a `Vec`), and a `Query<T>` describes no parameters at all.

Since **0.11.2** debug builds name each such input at startup. Describe it by hand with an [`OpenApiSchema`](https://docs.rs/volga/latest/volga/openapi/struct.OpenApiSchema.html) — [`with_request_schema()`](https://docs.rs/volga/latest/volga/openapi/struct.OpenApiRouteConfig.html#method.with_request_schema) for a body, [`with_query_schema()`](https://docs.rs/volga/latest/volga/openapi/struct.OpenApiRouteConfig.html#method.with_query_schema) for the query, which describes one parameter per property, required as the schema's `required` list says:

```rust compile
use std::collections::HashMap;
use serde::Deserialize;
use volga::{App, Json, Query, openapi::OpenApiSchema};

#[derive(Deserialize)]
struct Search {
    name: String,
    page: u32,
    // Every other key: this is what makes serde read `Search` as a map
    #[serde(flatten)]
    filters: HashMap<String, String>,
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new().with_open_api(|config| config.with_ui());
    app.use_open_api();

    let schema = OpenApiSchema::object()
        .with_property("name", OpenApiSchema::string())
        .with_property("page", OpenApiSchema::integer())
        .with_required(["name", "page"]);

    app.map_post("/search", |search: Json<Search>| search.name.clone())
        .open_api(|cfg| cfg.with_request_schema(schema.clone()));

    app.map_get("/search", |search: Query<Search>| search.name.clone())
        .open_api(|cfg| cfg.with_query_schema(schema));

    app.run().await
}
```

A parameter already described under the same name is replaced, and describing an input by hand takes it off [`undescribed_inputs()`](https://docs.rs/volga/latest/volga/openapi/struct.OpenApiRouteConfig.html#method.undescribed_inputs) — the list the startup report is made from. Real maps, such as a `HashMap<String, T>` body, are not reported.

Path parameters are always named by the route template, whatever the extractor describes, so their types are spelled there: `{id:integer}`.

## Routes Naming One Position Differently

OpenAPI 3.0 allows one templated path per position. `GET /users/{id}` beside `POST /users/{name}` is described under a single path, named the way most of the routes there are written, and debug builds report each route whose parameters were renamed — see [Parameter Names Are Per-Route](/volga-docs/en/getting-started/route-params.html#in-the-openapi-document).

::: tip Where the startup report goes
The reports above are made by debug builds only. With the `tracing` feature on — and `full` turns it on — they are emitted as `WARN` events, so they show up only once a [tracing subscriber](/volga-docs/en/reliability-observability/tracing.html) is installed; without that feature they are printed to stderr.
:::

For a complete example, see the [OpenAPI example](https://github.com/RomanEmreis/volga/blob/main/examples/open_api/src/main.rs).
