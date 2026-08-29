# Validating extracted data (0.9.9+)

Two pieces, both unconditional — no feature, no dependency:

* `volga::validation::Validate` — the trait a payload type implements to say
  what it considers valid.
* `volga::validation::Valid<E>` — the extractor that runs it. It wraps
  **another extractor**, calls `validate()` on what that extractor produced,
  and turns a failure into a response *before the handler is entered*.

Only `#[derive(Validate)]` is gated, behind `validation-derive` (in `full`).

## The shorthands

| Alias | Is | Validates |
|---|---|---|
| `ValidJson<T>` | `Valid<Json<T>>` | a JSON body |
| `ValidQuery<T>` | `Valid<Query<T>>` | query parameters |
| `ValidForm<T>` | `Valid<Form<T>>` | a URL-encoded form |
| `ValidPath<T>` | `Valid<NamedPath<T>>` | named route parameters |

All four are at the crate root as well as in `volga::validation`. They work
because `Json`, `Query`, `Form` and `NamedPath` deref to their payload, so one
blanket impl covers them; `Valid<E>` derefs to `E`, so field access still works
without unwrapping.

`ValidPath` is the **named** path extractor. `Path<T>` reads a tuple, and a
downstream crate cannot implement `Validate` for a tuple — reaching for
`Valid<Path<..>>` is the predictable slip.

```rust
use serde::Deserialize;
use volga::{App, ValidJson, ok};
use volga::validation::Validate;

#[derive(Deserialize, Validate)]
struct KeyValue {
    #[validate(length(min = 1, message = "key is required"))]
    key: String,
    #[validate(length(max = 4096))]
    value: String,
}

app.map_post("/put", async |val: ValidJson<KeyValue>| {
    ok!("{}={}", val.key, val.value)     // only reached when it validated
});
```

The wrapper forwards the inner extractor's payload source, so a validated body
still reads the body and a validated query still reads the parts. Two of them in
one handler is fine — they short-circuit at the **first failure in argument
order**.

## Derive rules

| On a field | Means |
|---|---|
| `length(min, max, equal)` | strings (in `char`s) and collections (in elements) |
| `range(min, max)` | anything ordered |
| `nested` | the field validates itself; `Option<T>` and `Vec<T>` are followed |
| `custom = "path::to::fn"` | `fn(&Field) -> Result<(), ValidationError>` |
| `rename = ".."` | the name the **failure** is reported under |

| On the container | Means |
|---|---|
| `schema = "path::to::fn"` | `fn(&Self) -> Result<(), ValidationError>` — a rule spanning two fields |

`length` and `range` take an optional `message = ".."`. `custom` does not — its
message is whatever error it returns. Field rules run first, then `schema`. All
failures are collected, not stopped at the first, and every bound and message is
rendered at expansion time, so a failing check allocates nothing.

```rust
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

`nested` merges a child's failures under `parent.child`, a collection's under
`parent[0].child`.

### What the derive refuses at compile time

Never half-applied — each of these is a hard error:

* `equal` next to `min` or `max` in one `length` — `equal` decides the check alone.
* A `range` bound that is neither a literal nor a constant. A bound is read once
  when the route is described and again per request; anything that could answer
  differently would publish a contract the server does not enforce.
* A non-literal `range` bound with no `message = ".."` — there is no value to
  render into the default text, and naming the constant tells a client nothing.

A rule that genuinely varies goes in `custom`.

## `ValidationError`

`400 Bad Request` by default. Parse failures are already `400`, so a malformed
payload and an invalid one are indistinguishable in status unless you say
otherwise.

| Method | Does |
|---|---|
| `new()` + `push(field, msg)` / `push_message(msg)` + `into_result()` | collect everything |
| `field(name, msg)` / `message(msg)` | one failure, fail-fast |
| `entries()` | read back `(Option<&str>, &str)` |
| `merge(other)` / `merge_at(prefix, other)` | fold one into another |
| `with_status(status)` | answer `422` (or anything) instead |
| `is_empty()` / `len()` / `status()` | state |

A status asked for by a merged failure survives the merge, so `with_status`
works from a `schema` or `custom` fn as it does from a hand-written impl.

Hand-written is the same thing — the trait is the seam, and `Valid<E>` cannot
tell a derived impl from a written one:

```rust
use serde::Deserialize;
use volga::validation::{Validate, ValidationError};

#[derive(Deserialize)]
struct KeyValue { key: String, value: String }

impl Validate for KeyValue {
    type Error = ValidationError;

    fn validate(&self) -> Result<(), Self::Error> {
        let mut err = ValidationError::new();
        if self.key.is_empty() { err.push("key", "key is required"); }
        if self.value.len() > 4096 { err.push("value", "value is too long"); }
        err.into_result()
    }
}
```

## Reported names

Failures carry the name **the client sent**: `#[serde(rename)]` and
`#[serde(rename_all)]` are read off the type, `#[validate(rename = "..")]`
overrides both. That override moves the *failure* only — a constraint stays
keyed by the name the schema gives the property, or the rule silently drops out
of the OpenAPI spec. A `#[serde(flatten)]` field is reported at the level the
client sent it.

## Composing

<!-- snippet: skip -->
```rust
use volga::{ValidJson, error::Error, ok, status};

// invalid or missing -> None
app.map_post("/a", async |val: Option<ValidJson<KeyValue>>| match val {
    Some(val) => ok!("{}", val.key),
    None => ok!("none"),
});

// the failure, in the handler's hands
app.map_post("/b", async |val: Result<ValidJson<KeyValue>, Error>| match val {
    Ok(val) => ok!("{}", val.key),
    Err(err) => status!(422, "{err}"),
});
```

## Problem Details

Under `problem-details`, `app.use_problem_details()` renders a `ValidationError`
as RFC 9457 with an `errors` extension mapping each field to its messages;
field-less failures land under an empty key. No extra wiring.

```json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.1",
  "title": "Bad Request",
  "status": 400,
  "detail": "key: key is required; value: value is too long",
  "errors": { "key": ["key is required"], "value": ["value is too long"] }
}
```

## A third-party validator

A validation crate's error and `volga::error::Error` are both foreign to the
user crate, so no `From` impl can bridge them there. `Invalid<E>` is the newtype
that does — that is the whole relationship: no dependency, no feature, no
blanket impl over anyone else's trait.

<!-- snippet: skip -->
```rust
use volga::validation::{Invalid, Validate};

impl Validate for KeyValue {
    type Error = Invalid<TheirError>;

    fn validate(&self) -> Result<(), Self::Error> {
        self.check().map_err(Invalid)     // `Invalid` answers 400; `into_inner()` gives it back
    }
}
```

## OpenAPI

`Validate::constraints()` reports what the fields declare and `Valid<E>`
forwards it into the description — onto the property of the request schema, or
onto the parameter that same extractor added, never onto another argument's.
Wrapping an extractor therefore does not drop the body or the query parameters
from the spec.

Which keyword a size rule becomes is decided against the schema, not the
spelling of the field, so `minLength` / `minItems` / `minProperties` each land
where they belong. A bound declared twice publishes as the intersection. What
cannot be published exactly is left out rather than rounded — a documented
constraint and an enforced one cannot drift apart. The method defaults to empty,
so a hand-written impl is unaffected.

## Not to be confused with

`filter` (see `references/middleware.md`) rejects a request *before* extraction,
on the path, method or headers, and answers `404` when it returns `false`.
`Valid<E>` runs after extraction and answers `400`.
