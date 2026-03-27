# Файлы конфигурации

Volga поддерживает файловую конфигурацию приложения. Вы можете описать настройки в TOML или JSON файле, привязать секции к строго типизированным Rust-структурам и получать к ним доступ в обработчиках запросов через экстрактор `Config<T>`. Также поддерживается горячая перезагрузка конфигурации.

## Подготовка

### Зависимости

Если вы не используете полный набор возможностей (`full`), вам необходимо включить `config` в `Cargo.toml`:

```toml
[dependencies]
volga = { version = "...", features = ["config"] }
serde = { version = "1", features = ["derive"] }
```

[`serde`](https://crates.io/crates/serde) с фичей `derive` необходим для десериализации секций конфигурации в структуры.

### Поддерживаемые форматы

Volga поддерживает два формата конфигурационных файлов (определяется по расширению):
- **TOML** (`.toml`) — рекомендуемый
- **JSON** (`.json`)

## Быстрый старт

Создайте файл `app_config.toml` в корне проекта:

```toml
[server]
host = "0.0.0.0"
port = 3000

[handler]
msg = "World"
```

Определите структуру для вашей секции и привяжите её при настройке приложения:

```rust
use volga::{App, Config, ok};
use serde::Deserialize;

#[derive(Deserialize)]
struct HandlerConfig {
    msg: String,
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new().with_config(|cfg| {
        cfg.with_file("app_config.toml")
            .bind_section::<HandlerConfig>("handler")
    });

    app.map_get("/hello", |cfg: Config<HandlerConfig>| async move {
        ok!(fmt: "Hello, {}!", cfg.msg)
    });

    app.run().await
}
```

Теперь запрос `GET /hello` вернёт `Hello, World!`.

## Загрузка конфигурации

Volga предоставляет три способа загрузки конфигурационного файла:

### Конфигурация по умолчанию

Самый простой вариант — автоматический поиск `app_config.toml` или `app_config.json` в текущей рабочей директории:

```rust
let app = App::new().with_default_config();
```

::: warning
`with_default_config()` вызовет панику при запуске, если ни `app_config.toml`, ни `app_config.json` не найден.
:::

### Замыкание с билдером

Для полного контроля используйте `with_config()`, который предоставляет `ConfigBuilder`:

```rust
let app = App::new().with_config(|cfg| {
    cfg.with_file("config/prod.toml")
        .bind_section::<Database>("database")
        .bind_section::<Cache>("cache")
        .reload_on_change()
});
```

### Отдельный билдер

Можно создать `ConfigBuilder` отдельно и передать его через `set_config()`:

```rust
use volga::{App, ConfigBuilder};

let config = ConfigBuilder::from_file("config/prod.toml")
    .bind_section::<Database>("database")
    .reload_on_change();

let app = App::new().set_config(config);
```

## Привязка секций

### Обязательные секции

Используйте `bind_section::<T>(key)` для регистрации обязательной секции. Если секция отсутствует или имеет неверный формат, приложение вызовет панику при запуске:

```rust
#[derive(Deserialize)]
struct Database {
    url: String,
}

let app = App::new().with_config(|cfg| {
    cfg.with_file("app_config.toml")
        .bind_section::<Database>("database")
});
```

Соответствующий `app_config.toml`:

```toml
[database]
url = "postgres://localhost/mydb"
```

### Опциональные секции

Используйте `bind_section_optional::<T>(key)` для секций, которые могут отсутствовать. Если секция не найдена, `Config<T>` не будет доступен, но приложение не вызовет панику:

```rust
#[derive(Deserialize)]
struct Cache {
    ttl: u64,
}

let app = App::new().with_config(|cfg| {
    cfg.with_file("app_config.toml")
        .bind_section_optional::<Cache>("cache")
});
```

## Доступ к конфигурации в обработчиках

Используйте экстрактор `Config<T>` для доступа к привязанной секции в любом обработчике запросов. Он выполняет одну атомарную загрузку + `Arc::clone` на каждый запрос — без десериализации во время выполнения:

```rust
use volga::{App, Config, ok};
use serde::Deserialize;

#[derive(Deserialize)]
struct Database {
    url: String,
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new().with_config(|cfg| {
        cfg.with_file("app_config.toml")
            .bind_section::<Database>("database")
    });

    app.map_get("/db-url", |db: Config<Database>| async move {
        ok!(db.url.as_str())
    });

    app.run().await
}
```

## Встроенные секции

Volga автоматически распознаёт и применяет зарезервированные секции из конфигурационного файла. Эти секции настраивают внутренние компоненты фреймворка и **не требуют** вызова `bind_section()`:

| Секция       | Feature-флаг   | Поля                                                          |
|--------------|----------------|---------------------------------------------------------------|
| `[server]`   | *(всегда)*     | `host`, `port`, `body_limit_bytes`, `max_header_count`, `max_connections` |
| `[tls]`      | `tls`          | Настройки TLS-сертификатов                                    |
| `[tracing]`  | `tracing`      | Настройки трассировки/логирования                             |
| `[openapi]`  | `openapi`      | Настройки спецификации OpenAPI                                |
| `[cors]`     | `middleware`   | Настройки политики CORS                                       |

Например, секция `[server]` позволяет настроить хост и порт прямо в файле конфигурации:

```toml
[server]
host = "0.0.0.0"
port = 8080
body_limit_bytes = 1048576
max_connections = 1000
```

::: tip
Встроенные секции применяются только при запуске. Горячая перезагрузка на них **не влияет**.
:::

## Горячая перезагрузка

Включите автоматическую перезагрузку конфигурации с помощью `reload_on_change()`. Volga будет опрашивать файл каждые 5 секунд и обновлять все привязанные секции:

```rust
let app = App::new().with_config(|cfg| {
    cfg.with_file("app_config.toml")
        .bind_section::<HandlerConfig>("handler")
        .reload_on_change()
});
```

Поведение при перезагрузке:
- **Обязательные секции** — если обязательная секция исчезает из файла или становится некорректной, сохраняется предыдущее значение.
- **Опциональные секции** — если опциональная секция исчезает, `Config<T>` становится недоступным.
- **Встроенные секции** (server, tls и т.д.) **не перезагружаются** — они применяются только при запуске.

::: warning
`reload_on_change()` требует вызова `with_file()`. Приложение вызовет панику при запуске, если путь к файлу не указан.
:::

## Пример с JSON

Вместо TOML можно использовать JSON. Создайте `app_config.json`:

```json
{
  "server": {
    "host": "0.0.0.0",
    "port": 3000
  },
  "database": {
    "url": "postgres://localhost/mydb"
  }
}
```

```rust
let app = App::new().with_config(|cfg| {
    cfg.with_file("app_config.json")
        .bind_section::<Database>("database")
});
```

## Полный пример

Полный рабочий пример можно найти в [репозитории Volga](https://github.com/RomanEmreis/volga/tree/main/examples/config).
