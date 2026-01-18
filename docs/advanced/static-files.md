# Static Files

Volga supports serving static files with features such as directory browsing, a configurable index file name, path prefixing, a content root folder, and a special fallback file.

## Prerequisites

### Dependencies

If you're not using the `full` feature set, you need to enable the `static-files` feature in your `Cargo.toml`:

```toml
[dependencies]
volga = { version = "...", features = ["static-files"] }
```

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

```rust
use volga::App;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new()
        .with_host_env(|env| env.with_content_root("/static"));

    // Enables routing to static files
    app.map_static_assets();

    app.run().await
}
```

By default, the content root folder is set to the project root (`project/`). Calling [`with_content_root("/static")`](https://docs.rs/volga/latest/volga/app/env/struct.HostEnv.html#method.with_content_root) reconfigures it to `project/static/`.

Next, calling [`map_static_assets()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_static_assets) automatically maps all necessary `GET` and `HEAD` routes:

- `/` → `/index.html`
- `/{path}` → `/any_file_or_folder_in_the_root`

If you have subfolders inside the content root, routes to their contents will also be mapped.

## Fallback

To serve a custom fallback file (e.g., `404.html`), use [`map_fallback_to_file()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_fallback_to_file), which internally calls [`map_fallback()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_fallback) to handle unknown paths.

```rust
use volga::App;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new()
        .with_host_env(|env| env
            .with_content_root("/static")
            .with_fallback_file("404.html"));

    // Enables routing to static files
    app.map_static_assets();

    // Enables fallback to 404.html
    app.map_fallback_to_file();

    app.run().await
}
```

Since fallback files are disabled by default, we explicitly set the `404.html` file using [`with_fallback_file("404.html")`](https://docs.rs/volga/latest/volga/app/env/struct.HostEnv.html#method.with_fallback_file).

A more concise version of the above code is:

```rust
use volga::App;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new()
        .with_host_env(|env| env
            .with_content_root("/static")
            .with_fallback_file("404.html"));

    // Enables routing to static files 
    // and fallback to 404.html
    app.use_static_files();

    app.run().await
}
```

The [`use_static_files()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.use_static_files) method combines [`map_static_assets()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_static_assets) and [`map_fallback_to_file()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_fallback_to_file). However, the fallback feature is only enabled if a fallback file is specified.

::: tip
You can set [`with_fallback_file("index.html")`](https://docs.rs/volga/latest/volga/app/env/struct.HostEnv.html#method.with_fallback_file) to always redirect to the main page for unknown routes.
:::

## Directory Browsing

Like fallback files, directory browsing is disabled by default. You can enable it using [`with_files_listing()`](https://docs.rs/volga/latest/volga/app/env/struct.HostEnv.html#method.with_files_listing). However, this is not recommended for production environments.

```rust
use volga::App;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new()
        .with_host_env(|env| env
            .with_content_root("/static")
            .with_fallback_file("404.html")
            .with_files_listing());

    // Enables routing to static files 
    // and fallback to 404.html
    app.use_static_files();

    app.run().await
}
```

## Host Environment

For more advanced scenarios, you can use the [`HostEnv`](https://docs.rs/volga/latest/volga/app/env/struct.HostEnv.html) struct, which represents the application's host environment. Using `HostEnv` directly makes it easier to switch between environments.

Here’s how you can achieve the same configuration with `HostEnv`:

```rust
use volga::{App, File, app::HostEnv};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let env = HostEnv::new("/static")
        .with_fallback_file("404.html")
        .with_files_listing();

    let mut app = App::new()
        .set_host_env(env);

    // Enables routing to static files 
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

Additionally, [`HostEnv`](https://docs.rs/volga/latest/volga/app/env/struct.HostEnv.html) can be extracted in middlewares and request handlers.

For a full example, see [this repository](https://github.com/RomanEmreis/volga/blob/main/examples/static_files/src/main.rs).