# Static Files

Volga supports serving static files with features such as directory browsing, a configurable index file name, path prefixing, a content root folder, and a special fallback file.

## Prerequisites

### Dependencies

If you're not using the `full` feature set, you need to enable the `static-files` feature in your `Cargo.toml`:

```toml
[dependencies]
volga = { version = "...", features = ["static-files"] }
```

The `static-files` feature implies `middleware`, since middleware is what serves the files.

### Folder Structure

Let's assume we have the following folder structure:

```
project/
│── static/
│   ├── index.html
│   ├── style.css
│   ├── script.js
│── src/
│   ├── main.rs
│── Cargo.toml
```

## Basic Static File Server

After creating `html`, `css`, and `js` files, you can set up a minimal static file server in `main.rs`:

```rust compile
use volga::App;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new()
        .with_host_env(|env| env.with_content_root("/static"));

    // Enables serving static files
    app.use_static_assets();

    app.run().await
}
```

[`with_content_root()`](https://docs.rs/volga/latest/volga/app/struct.HostEnv.html#method.with_content_root) sets the folder the files are served from. The path is used exactly as written, so a **relative** one — `with_content_root("static")` — resolves against the process's working directory, which is what a project laid out like the tree above wants. The default is the literal `/static`.

::: tip
A leading slash makes the path absolute on Unix, so `"/static"` means `/static` at the filesystem root, not `project/static`. Drop it unless that is what you meant. A content root of `/` is reported on startup.
:::

Then [`use_static_assets()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.use_static_assets) answers `GET` and `HEAD` requests from the content root:

- `/` → the index file (`index.html` by default)
- `/{any path}` → the file of that name under the content root, at any depth

::: warning Renamed in 0.10.0
This method used to be called `map_static_assets()`. It no longer maps anything — see [Middleware, not routing](#middleware-not-routing) below — so `map_*`, which in this crate means *a route was registered*, was the wrong prefix for it. Rename the call; nothing else about it changed.
:::

## Middleware, not routing

Since **0.10.0** the static file server is a middleware rather than a set of routes. It reads the request target, answers it from the content root when something is there, and declines otherwise. The router knows nothing about static content.

What follows from that:

* **No startup walk and no depth limit.** The content root is read when a request asks for something, not walked while the server starts, so a directory created while the server is running is served like any other.
* **Nothing is registered in the router.** No route is shadowed by static content, none of it shows up in the route listing printed at startup, and none of it has to be described in an OpenAPI spec. Static files and a dynamic route now coexist: `use_static_assets()` no longer claims the router's dynamic slot, so `app.map_get("/{id}", ..)` works beside it.
* **A file answers before a route does.** The mount is the first thing a `GET` or `HEAD` under it reaches, so a file that exists on disk is served even where a route was mapped for the same path. Any other method, and any path with nothing behind it, reaches routing as before.
* **Position in the pipeline matters** — see below.

A request that nothing under the content root answers goes on to routing, so [`map_fallback_to_file()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_fallback_to_file) still answers it and an SPA shell behaves exactly as it did.

### Where to put the call

Because the mount is middleware, where it sits in the pipeline is where you registered it:

```rust compile
use volga::App;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new()
        .with_cors(|cors| cors.with_any_origin().with_any_header().with_any_method());

    app.use_compression(); // files are compressed
    app.use_cors();        // files carry the CORS headers

    app.use_static_assets();

    // Anything registered below runs only for requests
    // that were not answered from disk
    app.with(|next| async move { next.await });

    app.run().await
}
```

Register the mount **after** [`use_compression()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.use_compression) to have the files compressed, **after** [`use_cors()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.use_cors) to have the headers on them, and **before** anything that should not run for a request answered from disk.

### Path resolution

The request target is resolved from its ordinary path components alone. A `.`, a `..`, an encoded separator (`%2F`) or an embedded NUL is declined rather than dropped or looked up, so traversal is refused by construction. A symlink under the content root that points outside of it — the one case a request target cannot describe — is still caught and answered `403`.

A `%XX` escape is decoded; a malformed one, or one that does not decode to UTF-8, is answered `400`. A `+` in a request target is the literal character, not a space: a request target is not a form body.

## Fallback

To serve a custom fallback file (e.g., `404.html`), use [`map_fallback_to_file()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_fallback_to_file), which internally calls [`map_fallback()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_fallback) to handle unknown paths.

```rust compile
use volga::App;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new()
        .with_host_env(|env| env
            .with_content_root("/static")
            .with_fallback_file("404.html"));

    // Enables serving static files
    app.use_static_assets();

    // Enables fallback to 404.html
    app.map_fallback_to_file();

    app.run().await
}
```

Since fallback files are disabled by default, we explicitly set the `404.html` file using [`with_fallback_file("404.html")`](https://docs.rs/volga/latest/volga/app/struct.HostEnv.html#method.with_fallback_file).

A more concise version of the above code is:

```rust compile
use volga::App;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new()
        .with_host_env(|env| env
            .with_content_root("/static")
            .with_fallback_file("404.html"));

    // Enables serving static files 
    // and fallback to 404.html
    app.use_static_files();

    app.run().await
}
```

The [`use_static_files()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.use_static_files) method combines [`use_static_assets()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.use_static_assets) and [`map_fallback_to_file()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_fallback_to_file). However, the fallback feature is only enabled if a fallback file is specified.

::: tip
You can set [`with_fallback_file("index.html")`](https://docs.rs/volga/latest/volga/app/struct.HostEnv.html#method.with_fallback_file) to always redirect to the main page for unknown routes.
:::

## Serving Under a Prefix

A [route group](/volga-docs/en/getting-started/route-groups.html) keeps the mount to one part of the URL space:

```rust compile
use volga::App;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // Files are served under /static/* only
    app.group("/static", |g| {
        g.use_static_assets();
    });

    // Reached as usual: the mount declines everything outside its prefix
    app.map_get("/{id}", |id: i32| async move { id });

    app.run().await
}
```

The group's middleware — `wrap`, `with`, `filter`, `map_ok`, `authorize`, a rate limiter — wraps the files this mount serves, exactly as it wraps the routes the group registered, nested groups included.

:::warning Two limits of a group mount
* **The prefix must be literal.** `app.group("/{tenant}", |g| g.use_static_files())` does not serve static files and says so at startup: a mount matches the request target as it is written, while a parameter is matched by the router, which knows nothing about the mount. Before 0.10.0 that spelling folded every bound parameter into the filesystem path, which was an accident of the path reassembly that has since been removed.
* **A group's CORS policy does not reach the files.** A policy is resolved from the route that matched, and a file is served without one, so the policy that applies is the application's — configured with [`with_cors()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.with_cors). For the same reason a preflight aimed at a file's path is answered as one for an unmatched path.
:::

## Directory Browsing

Like fallback files, directory browsing is disabled by default. You can enable it using [`with_files_listing()`](https://docs.rs/volga/latest/volga/app/struct.HostEnv.html#method.with_files_listing). However, this is not recommended for production environments — an application that leaves it on in a release build says so on startup.

```rust compile
use volga::App;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new()
        .with_host_env(|env| env
            .with_content_root("/static")
            .with_fallback_file("404.html")
            .with_files_listing());

    // Enables serving static files 
    // and fallback to 404.html
    app.use_static_files();

    app.run().await
}
```

## Caching

Every static file is served with an `ETag`, a `Last-Modified` and a `Cache-Control`, and a conditional request that still matches is answered `304`.

Which policy a file gets is decided by the **role** the name it is addressed by gives it, not by the file itself:

| Role | What it is | `Cache-Control` |
|---|---|---|
| **asset** | every file addressed by a content-hashed name — `assets/index-a1b2c3.js` | `max-age=86400, public, immutable` |
| **shell** | the index file and the fallback file, addressed by a stable name | `no-cache` |

An asset never changes under the same URL, so it is taken on trust and never revalidated. The shell does change under the same URL, so it is revalidated on every navigation — which costs a `304` and no body while it is unchanged, and picks a deploy up on the next request rather than a day later.

::: warning Changed in 0.9.11, without an opt-in
Every static file used to be served `max-age=86400, public, immutable`, the shell included. Since `immutable` tells a browser not to revalidate even on a reload, a user who reloaded after a deploy kept yesterday's `index.html` for up to a day — pointing at asset URLs that no longer existed. `GET /` now answers `no-cache`; assets keep the policy they had.
:::

0.9.11 also fixed conditional requests on static files, all of which sit on the hot path the change above creates:

* The index file and the fallback file ignored `If-None-Match` / `If-Modified-Since` entirely, so `GET /` always answered with a full body.
* `If-Modified-Since` was compared against a nanosecond `mtime`, so a client echoing back the very `Last-Modified` it had been served looked strictly older than the file.
* `If-Modified-Since` was read even when `If-None-Match` was present, which RFC 9110 §13.1.3 forbids.
* Validators were evaluated whatever the request method was, so a conditional `POST` to an unknown path could be answered `304`.
* A `304` carried no `Cache-Control`, so a cache kept serving a file under the policy it was first stored with.

### Configuring the policies

Both roles are configured on [`HostEnv`](https://docs.rs/volga/latest/volga/app/struct.HostEnv.html). The builders receive the policy currently in effect, so narrowing a single directive does not mean restating the rest:

```rust compile
use volga::App;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new()
        .with_host_env(|env| env
            .with_content_root("/static")
            // Assets stay fresh for an hour instead of a day
            .with_asset_cache_control(|cc| cc.with_max_age(60 * 60))
            // The shell is never stored at all
            .with_shell_cache_control(|cc| cc.with_no_store()));

    app.use_static_files();

    app.run().await
}
```

[`with_asset_cache_control()`](https://docs.rs/volga/latest/volga/app/struct.HostEnv.html#method.with_asset_cache_control) and [`with_shell_cache_control()`](https://docs.rs/volga/latest/volga/app/struct.HostEnv.html#method.with_shell_cache_control) were added in **0.9.11**, and are read back with `asset_cache_control()` / `shell_cache_control()`. The two defaults are named by the [`CacheControl::ASSET`](https://docs.rs/volga/latest/volga/headers/cache_control/struct.CacheControl.html#associatedconstant.ASSET) and `CacheControl::SHELL` constants for anyone building a policy from scratch; `CacheControl::EMPTY` is the `const` equivalent of `CacheControl::default()`.

To restore the pre-0.9.11 behaviour on a deployment that wants it:

```rust compile
use volga::App;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new()
        .with_host_env(|env| env
            .with_shell_cache_control(|cc| cc
                .with_max_age(86400)
                .with_public()
                .with_immutable()));

    app.use_static_files();

    app.run().await
}
```

### Where the `ETag` comes from

A tag is derived either from what the filesystem says about a file or from the bytes in it, and the role decides which — a tag that is never read does not need to cost a read:

| Role | Default | Why |
|---|---|---|
| **asset** | [`ETagSource::Metadata`](https://docs.rs/volga/latest/volga/headers/etag/enum.ETagSource.html) | it is served `immutable`, so a client never revalidates it and the tag is never consulted |
| **shell** | [`ETagSource::Content`](https://docs.rs/volga/latest/volga/headers/etag/enum.ETagSource.html) | it is served `no-cache`, so the tag is what decides between a `304` and a full body on every navigation |

`Metadata` hashes the file's byte length and the whole-second part of its `mtime` — what nginx, Apache and ASP.NET Core tag with, and free, because the server has already made that `stat`. `Content` hashes the bytes themselves: identical wherever one build is deployed, different as soon as a single byte is.

::: warning Changed in 0.10.1, without an opt-in
The index and the fallback file used to be tagged from their metadata like everything else, and two versions of a file collide there whenever they have the same length and an `mtime` in the same second. That is the ordinary case for the `index.html` of a content-hashed build: its `<script src="/assets/index-a1b2c3.js">` keeps its byte length across deploys, and a deployment that pins timestamps (`SOURCE_DATE_EPOCH`, `tar -p`, `rsync -t`) keeps the second too — so a client holding the old tag was answered `304` for changed content. The shell is now tagged from its bytes, which makes every client revalidate it once after the upgrade. Asset tags are unchanged.
:::

Both sources are configurable, on the same `HostEnv`:

```rust compile
use volga::{App, headers::ETagSource};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new()
        .with_host_env(|env| env
            // Assets that revalidate rather than being taken on trust,
            // so their tags have to hold
            .with_asset_cache_control(|cc| cc.with_max_age(60))
            .with_asset_etag(ETagSource::Content)
            // Back to the cheaper tag, for a deployment that never
            // rewrites the shell in place
            .with_shell_etag(ETagSource::Metadata));

    app.use_static_files();

    app.run().await
}
```

[`with_asset_etag()`](https://docs.rs/volga/latest/volga/app/struct.HostEnv.html#method.with_asset_etag) and [`with_shell_etag()`](https://docs.rs/volga/latest/volga/app/struct.HostEnv.html#method.with_shell_etag) arrived in **0.10.1** and read back with `asset_etag()` / `shell_etag()`. The pairing to keep in mind is with `Cache-Control`: narrow [`CacheControl::ASSET`](https://docs.rs/volga/latest/volga/headers/cache_control/struct.CacheControl.html#associatedconstant.ASSET) so assets start revalidating, and `ETagSource::Content` is what makes their answers trustworthy.

A content tag costs **one read per file version**, not per request: it is remembered against the file's length and its `mtime` at full precision, plus whatever the platform can say about the file rather than its contents — the inode and change time on Unix, the creation time on Windows. A restart starts from an empty cache, and the cache is bounded, so a content root with a file per user does not grow an entry per file and keep it.

::: tip
The `ETag` is **weak** whatever it is derived from. RFC 9110 §8.8.1 reserves strong validation for octet-equality of the representation that is actually sent, and the compression middleware may re-encode a body after the static file server has set the header.
:::

For a handler attaching one of these policies to a response of its own rather than configuring a server, [`CacheControl::asset()`](https://docs.rs/volga/latest/volga/headers/cache_control/struct.CacheControl.html#method.asset) and `CacheControl::shell()` are the same two defaults as ready `Header<CacheControl>` presets, alongside `no_cache()`, `public()` and the rest.

## Host Environment

For more advanced scenarios, you can use the [`HostEnv`](https://docs.rs/volga/latest/volga/app/struct.HostEnv.html) struct, which represents the application's host environment. Using `HostEnv` directly makes it easier to switch between environments.

Here's how you can achieve the same configuration with `HostEnv`:

```rust compile
use volga::{App, File, app::HostEnv};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let env = HostEnv::new("/static")
        .with_fallback_file("404.html")
        .with_files_listing();

    let mut app = App::new()
        .set_host_env(env);

    // Enables serving static files 
    // and fallback to 404.html
    app.use_static_files();

    // Handles new static file uploads
    app.map_post("/upload", |file: File, env: HostEnv| async move {
        let root = env.content_root();
        file.save(root).await
    });

    app.run().await
}
```

Additionally, [`HostEnv`](https://docs.rs/volga/latest/volga/app/struct.HostEnv.html) can be extracted in middlewares and request handlers.

For a full example, see [this repository](https://github.com/RomanEmreis/volga/blob/main/examples/static_files/src/main.rs).
