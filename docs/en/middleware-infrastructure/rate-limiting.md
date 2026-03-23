# Rate Limiting

Volga ships with a high-performance rate limiting system for HTTP APIs and microservices.
It offers four algorithms out of the box, flexible partition keys, pluggable storage backends, and can be scoped globally, per route group, or per individual route.

This guide walks through the basics using the **Token Bucket** algorithm — a good default choice that allows controlled bursts while enforcing a steady average rate.

## Enabling Rate Limiting

Rate limiting is an optional feature. Enable it in `Cargo.toml`:

```toml
[dependencies]
volga = { version = "...", features = ["rate-limiting"] }
```

Or enable all features at once:

```toml
[dependencies]
volga = { version = "...", features = ["full"] }
```

## Core Concepts

### Policy

A **policy** describes the rate limiting behavior:

* Algorithm (e.g. token bucket, fixed window)
* Limit parameters (capacity, refill rate, window size, etc.)
* Optional eviction period for cleaning up inactive client state
* Optional name — useful when different routes need different limits

Policies are configured once at the application level.

### Partition Key

A **partition key** determines how requests are grouped for counting purposes.

Common examples:

* Client IP address
* HTTP header (e.g. `x-api-key`)
* Authenticated user identity
* Query or path parameter

Volga provides ready-made helpers under `volga::rate_limiting::by`.

### Application Scope

Rate limiting middleware can be attached at three levels:

* **Global** — all incoming requests
* **Route group** — a set of routes sharing a prefix
* **Individual route** — a single endpoint

## Defining a Token Bucket Policy

A token bucket starts full (up to `capacity` tokens) and refills at a constant rate. Each request consumes one token. When the bucket is empty, requests are rejected until tokens are replenished.

```rust
use volga::rate_limiting::TokenBucket;

let bucket = TokenBucket::new(10, 5.0);
```

This creates a bucket with a **capacity of 10 tokens** and a **refill rate of 5 tokens per second** — allowing short bursts of up to 10 requests while sustaining an average of 5 req/s.

### Named Policies

When different parts of your API need different limits, give each policy a name:

```rust
let standard = TokenBucket::new(10, 5.0)
    .with_name("standard");

let premium = TokenBucket::new(100, 50.0)
    .with_name("premium");
```

### Eviction

By default, inactive client state is cleaned up after 60 seconds. You can adjust this:

```rust
use std::time::Duration;

let bucket = TokenBucket::new(10, 5.0)
    .with_eviction(Duration::from_secs(300));
```

## Registering Policies

Register policies on the application before applying them:

```rust
use volga::App;

let mut app = App::new()
    .with_token_bucket(standard)
    .with_token_bucket(premium);
```

At this point, the policies exist but are **not yet active** — you still need to apply them to routes.

## Applying Rate Limiting

### Global

Apply rate limiting to all incoming requests:

```rust
use volga::rate_limiting::by;

app.use_token_bucket(by::ip());
```

This limits every client by their IP address using the default (unnamed) token bucket policy.

### Using a Named Policy

```rust
app.use_token_bucket(by::ip().using("standard"));
```

### Per Route

```rust
app.map_get("/upload", upload_handler)
    .token_bucket(by::ip());
```

Or with a named policy:

```rust
app.map_get("/upload", upload_handler)
    .token_bucket(by::ip().using("premium"));
```

### Per Route Group

```rust
app.group("/api", |api| {
    api.token_bucket(by::header("x-api-key").using("standard"));

    api.map_get("/status", status_handler);
    api.map_post("/upload", upload_handler);
});
```

## Partition Key Helpers

Volga provides built-in extractors for common partition keys:

```rust
by::ip()                // Client IP address
by::header("x-api-key") // Value of an HTTP header
by::query("tenant_id")  // Query string parameter
by::path("user_id")     // Path parameter
```

When authentication is enabled:

```rust
by::user(|claims| claims.sub.as_str())
```

You can also layer multiple rate limiters with different keys by stacking middleware.

## Other Algorithms

In addition to **Token Bucket**, Volga supports three other algorithms:

| Algorithm | Best for | Method pattern |
|---|---|---|
| **Fixed Window** | Simple request counting per time window | `.with_fixed_window()` / `.fixed_window()` |
| **Sliding Window** | Smoother distribution without boundary spikes | `.with_sliding_window()` / `.sliding_window()` |
| **GCRA** | Precise pacing with configurable burst tolerance | `.with_gcra()` / `.gcra()` |

Each algorithm follows the same registration and application pattern. For example, with Fixed Window:

```rust
use std::time::Duration;
use volga::rate_limiting::FixedWindow;

let mut app = App::new()
    .with_fixed_window(FixedWindow::new(100, Duration::from_secs(30)));

app.use_fixed_window(by::ip());
```

## Pluggable Storage Backends

By default, all algorithms use an in-memory store backed by a concurrent hash map (`DashMap`). This works great for single-instance deployments.

For distributed scenarios (e.g. multiple instances behind a load balancer), you can implement a custom store — such as one backed by Redis — by implementing the corresponding store trait:

| Algorithm | Store trait |
|---|---|
| Token Bucket | `TokenBucketStore` |
| Fixed Window | `FixedWindowStore` |
| Sliding Window | `SlidingWindowStore` |
| GCRA | `GcraStore` |

Store traits are defined in the `volga_rate_limiter` crate and each requires a single atomic operation:

```rust
use volga_rate_limiter::TokenBucketStore;
use volga_rate_limiter::store::TokenBucketParams;

struct MyRedisStore { /* ... */ }

impl TokenBucketStore for MyRedisStore {
    fn try_consume(&self, params: TokenBucketParams) -> bool {
        let key = params.key;
        let capacity = params.capacity_scaled;
        // ... your Redis logic here
        true
    }
}
```

Then create the rate limiter with your custom store:

```rust
use volga_rate_limiter::TokenBucketRateLimiter;

let limiter = TokenBucketRateLimiter::with_store(10, 5.0, MyRedisStore::new());
```

:::tip
Backends with built-in TTL support (like Redis) can skip the manual eviction step — the algorithm's eviction grace parameters are there for in-memory stores that do lazy cleanup.
:::

## Full Example

A complete working example with all four algorithms can be found [here](https://github.com/RomanEmreis/volga/blob/main/examples/rate_limiting/src/main.rs).
