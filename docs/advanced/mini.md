# Minimal API
Starting with version **v0.3.1**, new features have been introduced that offer minimal functionality. Currently they are exclude `di` and `middleware` features.

To leverage a minimal HTTP/1 functionality, you need just:
```toml
[dependencies]
volga = { version = "0.3.1", features = ["mini"] }
```
And similar for the HTTP/2
```toml
[dependencies]
volga = { version = "0.3.1", features = ["mini2"] }
```
