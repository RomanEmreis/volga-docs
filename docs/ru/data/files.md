# Работа с файлами

Волга предоставляет мощные возможности для работы с файлами, включая скачивание и загрузку файлов в ваших веб-приложениях.

## Скачивание
Функция [`Results::file()`](https://docs.rs/volga/latest/volga/http/response/struct.Results.html#method.file) позволяет скачивать файлы, отправляя их клиентам. Эта функция требует указания имени файла и открытого потока файла.

### Использование `Results::file()`

Пример настройки маршрута для скачивания файлов:
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

### Упрощение с помощью макроса `file!`
Волга также предоставляет макрос [`file!`](https://docs.rs/volga/latest/volga/macro.file.html), который немного упрощает процесс.  
Макрос `file!` предлагает чуть более читаемый синтаксис для отправки файла:
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

Вы можете посмотреть полный пример скачивания файлов [здесь](https://github.com/RomanEmreis/volga/blob/main/examples/file_download.rs).

## Загрузка файлов
Для загрузки файлов Волга предоставляет методы [`save()`](https://docs.rs/volga/latest/volga/http/endpoints/args/file/struct.FileStream.html#method.save) и [`save_as()`](https://docs.rs/volga/latest/volga/http/endpoints/args/file/struct.FileStream.html#method.save_as), которые является частью [`volga::File`](https://docs.rs/volga/latest/volga/http/endpoints/args/file/struct.FileStream.html). Эти методы позволяет передавать входящий поток байт непосредственно в файл на сервере, обеспечивая высокую производительность.

### Пример загрузки файла
Пример настройки маршрута для обработки загрузки файлов:
```rust
use volga::{App, File};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // POST /upload
    app.map_post("/upload", |file: File| async move {
        file.save_as("path/to/example.txt").await
    });

    app.run().await
}
```

Полный пример можно посмотреть [здесь](https://github.com/RomanEmreis/volga/blob/main/examples/file_upload.rs).

## Загрузка нескольких файлов
В случае, если вам нужно загрузить несколько файлов, вы можете использовать многокомпонентную загрузку файлов. Это отдельная функция, и если вы не используете набор функций `full`, ее можно явно включить в `Cargo.toml`:
```toml
[dependencies]
volga = { version = "0.4.5", features = ["multipart"] }
```
### Пример загрузки нескольких файлов
Пример демонстрирующий многокомпонентную загрузку файлов:
```rust
use volga::{App, Multipart};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // POST /upload
    app.map_post("/upload", |files: Multipart| async move {
        // Сохраняет все файлы в указанной папке
        files.save_all("path/to/folder").await
    });

    app.run().await
}
```

Если вам нужен больший контроль или нужно выполнить какую-то работу для каждого файла, вы можете использовать метод [`next_field()`](https://docs.rs/volga/latest/volga/http/endpoints/args/multipart/struct.Multipart.html#method.next_field):
```rust
use volga::{App, Multipart};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // POST /upload
    app.map_post("/upload", |files: Multipart| async move {
        let path = Path::new("path/to/folder");
        while let Some(field) = files.next_field().await? {
            // что-то делаем...

            field.save(path).await?;
        }
        ok!("Files have been uploaded!")
    });

    app.run().await
}
```

Больше примеров вы можете найти [здесь](https://github.com/RomanEmreis/volga/blob/main/examples/multipart.rs)