# Working with Files

Volga provides robust functionality for handling file operations such as downloading and uploading files within your Web Applications.

## Downloading Files
Volga's [`Results::file()`](https://docs.rs/volga/latest/volga/http/response/struct.Results.html#method.file) function facilitates file downloads by sending files to clients. This function requires the file name and an opened file stream.

### Using `Results::file()`

Here is an example showing how to set up a route for file downloads:
```rust
use volga::{App, Results};
use tokio::fs::File;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // GET /download
    app.map_get("/download", || async {
        let file_name = "path/to/example.txt";
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
use volga::{App, file};
use tokio::fs::File;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // GET /download
    app.map_get("/download", || async {
        let file_name = "path/to/example.txt";
        let file = File::open(file_name).await?;
        
        file!(file_name, file)
    });

    app.run().await
}
```
You can check out the full example of file downloading [here](https://github.com/RomanEmreis/volga/blob/main/examples/file_download/src/main.rs).

## Uploading Files

For file uploads, Volga has [`save()`](https://docs.rs/volga/latest/volga/http/endpoints/args/file/struct.FileStream.html#method.save) and [`save_as()`](https://docs.rs/volga/latest/volga/http/endpoints/args/file/struct.FileStream.html#method.save_as) methods, that are part of the [`volga::File`](https://docs.rs/volga/latest/volga/http/endpoints/args/file/struct.FileStream.html) struct, allows you to stream the incoming file stream directly into a server-side file.

### Example of File Upload
This example demonstrates how to set up a route to handle file uploads:
```rust
use volga::{App, File};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // POST /upload
    app.map_post("/upload", |file: File| async move {
        file.save_as("path/to/example.txt").await // or file.save("path/to/folder").await
    });

    app.run().await
}
```

Here is the [full example](https://github.com/RomanEmreis/volga/blob/main/examples/file_upload/src/main.rs)

## Multipart uploading
In case, if you need to upload multiple files, you can leverage a multipart file uploading. It's a separate feature  and if you're not using the `full` feature set it can be explicitly enabled in your `Cargo.toml`:
```toml
[dependencies]
volga = { version = "0.4.5", features = ["multipart"] }
```
### Example of Multipart file uploading
This example demonstrates how to upload multiple files:
```rust
use volga::{App, Multipart};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // POST /upload
    app.map_post("/upload", |files: Multipart| async move {
        // Saves all the files to the specified folder
        files.save_all("path/to/folder").await
    });

    app.run().await
}
```

If you need more control or do some job per each file you can use the [`next_field()`](https://docs.rs/volga/latest/volga/http/endpoints/args/multipart/struct.Multipart.html#method.next_field) method:
```rust
use volga::{App, Multipart};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // POST /upload
    app.map_post("/upload", |files: Multipart| async move {
        let path = Path::new("path/to/folder");
        while let Some(field) = files.next_field().await? {
            // do something...

            field.save(path).await?;
        }
        ok!("Files have been uploaded!")
    });

    app.run().await
}
```

More robust examples you can find [here](https://github.com/RomanEmreis/volga/blob/main/examples/multipart/src/main.rs)
