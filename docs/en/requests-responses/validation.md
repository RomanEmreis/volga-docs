# Validating Requests

Volga parses a payload, but it does not inspect it. Anything past `serde` — a non-empty key, a bounded page
size, a range that has to make sense — used to be rewritten at the top of every handler.

Since **v0.9.9** those rules live in one place: the [`Validate`](https://docs.rs/volga/latest/volga/validation/trait.Validate.html)
trait says what a type considers valid, and the [`Valid<E>`](https://docs.rs/volga/latest/volga/validation/valid/struct.Valid.html)
extractor runs it. `Valid<E>` wraps another extractor, calls `validate()` on what that extractor produced, and
either hands the payload to the handler or turns the failure into a response **before the handler is entered**.

Volga knows none of the rules — it only knows it called the function.

## Quick Start

The `Validate` trait and the `Valid<E>` extractor are always available. The derive macro is behind the
`validation-derive` feature, which is part of `full`:
```toml
[dependencies]
volga = { version = "0.9.9", features = ["validation-derive"] }
```

```rust compile
use volga::{App, ValidJson, ok};
use volga::validation::Validate;
use serde::Deserialize;

#[derive(Deserialize, Validate)]
struct KeyValue {
    #[validate(length(min = 1, message = "key is required"))]
    key: String,

    #[validate(length(max = 4096))]
    value: String,
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_post("/put", async |val: ValidJson<KeyValue>| {
        ok!("{}={}", val.key, val.value)
    });

    app.run().await
}
```
An invalid payload never reaches the handler:
```bash
> curl -X POST "http://127.0.0.1:7878/put" -H "Content-Type: application/json" -d '{"key":"","value":"1"}'
key: key is required
```
The response is `400 Bad Request` by default — see [Choosing the status](#choosing-the-status) to return `422` instead.

## The `Valid<E>` Extractor

[`Valid<E>`](https://docs.rs/volga/latest/volga/validation/valid/struct.Valid.html) wraps an extractor rather than a
payload type. Since `Json`, `Query`, `Form` and `NamedPath` all deref to their payload, one blanket implementation
covers them all, and each has a shorthand alias:

| Shorthand | Expands to | Validates |
|---|---|---|
| [`ValidJson<T>`](https://docs.rs/volga/latest/volga/validation/valid/type.ValidJson.html) | `Valid<Json<T>>` | a JSON body |
| [`ValidQuery<T>`](https://docs.rs/volga/latest/volga/validation/valid/type.ValidQuery.html) | `Valid<Query<T>>` | query string parameters |
| [`ValidForm<T>`](https://docs.rs/volga/latest/volga/validation/valid/type.ValidForm.html) | `Valid<Form<T>>` | a URL-encoded form |
| [`ValidPath<T>`](https://docs.rs/volga/latest/volga/validation/valid/type.ValidPath.html) | `Valid<NamedPath<T>>` | named route parameters |

All four are re-exported from the crate root, so `use volga::ValidJson;` and
`use volga::validation::ValidJson;` are the same import.

::: tip
`ValidPath<T>` is the **named** path extractor, not the positional one: `Path<T>` reads a tuple, and a tuple is not
a type your crate can implement `Validate` for. Use a struct with `Deserialize`, as described in
[Route Params](/volga-docs/en/getting-started/route-params.html).
:::

The wrapper forwards the inner extractor's payload source, so a validated body still reads the body and a validated
query still reads the parts. Both may be validated in the same handler — they short-circuit at the **first failure in
argument order**:
```rust
app.map_post("/items", async |filter: ValidQuery<Filter>, val: ValidJson<KeyValue>| {
    ok!("{}:{}", filter.per_page, val.key)
});
```

`Valid<E>` derefs to the inner extractor, and `into_inner()` unwraps it.

## Rules the Derive Understands

[`#[derive(Validate)]`](https://docs.rs/volga/latest/volga/validation/derive.Validate.html) writes out the same
`validate()` a hand-written impl would, from the bounds declared on the fields. It is not a second way to validate:
the trait stays the seam, so a derived impl and a hand-written one are indistinguishable to `Valid<E>`.

| Rule | Applies to | Example |
|---|---|---|
| `length(min, max, equal)` | strings and collections | `#[validate(length(min = 1, max = 64))]` |
| `range(min, max)` | anything ordered | `#[validate(range(min = 1, max = 100))]` |
| `nested` | a field that validates itself | `#[validate(nested)]` |
| `custom = "path::to::fn"` | anything | `#[validate(custom = "is_supported_sort")]` |
| `rename = ".."` | the name a failure is reported under | `#[validate(rename = "explicit")]` |

`length` and `range` also take an optional `message = ".."` that replaces the default text. Strings are measured in
characters (Unicode scalar values), which is what OpenAPI's `minLength` / `maxLength` count; collections are measured
in elements.

All failures are collected rather than stopping at the first, and every bound and message is rendered at expansion
time, so a failing check pushes a `&'static str` and allocates nothing.

### Custom and cross-field rules

A `custom` function takes a reference to the field and returns `Result<(), ValidationError>`. Because it is called
directly, a check written against `&str` still accepts a `&String` field by deref coercion:
```rust compile
use volga::validation::ValidationError;

fn is_supported_sort(value: &str) -> Result<(), ValidationError> {
    match value {
        "asc" | "desc" => Ok(()),
        other => Err(ValidationError::message(format!("`{other}` is not a sort order"))),
    }
}
```

A rule spanning two fields cannot live on either of them, so the **container** takes
`#[validate(schema = "path::to::fn")]` for those — which is also why the derive is sugar over the trait rather than a
replacement for it:
```rust compile
use serde::Deserialize;
use volga::validation::{Validate, ValidationError};

#[derive(Deserialize, Validate)]
#[validate(schema = "from_is_before_to")]
struct Filter {
    #[validate(range(min = 1, max = 100))]
    per_page: u32,

    from: Option<u32>,
    to: Option<u32>,
}

fn from_is_before_to(filter: &Filter) -> Result<(), ValidationError> {
    if let (Some(from), Some(to)) = (filter.from, filter.to)
        && from > to
    {
        return Err(ValidationError::field("from", "must not be after `to`"));
    }
    Ok(())
}
```
Field rules run first, then the container's `schema` functions.

### Nested types

`nested` merges a child's failures under `parent.child`, and a nested collection under `parent[0].child`.
`Option<T>` and `Vec<T>` wrappers are followed:
```rust compile
use serde::Deserialize;
use volga::validation::Validate;

#[derive(Deserialize, Validate)]
struct Item {
    #[validate(length(min = 1))]
    name: String,
}

#[derive(Deserialize, Validate)]
struct Order {
    #[validate(nested)]
    head: Item,

    #[validate(nested)]
    items: Vec<Item>,

    #[validate(nested)]
    note: Option<Item>,
}
```
An `Order` with an empty `items[1].name` reports exactly that path.

### What the derive refuses

An attribute the derive could only half-honour is refused at compile time rather than half-applied:

* `equal` alongside `min` or `max` — `equal` decides the check on its own, so a bound next to it would be read by nobody.
* A `range` bound that is neither a literal nor a constant. A bound is read once when the route is described and again
  on every request; anything that could answer differently between the two would publish a contract the server does not
  enforce.
* A non-literal `range` bound with no `message = ".."` — there is no text to render into the default message, and
  printing the constant's name rather than its value would tell a client nothing.

A rule that genuinely varies belongs in `custom`.

## Writing `Validate` by Hand

The derive is optional. Implementing the trait directly is the same thing, and it is what a type with rules the derive
does not cover should do:
```rust compile
use volga::validation::{Validate, ValidationError};
use serde::Deserialize;

#[derive(Deserialize)]
struct KeyValue {
    key: String,
    value: String,
}

impl Validate for KeyValue {
    type Error = ValidationError;

    fn validate(&self) -> Result<(), Self::Error> {
        let mut err = ValidationError::new();
        if self.key.is_empty() {
            err.push("key", "key is required");
        }
        if self.value.len() > 4096 {
            err.push("value", "value is too long");
        }
        err.into_result()
    }
}
```

## `ValidationError`

[`ValidationError`](https://docs.rs/volga/latest/volga/validation/struct.ValidationError.html) is what `Validate`
implementations accumulate into.

| Method | What it does |
|---|---|
| `new()` | an empty error to accumulate into |
| `push(field, message)` / `push_message(message)` | add a failure, with or without a field |
| `into_result()` | `Ok(())` when nothing was collected, `Err(self)` otherwise |
| `field(name, message)` / `message(text)` | a single failure, for the fail-fast shape |
| `entries()` | iterate the collected `(Option<&str>, &str)` pairs |
| `merge(other)` / `merge_at(prefix, other)` | fold one error into another, optionally under a prefix |
| `with_status(status)` | override the status this error responds with |
| `is_empty()` / `len()` / `status()` | read the accumulated state |

### Choosing the status

`ValidationError` answers `400 Bad Request`. Parse failures already answer `400`, so the default keeps a malformed
payload and an invalid one indistinguishable in status. A service that prefers `422` says so:
```rust
ValidationError::field("key", "key is required")
    .with_status(StatusCode::UNPROCESSABLE_ENTITY)
```
A status asked for by a merged failure is kept, so `with_status` works from a `schema` or `custom` function exactly as
it does from a hand-written impl.

### Reported names

Failures are reported under the name **the client sent**, not the Rust field name. `#[serde(rename = "..")]` and
`#[serde(rename_all = "..")]` are read off the type, and `#[validate(rename = "..")]` overrides both:
```rust compile
use serde::Deserialize;
use volga::validation::Validate;

#[derive(Deserialize, Validate)]
#[serde(rename_all = "camelCase")]
struct Renamed {
    #[validate(length(min = 1))]
    page_size: String,          // reported as `pageSize`

    #[serde(rename = "sortOrder")]
    #[validate(length(min = 1))]
    sort: String,               // reported as `sortOrder`
}
```
`#[validate(rename)]` renames the **failure only** — a constraint has to stay keyed by the name the schema gives the
property, or the rule would silently drop out of the OpenAPI spec. A `#[serde(flatten)]` field is reported at the level
the client sent it, without the name it carries in Rust.

## Composing with `Option` and `Result`

`Option<Valid<..>>` and `Result<Valid<..>, Error>` compose as they do around any other extractor. The first swallows
the failure, the second is the escape hatch for a handler that wants to shape it itself:
```rust
use volga::{App, ValidJson, error::Error, ok, status};

// `None` when the payload is missing or invalid
app.map_post("/put", async |val: Option<ValidJson<KeyValue>>| match val {
    Some(val) => ok!("{}", val.key),
    None => ok!("none"),
});

// The failure, in the handler's hands
app.map_post("/items", async |val: Result<ValidJson<KeyValue>, Error>| match val {
    Ok(val) => ok!("{}", val.key),
    Err(err) => status!(422, "{err}"),
});
```

## Problem Details

Under the `problem-details` feature a `ValidationError` renders as
[RFC 9457](https://www.rfc-editor.org/rfc/rfc9457) with an `errors` extension mapping each field to the messages it
collected. [`use_problem_details()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.use_problem_details)
picks it up with no extra wiring:
```rust
let mut app = App::new();

app.use_problem_details();

app.map_post("/put", async |val: ValidJson<KeyValue>| {
    ok!("{}={}", val.key, val.value)
});
```
```bash
> curl -X POST "http://127.0.0.1:7878/put" -H "Content-Type: application/json" -d '{"key":"","value":"..."}'
```
```json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.1",
  "title": "Bad Request",
  "status": 400,
  "detail": "key: key is required; value: value is too long",
  "errors": {
    "key": ["key is required"],
    "value": ["value is too long"]
  }
}
```
Failures not bound to a field are grouped under an empty key. See [Global Error Handling](/volga-docs/en/reliability-observability/errors.html)
for the rest of the Problem Details support.

## Using a Third-Party Validator

A validation crate's own error and `volga::error::Error` are both foreign to your crate, so no `From` impl can bridge
them there. [`Invalid<E>`](https://docs.rs/volga/latest/volga/validation/struct.Invalid.html) is the newtype that does
it in one word:
```rust
use volga::validation::{Invalid, Validate};

impl Validate for KeyValue {
    type Error = Invalid<TheirError>;

    fn validate(&self) -> Result<(), Self::Error> {
        self.check().map_err(Invalid)
    }
}
```
This is the whole of Volga's relationship with such crates: no dependency, no feature flag, no blanket impl over anyone
else's trait — just enough room to put one behind a hand-written `Validate`. `Invalid` responds with `400 Bad Request`
and `into_inner()` gives the original error back.

## OpenAPI

The declared rules are published as well as enforced.
[`Validate::constraints()`](https://docs.rs/volga/latest/volga/validation/trait.Validate.html#method.constraints)
reports what the fields declare, and `Valid<E>` forwards it into the OpenAPI description — onto the property of the
request schema, or onto the parameter that same extractor added, never onto one belonging to another handler argument.
Wrapping an extractor therefore does not quietly drop the request body or the query parameters from the spec.

Which keyword a size rule becomes is decided against the schema rather than the spelling of the field, so `minLength`,
`minItems` and `minProperties` each describe what they should even when the type is reached through an alias. A bound
declared twice is published as the intersection, which makes the order the rules were written in irrelevant.

What cannot be published exactly is not published at all rather than rounded: a numeric bound keeps its width and
signedness, a float bound is read at the width it is compared at, and one no JSON number can hold — a 128-bit bound past
`u64::MAX` — is left out. A documented constraint and an enforced one cannot drift apart.

`constraints()` has a default returning nothing, so a hand-written `Validate` is unaffected.

::: tip
Validation runs **after** the payload is extracted. To reject a request before that — on the path, the method or a
header — use a [route filter](/volga-docs/en/middleware-infrastructure/middleware.html) instead.
:::

Here is the [full example](https://github.com/RomanEmreis/volga/blob/main/examples/payload_validation/src/main.rs)
