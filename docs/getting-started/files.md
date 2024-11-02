# Files

The `Results::file()` function can be used to download/produce a file for a client. It takes a file name as `&str` and file bytes as `Vec<u8>`.
```rust
use volga::{App, AsyncEndpointsMapping, Results};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::build("localhost:7878").await?;

    // GET /hello
    app.map_get("/download", |request| async move {
        let file_name = "example.txt";
        let file_data = b"Hello, this is some file content!".to_vec();
        
        Results::file(file_name, file_data)
    });

    app.run().await
}
```
Alternatively it can be used with `file!` or `status!` macros.
## file!
```rust
use volga::{App, AsyncEndpointsMapping, file};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::build("localhost:7878").await?;

    // GET /hello
    app.map_get("/download", |request| async move {
        let file_name = "example.txt";
        let file_data = b"Hello, this is some file content!".to_vec();
        
        file!(file_name, file_data)
    });

    app.run().await
}
```
## status!
```rust
use volga::{App, AsyncEndpointsMapping, status};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::build("localhost:7878").await?;

    // GET /hello
    app.map_get("/download", |request| async move {
        let file_name = "example.txt";
        let file_data = b"Hello, this is some file content!".to_vec();
        
        status!(200, file_name, file_data)
    });

    app.run().await
}
```
