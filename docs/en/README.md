---
home: true
title: Volga
heroText: Volga
tagline: Fast, async-first web framework for Rust built on tokio + hyper.
actions:
  - text: Get Started
    link: /en/getting-started/quick-start.html
    type: primary
  - text: View API Docs
    link: https://docs.rs/volga/latest/volga/
    type: secondary
features:
  - title: Productive by default
    details: Minimal setup, clear routing, and an ergonomic handler API that keeps your focus on the business logic.
  - title: Batteries included
    details: Built-in DI, rate limiting, middleware, tracing, CORS, static files, and more.
  - title: Type-safe extractors
    details: Read JSON, query params, headers, cookies, or files with composable, strongly typed extractors.
footer: MIT Licensed • Built for performance
---

## Build APIs that scale with confidence

Volga ships with performance-friendly primitives and modern developer ergonomics. From routing to middleware and advanced infrastructure features, you can scale from a single endpoint to a full microservice surface without rewriting core pieces.

## Examples that hook developers fast

### Extractors that keep handlers clean

```rust
use volga::{App, Json, ok};
use serde::Deserialize;

#[derive(Deserialize)]
struct User {
    name: String,
    age: i32,
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_post("/hello", |user: Json<User>| async move {
        ok!("Hello {}!", user.name)
    });

    app.run().await
}
```

### Dependency Injection that feels native

```rust
use volga::{App, di::Dc, ok, not_found};
use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
};

#[derive(Clone, Default)]
struct InMemoryCache {
    inner: Arc<Mutex<HashMap<String, String>>>,
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();
    app.add_singleton(InMemoryCache::default());

    app.map_get("/user/{id}", |id: String, cache: Dc<InMemoryCache>| async move {
        let user = cache.inner.lock().unwrap().get(&id);
        match user {
            Some(user) => ok!(user),
            None => not_found!("User not found"),
        }
    });

    app.run().await
}
```

### Rate Limiting with named policies

```rust
use volga::{App, rate_limiting::{by, TokenBucket}};

let burst = TokenBucket::new(2, 0.5).with_name("burst");
let mut app = App::new()
  .with_token_bucket(burst);

app.map_get("/upload", upload_handler)
    .token_bucket(by::ip().using("burst"));
```

## Explore the docs

- [Quick Start](/volga-docs/en/getting-started/quick-start.html)
- [Dependency Injection](/volga-docs/en/advanced-patterns/di.html)
- [Rate Limiting](/volga-docs/en/middleware-infrastructure/rate-limiting.html)
- [Handling JSON](/volga-docs/en/requests-responses/json-payload.html)
