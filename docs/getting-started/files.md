# Files
!> Downloading and uploading files only works with asynchronous request handlers.
## Download files
The `Results::file()` function can be used to download/produce a file for a client. It takes a file name as `&str` and a pointer to opened file stream of type `tokio::fs::File`.
```rust
use volga::{App, AsyncEndpointsMapping, Results};
use tokio::fs::File;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::build("localhost:7878").await?;

    // GET /download
    app.map_get("/download", |request| async move {
        let file_name = "example.txt";
        let file = File::open(file_name).await?;
        
        Results::file(file_name, file).await
    });

    app.run().await
}
```
Alternatively it can be used with `file!` or `status!` macros.
## file!
```rust
use volga::{App, AsyncEndpointsMapping, file};
use tokio::fs::File;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::build("localhost:7878").await?;

    // GET /download
    app.map_get("/download", |request| async move {
        let file_name = "example.txt";
        let file = File::open(file_name).await?;
        
        file!(file_name, file)
    });

    app.run().await
}
```
## status!
```rust
use volga::{App, AsyncEndpointsMapping, status};
use tokio::fs::File;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::build("localhost:7878").await?;

    // GET /download
    app.map_get("/download", |request| async move {
        let file_name = "example.txt";
        let file = File::open(file_name).await?;
        
        status!(200, file_name, file)
    });

    app.run().await
}
```
## Upload files
To upload a file the `to_file()` method from `volga::File` trait can be used to stream the bytes into a file efficiently:
```rust
use volga::{App, AsyncEndpointsMapping, ok, File};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::build("localhost:7878").await?;

    // POST /upload
    app.map_post("/upload", |request| async move {
        request.to_file("example.txt").await?;
        
        ok!()
    });

    app.run().await
}
```
