# HTTPS

Volga supports HTTPS/TLS protocols implemented on top of `rustls`.

If you're not using the `full` feature set, ensure you enable the `tls` feature in your `Cargo.toml`:

```toml
[dependencies]
volga = { version = "0.6.6", features = ["tls"] }
```

## Simple HTTPS server

### Use Development Certificates

For local development and testing purposes you may leverage automatic self-signed certificate generation.
First, enable the `dev-cert` feature in `Cargo.toml`:

```toml
[dependencies]
volga = { version = "0.6.6", features = ["tls", "dev-cert"] }
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
```rust
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

You can enable HSTS in Volga by leveraging [`use_hsts()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.use_hsts) method:
```rust
use volga::{App, tls::TlsConfig};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new()
        .with_tls(|tls| tls.with_https_redirection());

    // Enables HSTS middleware
    app.use_hsts();

    app.map_get("/hello", || async {
        "Hello, World!"
    });

    app.run().await
}
```
Then if you run this code you will receive the `Strict-Transport-Security` HTTP header along with the successful response.

You can find more examples [here](https://github.com/RomanEmreis/volga/blob/main/examples/tls/src/main.rs).
