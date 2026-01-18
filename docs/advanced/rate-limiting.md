# Rate Limiting

Volga provides a built-in, high-performance rate limiting system designed for HTTP APIs and microservices.
It supports multiple algorithms, flexible partition keys, and can be applied globally, per route group, or per route.

This guide demonstrates basic usage using the **Fixed Window** algorithm.

## Enabling Rate Limiting

Rate limiting is an optional feature.

Enable it explicitly in `Cargo.toml`:

```toml
[dependencies]
volga = { version = "...", features = ["rate-limiting"] }
```

Or enable all features:

```toml
[dependencies]
volga = { version = "...", features = ["full"] }
```

## Core Concepts

Before diving into examples, it helps to understand the building blocks:

### Rate Limiting Policy

A **policy** defines:

* the rate limiting algorithm (e.g. fixed window)
* the maximum number of requests
* the window duration
* optional eviction behavior
* an optional name

Policies are configured once at the application level.

### Partition Key

A **partition key** determines how requests are grouped.

Common examples:

* Client IP
* Authenticated user
* API key
* Query or path parameter

Volga provides helpers under `volga::rate_limiting::by`.

### Where Rate Limiting Can Be Applied

Rate limiting middleware can be attached to:

* the entire application (global)
* a route group
* a single route

## Defining a Fixed Window Policy

A fixed window rate limiter allows up to *N requests per time window*.

```rust
use std::time::Duration;
use volga::rate_limiting::FixedWindow;

let fixed_window = FixedWindow::new(100, Duration::from_secs(30));
```

This policy allows **100 requests per 30 seconds**.

### Named Policies

Policies can be named and reused:

```rust
let burst = FixedWindow::new(100, Duration::from_secs(30))
    .with_name("burst");
```

Named policies are useful when different routes require different limits.

## Registering the Policy

Policies are registered on the application:

```rust
use volga::App;

let mut app = App::new()
    .with_fixed_window(burst);
```

At this point, the policy exists but is not yet active.

## Applying Rate Limiting

### Global Rate Limiting

Apply rate limiting to all incoming requests:

```rust
use volga::rate_limiting::by;

app.use_fixed_window(by::ip());
```

This limits all requests based on the client IP.

### Using a Named Policy

To use a specific named policy:

```rust
app.use_fixed_window(by::ip().using("burst"));
```

### Route-Level Rate Limiting

Rate limiting can be applied to individual routes:

```rust
app.map_get("/upload", upload_handler)
    .fixed_window(by::ip());
```

Or with a named policy:

```rust
app.map_get("/upload", upload_handler)
    .fixed_window(by::ip().using("burst"));
```

### Route Group Rate Limiting

Rate limiting can also be applied to a group of routes:

```rust
app.group("/api", |api| {
    api.fixed_window(by::ip());

    api.map_get("/status", status_handler);
    api.map_post("/upload", upload_handler);
});
```

## Partition Key Examples

Volga provides built-in helpers:

```rust
by::ip()                // Client IP address
by::header("x-api-key") // Custom HTTP header
by::query("tenant_id")  // Query parameter
by::path("user_id")     // Path parameter
```

When authentication is enabled:

```rust
by::user(|claims| claims.sub.as_str())
```

You can also combine multiple keys by stacking middleware.

## Other Algorithms

In addition to **Fixed Window**, Volga supports:

* **Sliding Window** – smoother request distribution
* (More algorithms planned)

The usage pattern remains the same:

```rust
.with_sliding_window(...)
.sliding_window(by::ip())
```

Full example can be found [here](https://github.com/RomanEmreis/volga/blob/main/examples/rate_limiting/src/main.rs).