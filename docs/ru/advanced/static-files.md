# Статические файлы

Волга поддерживает работу со статическими файлами с возможностью просмотра каталогов, настраиваемым именем индексного файла, префиксами путей, корневой папкой контента и специальным файлом для обработки неизвестных маршрутов.

## Подготовка

### Зависимости

Если вы не используете полный набор возможностей (`full`), вам необходимо включить `static-files` в `Cargo.toml`:

```toml
[dependencies]
volga = { version = "0.5.2", features = ["static-files"] }
```

### Структура папок

Предположим, у нас есть следующая структура проекта:

```
project/
│── static/
│   ├── index.html
│   ├── style.css
│   ├── script.js
│── src/
│   ├── main.rs
│── Cargo.toml
```

## Базовый сервер статических файлов

После создания файлов HTML, CSS и JS можно настроить минимальный сервер в `main.rs`:

```rust
use volga::App;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new()
        .with_host_env(|env| env.with_content_root("/static"));

    // Включает маршрутизацию статических файлов
    app.map_static_assets();

    app.run().await
}
```

По умолчанию корневая папка — это корень проекта (`project/`). Вызов [`with_content_root("/static")`](https://docs.rs/volga/latest/volga/app/env/struct.HostEnv.html#method.with_content_root) изменяет её на `project/static/`.

Затем вызов [`map_static_assets()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_static_assets) автоматически добавляет маршруты `GET` и `HEAD`:
- `/` → `/index.html`
- `/{path}` → `/любой_файл_или_папка_в_корне`

Если в корневой папке есть подпапки, они также будут обработаны.

## Файл по умолчанию

Чтобы раздавать специальный файл (например, `404.html`) при неизвестных маршрутах, используйте [`map_fallback_to_file()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_fallback_to_file), внутри он использует другой метод - [`map_fallback()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_fallback) который, в свою очередь, настраивает специальный обработчик, вызываемый при обнаружении неизвестного маршрута:

```rust
use volga::App;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new()
        .with_host_env(|env| env
            .with_content_root("/static")
            .with_fallback_file("404.html"));

    // Включает маршрутизацию статических файлов
    app.map_static_assets();

    // Включает перенаправление на 404.html
    app.map_fallback_to_file();

    app.run().await
}
```

Поскольку такие специальные резервные файлы отключены по умолчанию, мы явно задаем файл `404.html` с помощью метода [`with_fallback_file("404.html")`](https://docs.rs/volga/latest/volga/app/env/struct.HostEnv.html#method.with_fallback_file).

Для упрощения можно использовать [`use_static_files()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.use_static_files), который объединяет [`map_static_assets()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_static_assets) и [`map_fallback_to_file()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_fallback_to_file), Однако, последний метод будет задействован, только если указан специальный резервный файл:

```rust
use volga::App;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new()
        .with_host_env(|env| env
            .with_content_root("/static")
            .with_fallback_file("404.html"));

    // Включает маршрутизацию статических файлов
    // и перенаправление на 404.html
    app.use_static_files();

    app.run().await
}
```

::: tip
Можно установить [`with_fallback_file("index.html")`](https://docs.rs/volga/latest/volga/app/env/struct.HostEnv.html#method.with_fallback_file), чтобы перенаправлять неизвестные маршруты на главную страницу.
:::

## Просмотр каталогов

По умолчанию просмотр каталогов отключен. Его можно включить с помощью [`with_files_listing()`](https://docs.rs/volga/latest/volga/app/env/struct.HostEnv.html#method.with_files_listing), однако это не рекомендуется для продакшн-сред.

```rust
use volga::App;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new()
        .with_host_env(|env| env
            .with_content_root("/static")
            .with_fallback_file("404.html")
            .with_files_listing());

    // Включает маршрутизацию статических файлов
    // и перенаправление на 404.html
    app.use_static_files();

    app.run().await
}
```

## Хост-среда

Для более сложных сценариев можно использовать [`HostEnv`](https://docs.rs/volga/latest/volga/app/env/struct.HostEnv.html), который представляет хост-среду приложения.
Использование его напрямую упрощает управление и переключение между средами.

Вот как можно добиться той же конфигурации с помощью `HostEnv`:

```rust
use volga::{App, File, app::HostEnv};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let env = HostEnv::new("/static")
        .with_fallback_file("404.html")
        .with_files_listing();

    let mut app = App::new()
        .set_host_env(env);

    // Включает маршрутизацию статических файлов
    // и перенаправление на 404.html
    app.use_static_files();

    // Загружает новые статические файлы
    app.map_post("/upload", |file: File, env: HostEnv| async move {
        let root = env.content_root();
        file.save(root).await
    });

    app.run().await
}
```

Кроме того, [`HostEnv`](https://docs.rs/volga/latest/volga/app/env/struct.HostEnv.html) можно извлекать в middleware и обработчики запросов.

Полный пример можно найти в [этом репозитории](https://github.com/RomanEmreis/volga/blob/main/examples/static_files/src/main.rs).
