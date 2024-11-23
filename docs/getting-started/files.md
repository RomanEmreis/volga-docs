# Working with Files in Volga

Volga provides robust functionality for handling file operations such as downloading and uploading files within your Web Applications.

## Downloading Files
Volga's `Results::file()` function facilitates file downloads by sending files to clients. This function requires the file name and an opened file stream.

### Using `Results::file()`

Here is an example showing how to set up a route for file downloads:
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
### Simplifying with the `file!` macro
Volga also offers the `file!` macro to streamline the process.
The file! macro provides a short syntax for initiating file downloads:
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
You can check out the full example of file downloading [here](https://github.com/RomanEmreis/volga/blob/main/examples/file_download.rs).
## Uploading Files
For file uploads, Volga's `to_file()` method, which is part of the `volga::File` trait, allows you to stream incoming file stream directly into a server-side file, optimizing for efficiency.
### Example of File Upload
This example demonstrates how to set up a route to handle file uploads:
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

Here is the [full example](https://github.com/RomanEmreis/volga/blob/main/examples/file_upload.rs)