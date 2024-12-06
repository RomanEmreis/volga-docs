# Working with Files in Volga

Volga provides robust functionality for handling file operations such as downloading and uploading files within your Web Applications.

## Downloading Files
Volga's [`Results::file()`](https://docs.rs/volga/latest/volga/app/results/struct.Results.html#method.file) function facilitates file downloads by sending files to clients. This function requires the file name and an opened file stream.

### Using `Results::file()`

Here is an example showing how to set up a route for file downloads:
```rust
use volga::{App, Router, Results};
use tokio::fs::File;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // GET /download
    app.map_get("/download", || async {
        let file_name = "example.txt";
        let file = File::open(file_name).await?;
        
        Results::file(file_name, file).await
    });

    app.run().await
}
```
### Simplifying with the `file!` macro
Volga also offers the [`file!`](https://docs.rs/volga/latest/volga/macro.file.html) macro to streamline the process.
The file! macro provides a short syntax for initiating file downloads:
```rust
use volga::{App, Router, file};
use tokio::fs::File;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // GET /download
    app.map_get("/download", || async {
        let file_name = "example.txt";
        let file = File::open(file_name).await?;
        
        file!(file_name, file)
    });

    app.run().await
}
```
You can check out the full example of file downloading [here](https://github.com/RomanEmreis/volga/blob/main/examples/file_download.rs).
## Uploading Files
For file uploads, Volga's [`save()`](https://docs.rs/volga/latest/volga/app/endpoints/args/file/struct.FileStream.html#tymethod.save) method, which is part of the [`volga::File`](https://docs.rs/volga/latest/volga/app/endpoints/args/file/type.File.html) trait, allows you to stream the incoming file stream directly into a server-side file, optimizing for efficiency.
### Example of File Upload
This example demonstrates how to set up a route to handle file uploads:
```rust
use volga::{App, Router, File, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // POST /upload
    app.map_post("/upload", |file: File| async move {
        file.save("example.txt").await?;
        
        ok!()
    });

    app.run().await
}
```

Here is the [full example](https://github.com/RomanEmreis/volga/blob/main/examples/file_upload.rs)