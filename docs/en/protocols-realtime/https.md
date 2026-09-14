# HTTPS

Volga supports HTTPS/TLS protocols implemented on top of `rustls`.

If you're not using the `full` feature set, ensure you enable the `tls` feature in your `Cargo.toml`:

```toml
[dependencies]
volga = { version = "...", features = ["tls"] }
```

## Simple HTTPS server

### Use Development Certificates

For local development and testing purposes you may leverage automatic self-signed certificate generation.
First, enable the `dev-cert` feature in `Cargo.toml`:

```toml
[dependencies]
volga = { version = "...", features = ["tls", "dev-cert"] }
```

Next, in `main.rs` you can enable development certificates using the [`with_dev_cert()`](https://docs.rs/volga/latest/volga/tls/struct.TlsConfig.html#method.with_dev_cert) method.
There are two modes available via the [`DevCertMode`](https://docs.rs/volga/latest/volga/tls/enum.DevCertMode.html) enum:

* [`DevCertMode::Ask`](https://docs.rs/volga/latest/volga/tls/enum.DevCertMode.html) — checks for existing certificates and asks you whether to generate them if they are missing.
* [`DevCertMode::Auto`](https://docs.rs/volga/latest/volga/tls/enum.DevCertMode.html) — automatically generates certificates without asking.

::: info
In release builds, this method is a no-op.
:::

```rust
use volga::{App, tls::DevCertMode};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new()
        .with_tls(|tls| tls
            .with_dev_cert(DevCertMode::Ask));

    app.map_get("/hello", || async {
        "Hello, World!"
    });

    app.run().await
}
```

When you run your web server, it will look for the `cert` folder with certificate files: `dev-cert.pem` and `dev-key.pem`.
If they are missing and you use [`DevCertMode::Ask`](https://docs.rs/volga/latest/volga/tls/enum.DevCertMode.html), the server will prompt you to generate them. If you agree, the certificates will be created and automatically used.

If you want to avoid the prompt and always generate missing certificates, use [`DevCertMode::Auto`](https://docs.rs/volga/latest/volga/tls/enum.DevCertMode.html):

```rust
use volga::{App, tls::DevCertMode};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new()
        .with_tls(|tls| tls
            .with_dev_cert(DevCertMode::Auto));

    app.map_get("/hello", || async {
        "Hello, World!"
    });

    app.run().await
}
```

### Manually Generate Self-Signed Certificates
If you want to create self-signed certificates manually, you can use the following command:
```bash
openssl req -x509 -newkey rsa:4096 -nodes -keyout key.pem -out cert.pem -days 365 -subj '/CN=localhost'`
```

### Adjusting code to use certificate and private key
If you generated a certificate and private key in the folder where your `Cargo.toml` is located, you can simply do the following:
```rust compile
use volga::{App, tls::TlsConfig};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new()
        .set_tls(TlsConfig::new());

    app.map_get("/hello", || async {
        "Hello, World!"
    });

    app.run().await
}
```
By default, [`TlsConfig`](https://docs.rs/volga/latest/volga/tls/struct.TlsConfig.html) reads these files from this folder and expects the names: `cert.pem` and `key.pem`. 
If you have these files in another folder you can configure the TLS like this:
```rust
let config = TlsConfig::from_pem("path/to/certs");
```
In the case, if you have different file names, you can handle it like this:
```rust
let config = TlsConfig::new()
    .with_cert_path("path/to/certs/server.pem")
    .with_key_path("path/to/certs/server.key");
```
You can test the code above by using `curl` command:
```bash
> curl -v "https://localhost:7878/hello"
```

## Client Authentication

For the code above the client authentication is disabled. You may enable it as optional or required. The difference is that in the first case, it still allows anonymous requests.

### Generate CA Certificate and Private Key
First, let's run the following commands to generate the CA (Client Authority) certificate and private key:
```bash
openssl genrsa -out ca.key 2048
openssl req -x509 -new -nodes -key ca.key -sha256 -days 3650 -out ca.pem -subj "/C=US/ST=State/L=City/O=Organization/OU=OrgUnit/CN=CA"
```

### Optional Client Authentication
This configuration will configure trust anchor for optional authentication:
```rust
let config = TlsConfig::new()
    .with_cert_path("path/to/certs/server.pem")
    .with_key_path("path/to/certs/server.key")
    .with_optional_client_auth("path/to/certs/ca.pem");
```

### Required Client Authentication
This configuration will configure trust anchor for required authentication:
```rust
let config = TlsConfig::new()
    .with_cert_path("tests/tls/server.pem")
    .with_key_path("tests/tls/server.key")
    .with_required_client_auth("path/to/certs/ca.pem");
```
Then you need to generate client certificate and private key:
```bash
openssl req -x509 -newkey rsa:4096 -nodes -keyout client.key -out client.pem -days 365 -subj '/CN=localhost'`
```
And then you can test it by using `curl`:
```bash
> curl --cert client.pem --key client.key --cacert ca.pem https://localhost:7878/hello
```

## HTTPS Redirection

Volga also supports an HTTPS redirection, that allows you to configure a redirect from an HTTP request to HTTPS.
You can configure it by leveraging [`with_https_redirection()`](https://docs.rs/volga/latest/volga/tls/struct.TlsConfig.html#method.with_https_redirection) method:
```rust
let config = TlsConfig::new()
    .with_cert_path("path/to/certs/server.pem")
    .with_key_path("path/to/certs/server.key")
    .with_https_redirection();
```
The default HTTP port is `7879` but you can change it to any other like this:
```rust
let config = TlsConfig::new()
    .with_cert_path("path/to/certs/server.pem")
    .with_key_path("path/to/certs/server.key")
    .with_https_redirection()
    .with_http_port(7979);
```
Now, if you run this `curl` command, your request will be redirected to `https://localhost:7878/hello`:
```bash
> curl -v "http://localhost:7979/hello"
```
Internally, when you run this code in debug mode it uses a [Temporary Redirect](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/307) (307), since link caching can cause unstable behavior in development environments. However, in release mode, it responds with 308 - [Permanent Redirect](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/308).

### Which host the redirect points at

The `Location` is built from the host the request was **addressed to**, with the HTTPS port substituted and the path and query kept as they were. That host is read from the request target first and from the `Host` header second, which is the order RFC 9112 §3.2.2 gives them — and the only order that finds anything over HTTP/2, where the host arrives as the `:authority` pseudo-header and never becomes a `Host` header at all (RFC 9113 §8.3.1).

A request with no usable host — none at all, more than one `Host`, or one that is not a valid authority — is answered `400`, as RFC 9112 §3.2 requires. There is nowhere to send it.

::: warning Fixed in 0.10.1
Three bugs in one listener, all of which showed up as "the redirect just doesn't happen":

* With the `http2` feature on (`full` includes it), the redirect listener accepted **only** HTTP/2, so a browser — which speaks HTTP/1.1 to a plaintext port — got no redirect. It now serves both.
* The host was read from the `Host` header alone, so an HTTP/2 request to the redirect listener was answered `404`.
* A request without a usable host was answered `404` rather than `400`, and a `Host: [::1]` with no port failed the redirect with a `500`.
:::

## HTTP Strict Transport Security Protocol (HSTS)

HTTP Strict Transport Security (HSTS) is an opt-in security enhancement that is specified by the web server through the use of a response header. When a browser that supports HSTS receives this header:
* The browser stores configuration for the domain that prevents sending any communication over HTTP. 
* The browser forces all communication over HTTPS.
* The browser prevents the user from using untrusted or invalid certificates. 
* The browser disables prompts that allow a user to temporarily trust such a certificate.

Because HSTS is enforced by the client, it has some limitations:
* The client should support HSTS.
* HSTS requires at least one successful HTTPS request to establish the HSTS policy.
* The application must check every HTTP request and redirect or reject the HTTP request.

HSTS in Volga is enabled by default, however you may configure it by leveraging [`with_hsts()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.with_hsts) method:
```rust compile
use volga::{App, tls::TlsConfig};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new()
        .with_tls(|tls| tls
            .with_https_redirection()
            .with_hsts(|hsts| hsts.with_preload())
        );

    app.map_get("/hello", || async {
        "Hello, World!"
    });

    app.run().await
}
```
Then if you run this code you will receive the `Strict-Transport-Security` HTTP header along with the successful response.

::: info
[`with_preload()`](https://docs.rs/volga/latest/volga/tls/struct.HstsConfig.html#method.with_preload) and [`with_sub_domains()`](https://docs.rs/volga/latest/volga/tls/struct.HstsConfig.html#method.with_sub_domains) take no arguments — they enable the corresponding flags. Use [`without_preload()`](https://docs.rs/volga/latest/volga/tls/struct.HstsConfig.html#method.without_preload) / [`without_sub_domains()`](https://docs.rs/volga/latest/volga/tls/struct.HstsConfig.html#method.without_sub_domains) to disable them. All HSTS settings are configured through the `with_hsts(|h| ...)` closure on [`TlsConfig`](https://docs.rs/volga/latest/volga/tls/struct.TlsConfig.html#method.with_hsts).
:::

### Excluding hosts

Some hosts should not be told to enforce HTTPS forever — a `localhost` a developer reaches over plain HTTP, or an internal name whose certificate is not public. [`with_exclude_hosts()`](https://docs.rs/volga/latest/volga/tls/struct.HstsConfig.html#method.with_exclude_hosts) names them:

```rust compile
use volga::{App, tls::TlsConfig};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new()
        .with_tls(|tls| tls
            .with_https_redirection()
            .with_hsts(|hsts| hsts
                .with_exclude_hosts(["localhost", "internal.example.com"])));

    app.map_get("/hello", || async { "Hello, World!" });

    app.run().await
}
```

A host is matched by its **name alone**, on any port: a browser keeps an HSTS policy per host name and applies it whatever port that host is reached on, so there is no port for the list to distinguish. Case, surrounding whitespace, a `user@` prefix and a trailing dot are all ignored, so `localhost` also covers `LOCALHOST:8443` and `localhost.`.

::: warning Changed in 0.10.1
Only `:443` and `:80` used to be stripped from an entry, so the port decided the match: `example.com:8443` excluded that host on port 8443 and nowhere else, while a plain `example.com` excluded it everywhere *but* 8443. A browser draws no such line — it keeps one policy per host name — so whichever of the two you wrote, some of the requests you meant to exclude were still told to enforce HTTPS. And a list read from a [configuration file](../middleware-infrastructure/config-files.md) — `exclude_hosts` under `[tls.hsts_config]` — never went through the normalizing builder at all, so an entry with any port, a trailing dot or an uppercase letter matched nothing. Every entry is normalized the same way now, wherever it was written.

Over HTTP/2, `exclude_hosts` never matched at all: the host was read from the `Host` header, which HTTP/2 does not send. It is now read from the request target first, as for redirection.
:::

You can find more examples [here](https://github.com/RomanEmreis/volga/blob/main/examples/tls/src/main.rs).
