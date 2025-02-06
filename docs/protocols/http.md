# HTTP/1 and HTTP/2
Starting **v0.3.1**, a specific version of HTTP can be configured.
By default, if Volga dependency added like this:
```toml
[dependencies]
volga = "0.3.1"
```
There HTTP/1 will be used, and if we need HTTP/2, it can be enabled if we explicitly add the `http2` feature or use the `full`.
```toml
[dependencies]
volga = { version = "0.3.1", features = ["full"] }
```
With the `full` the HTTP/2 will be used if it is possible, otherwise it will be switched to HTTP/1 automatically.