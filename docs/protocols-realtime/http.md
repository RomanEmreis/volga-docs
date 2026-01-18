# HTTP/1 and HTTP/2
Starting with **v0.3.1**, you can configure the HTTP version.
If you add Volga like this, HTTP/1 is used by default:
```toml
[dependencies]
volga = { version = "..." }
```
To enable HTTP/2, add the `http2` feature or use `full`:
```toml
[dependencies]
volga = { version = "...", features = ["full"] }
```
With `full`, HTTP/2 is used when possible, and it falls back to HTTP/1 automatically.
