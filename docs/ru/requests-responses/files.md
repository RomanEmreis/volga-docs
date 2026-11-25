# Работа с файлами

Волга предоставляет мощные возможности для работы с файлами, включая скачивание и загрузку файлов в ваших веб-приложениях.

## Скачивание
Макрос [`file!`](https://docs.rs/volga/latest/volga/macro.file.html) позволяет скачивать файлы, отправляя их клиентам. Эта функция требует указания имени файла и открытого потока файла.

### Использование `file!`
Макрос `file!` предлагает удобный синтаксис для отправки файла:
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

Вы можете посмотреть полный пример скачивания файлов [здесь](https://github.com/RomanEmreis/volga/blob/main/examples/file_download/src/main.rs).

`file!` принимает имя как `&str`, а начиная с **0.15.1** — и как `String`. По имени задаётся `Content-Type`, угаданный по расширению, и `Content-Disposition: attachment`, из которого браузер берёт имя сохраняемого файла. Имя может прийти из запроса: начиная с **0.15.1** заголовок собирается по RFC 6266 и RFC 8187, поэтому `"` и `\` в имени экранируются и не могут добавить в заголовок свои параметры, имя не в ASCII доходит до клиента без искажений в `filename*`, а управляющие символы заменяются на `_`.

::: warning
До **0.15.1** `file!` записывал имя в заголовок как есть. С именем вроде `a"; filename="evil.exe` браузер сохранял файл как `evil.exe`, то есть клиент, выбирающий имя, выбирал и то, под каким именем файл сохранится. Обновитесь, если имя файла приходит от пользователя.
:::

### `Content-Disposition` для других ответов

Для скачивания, которое `file!` не покрывает, например `stream!` из файла, [`ContentDisposition::attachment()`](https://docs.rs/volga/latest/volga/headers/struct.ContentDisposition.html#method.attachment) (начиная с **0.15.1**) собирает такой же заголовок из любого имени:

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

## Загрузка файлов
Для загрузки файлов Волга предоставляет методы [`save()`](https://docs.rs/volga/latest/volga/http/endpoints/args/file/struct.FileStream.html#method.save) и [`save_as()`](https://docs.rs/volga/latest/volga/http/endpoints/args/file/struct.FileStream.html#method.save_as), которые являются частью [`volga::File`](https://docs.rs/volga/latest/volga/http/endpoints/args/file/struct.FileStream.html). Эти методы позволяют передавать входящий поток байт непосредственно в файл на сервере, обеспечивая высокую производительность.

### Пример загрузки файла
Пример настройки маршрута для обработки загрузки файлов:
```rust compile
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

Полный пример можно посмотреть [здесь](https://github.com/RomanEmreis/volga/blob/main/examples/file_upload/src/main.rs).

### Куда `save()` сохраняет файл

`save()` называет файл по имени, которое клиент прислал в `Content-Disposition`. Начиная с **0.15.1** от этого имени остаётся только то, что идёт после последнего `/` или `\`, поэтому файл всегда попадает в переданную папку: `../../etc/passwd` сохраняется как `passwd`, а абсолютный `/tmp/x` — как `x`. На имя, от которого ничего пригодного не осталось, например `..` или имя, оканчивающееся разделителем, Волга отвечает `400 Bad Request`.

`save_as()` пишет по пути, который вы передали, и не изменился. Не собирайте этот путь из имени клиента сами: `save_as(dir.join(name))` возвращает папки из имени обратно. [`File::name()`](https://docs.rs/volga/latest/volga/http/endpoints/args/file/struct.FileStream.html#method.name) по-прежнему возвращает имя в том виде, в каком оно пришло.

::: warning
До **0.15.1** `save()` соединял папку с присланным именем как есть, и клиент мог записать файл за её пределами: `filename="../../x"` поднимался выше, а абсолютное имя заменяло папку целиком. Обновитесь, если принимаете файлы от недоверенных клиентов.
:::

## Загрузка нескольких файлов
В случае если вам нужно загрузить несколько файлов, вы можете использовать многокомпонентную загрузку файлов. Это отдельная функция, и если вы не используете набор функций `full`, её можно явно включить в `Cargo.toml`:
```toml
[dependencies]
volga = { version = "...", features = ["multipart"] }
```
### Пример загрузки нескольких файлов
Пример, демонстрирующий многокомпонентную загрузку файлов:
```rust compile
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
            // что-то делаем...

            field.save(path).await?;
        }
        ok!("Files have been uploaded!")
    });

    app.run().await
}
```

`field.save()` и `save_all()` называют файлы так же, как [`save()`](#куда-save-сохраняет-фаил), — по последней части присланного имени, начиная с **0.15.1**.

Больше примеров вы можете найти [здесь](https://github.com/RomanEmreis/volga/blob/main/examples/multipart/src/main.rs)
