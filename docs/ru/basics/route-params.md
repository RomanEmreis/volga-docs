# Параметры маршрута

Волга предоставляет мощные возможности маршрутизации, позволяя использовать динамические маршруты с параметрами. Используя аргументы функций, которые реализуют trait [`FromStr`](https://doc.rust-lang.org/std/str/trait.FromStr.html), вы можете передавать их напрямую обработчику запросов.

## Пример: Один параметр

Вот как настроить простой динамический маршрут, который приветствует пользователя по имени:

```rust
use volga::{App, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/hello/{name}", |name: String| async move {
        ok!("Hello {}!", name)
    });

    app.run().await
}
```

## Тестирование маршрута

В фигурных скобках указан маршрут `GET` с параметром `name`. При выполнении запросов к этому маршруту будет вызван соответствующий обработчик, а значение `name` передано в качестве аргумента функции.

Пример тестирования с помощью команды `curl`:

```bash
> curl "http://localhost:7878/hello/world"
Hello world!

> curl "http://localhost:7878/hello/earth"
Hello earth!

> curl "http://localhost:7878/hello/sun"
Hello sun!
```

## Пример: Несколько параметров

Вы также можете настроить маршруты с несколькими параметрами. Например:

```rust
use volga::{App, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/hello/{descr}/{name}", |descr: String, name: String| async move {
        ok!("Hello {} {}!", descr, name)
    });

    app.run().await
}
```

Пример выполнения запроса `curl`:

```bash
> curl "http://localhost:7878/hello/beautiful/world"
Hello beautiful world!
```

::: warning
Важно строго соблюдать порядок аргументов функции-обработчика, как указано в маршруте.  
Например, для маршрута `hello/{descr}/{name}` аргументы должны быть `|descr: String, name: String|`.
:::

## Использование `Path<T>`

Кроме того, вы можете использовать [`Path<T>`](https://docs.rs/volga/latest/volga/http/endpoints/args/path/struct.Path.html), чтобы обернуть параметры маршрута в специализированную структуру. Где `T` — это либо десериализуемая структура, либо `HashMap`. Убедитесь, что у вас установлена библиотека [serde](https://crates.io/crates/serde):

```rust
use volga::{App, Path, ok};
use serde::Deserialize;

#[derive(Deserialize)]
struct User {
    name: String,
    age: u32
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // GET /hello/John/35
    app.map_get("/hello/{name}/{age}", |user: Path<User>| async move {
        // Здесь вы можете напрямую обращаться к полям структуры
        ok!("Hello {}! You're age is: {}!", user.name, user.age)
    });

    app.run().await
}
```

Полный пример доступен по [ссылке](https://github.com/RomanEmreis/volga/blob/main/examples/route_params/src/main.rs).