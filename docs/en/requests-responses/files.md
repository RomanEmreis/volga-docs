# Working with Files

Volga provides robust functionality for handling file operations such as downloading and uploading files within your Web Applications.

## Downloading Files
Volga's [`file!`](https://docs.rs/volga/latest/volga/macro.file.html) macro facilitates file downloads by sending files to clients. This function requires the file name and an opened file stream.

### Using the `file!` macro
The `file!` macro provides a short syntax for initiating file downloads:
```rust compile
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

`file!` takes the name as a `&str` or, since **0.15.1**, an owned `String`. The name sets `Content-Type`, guessed from its extension, and `Content-Disposition: attachment`, which tells the browser what to save the file as. The name may come from the request: since **0.15.1** the header is built per RFC 6266 and RFC 8187, so a `"` or `\` in the name is escaped and cannot add parameters of its own, a non-ASCII name reaches the client intact in `filename*`, and control characters are replaced by `_`.

::: warning
Before **0.15.1**, `file!` wrote the name into the header as it was. A name such as `a"; filename="evil.exe` made the browser save `evil.exe`, so a client choosing the name chose what the file was saved as. Upgrade if a file name comes from user input.
:::

### `Content-Disposition` for Other Responses

For a download that `file!` does not cover, such as a `stream!` of a file, [`ContentDisposition::attachment()`](https://docs.rs/volga/latest/volga/headers/struct.ContentDisposition.html#method.attachment) (since **0.15.1**) builds the same header from any name:

```rust compile
use volga::{App, HttpBody, headers::ContentDisposition, stream};
use tokio::fs::File;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // GET /export/{name}
    app.map_get("/export/{name}", |name: String| async move {
        let file = File::open("path/to/report.csv").await?;
        let body = HttpBody::file(file);

        stream!(body.into_data_stream(); [
            ContentDisposition::attachment(&format!("{name}.csv"))
        ])
    });

    app.run().await
}
```

## Uploading Files

For file uploads, Volga has [`save()`](https://docs.rs/volga/latest/volga/http/endpoints/args/file/struct.FileStream.html#method.save) and [`save_as()`](https://docs.rs/volga/latest/volga/http/endpoints/args/file/struct.FileStream.html#method.save_as) methods, that are part of the [`volga::File`](https://docs.rs/volga/latest/volga/http/endpoints/args/file/struct.FileStream.html) struct, allows you to stream the incoming file stream directly into a server-side file.

### Example of File Upload
This example demonstrates how to set up a route to handle file uploads:
```rust compile
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

### Where `save()` Puts the File

`save()` names the file after the name the client sent in `Content-Disposition`. Since **0.15.1** it keeps only what follows the last `/` or `\` of that name, so the file always lands in the folder you pass: `../../etc/passwd` is saved as `passwd`, and an absolute `/tmp/x` as `x`. A name with nothing usable left, such as `..` or one ending in a separator, is answered with `400 Bad Request`.

`save_as()` writes to the path you give it and is unchanged. Don't build that path from the client's name yourself: `save_as(dir.join(name))` brings the folders of the name back. [`File::name()`](https://docs.rs/volga/latest/volga/http/endpoints/args/file/struct.FileStream.html#method.name) still returns the name as sent.

::: warning
Before **0.15.1**, `save()` joined the folder with the name as sent, so a client could write outside of it: `filename="../../x"` climbed up, and an absolute name replaced the folder altogether. Upgrade if you accept uploads from untrusted clients.
:::

## Multipart uploading
In case, if you need to upload multiple files, you can leverage a multipart file uploading. It's a separate feature  and if you're not using the `full` feature set it can be explicitly enabled in your `Cargo.toml`:
```toml
[dependencies]
volga = { version = "0.15", features = ["multipart"] }
```
### Example of Multipart file uploading
This example demonstrates how to upload multiple files:
```rust compile
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
```rust compile
use std::path::Path;
use volga::{App, Multipart, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // POST /upload
    app.map_post("/upload", |mut files: Multipart| async move {
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

`field.save()` and `save_all()` name files the way [`save()`](#where-save-puts-the-file) does, after the last part of the name the client sent, since **0.15.1**.

More robust examples you can find [here](https://github.com/RomanEmreis/volga/blob/main/examples/multipart/src/main.rs)
