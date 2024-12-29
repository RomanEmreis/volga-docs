# Работа с файлами

Волга предоставляет мощные возможности для работы с файлами, включая скачивание и загрузку файлов в ваших веб-приложениях.

## Скачивание
Функция [`Results::file()`](https://docs.rs/volga/latest/volga/app/results/struct.Results.html#method.file) позволяет скачивать файлы, отправляя их клиентам. Эта функция требует указания имени файла и открытого потока файла.

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
Для загрузки файлов Волга предоставляет метод [`save()`](https://docs.rs/volga/latest/volga/app/endpoints/args/file/struct.FileStream.html#tymethod.save), который является частью [`volga::File`](https://docs.rs/volga/latest/volga/app/endpoints/args/file/type.File.html). Этот метод позволяет передавать входящий поток байт непосредственно в файл на сервере, обеспечивая высокую производительность.

### Пример загрузки файла
Пример настройки маршрута для обработки загрузки файлов:
```rust
use volga::{App, File, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // POST /upload
    app.map_post("/upload", |file: File| async move {
        file.save("path/to/example.txt").await?;
        
        ok!()
    });

    app.run().await
}
```

Полный пример можно посмотреть [здесь](https://github.com/RomanEmreis/volga/blob/main/examples/file_upload.rs).