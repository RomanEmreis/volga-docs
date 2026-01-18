# Параметры запроса

Волга поддерживает извлечение параметров запроса в специальную структуру при помощи [`Query<T>`](https://docs.rs/volga/latest/volga/http/endpoints/args/query/struct.Query.html). `T` может быть либо десериализуемой структурой, либо [`HashMap`](https://doc.rust-lang.org/std/collections/struct.HashMap.html).  
Если вы хотите использовать свою структуру, как и в случае с [`Path<T>`](https://docs.rs/volga/latest/volga/http/endpoints/args/path/struct.Path.html) для параметров маршрута, убедитесь, что у вас установлена библиотека [serde](https://crates.io/crates/serde).

## Доступ к параметрам запроса

В качестве примера, как получить доступ к параметрам запроса, можно рассмотреть следующий код:

```rust
use volga::{App, Query, ok};
use serde::Deserialize;

#[derive(Deserialize)]
struct Params {
    name: String,
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/hello", |params: Query<Params>| async move {
        // Здесь вы можете напрямую обращаться к полям структуры params
        ok!("Hello {}!", params.name)
    });

    app.run().await
}
```

## Тестирование API с параметрами запроса

Вы можете протестировать API, выполняя запросы с параметрами запроса:

```bash
> curl "http://localhost:7878/hello?name=John"
Hello John!

> curl "http://localhost:7878/hello?name=Jane"
Hello Jane!

> curl "http://localhost:7878/hello?name=World"
Hello World!
```

## Обработка нескольких параметров запроса

Для API, которые требуют нескольких параметров запроса, настройка выполняется аналогично:

```rust
use volga::{App, Query, ok};
use serde::Deserialize;

#[derive(Deserialize)]
struct Params {
    name: String,
    age: u32,
    email: String,
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/hello", |params: Query<Params>| async move {
        // Здесь вы можете напрямую обращаться к полям структуры params
        ok!("Hello {} (email: {})! Your age is: {}", params.name, params.email, params.age)
    });

    app.run().await
}
```

Пример запроса с несколькими параметрами:

```bash
> curl "http://localhost:7878/hello?name=John&age=33&email=john@email.com"
Hello John (email: john@email.com)! Your age is: 33
```

## Обработка опциональных параметров

В приведенном выше примере, если выполнить запрос без указания одного из параметров (например, `email`), сервер вернет ошибку `400 BAD REQUEST`:

```bash
> curl "http://localhost:7878/hello?name=John&age=33"

< HTTP/1.1 400 BAD REQUEST
Query parsing error: missing field `email`
```

Однако, если необходимо сделать некоторые параметры необязательными, можно использовать [`Option<T>`](https://doc.rust-lang.org/std/option/), как показано ниже:

```rust
use volga::{App, Query, ok};
use serde::Deserialize;

#[derive(Deserialize)]
struct Params {
    name: String,
    age: u32,
    email: Option<String>, // email становится необязательным параметром
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/hello", |params: Query<Params>| async move {
        if let Some(email) = params.email {
            ok!("Hello {} (email: {})! Your age is: {}", params.name, email, params.age)
        } else {
            ok!("Hello {}! Your age is: {}", params.name, params.age)
        }
    });

    app.run().await
}
```

Полный пример доступен [здесь](https://github.com/RomanEmreis/volga/blob/main/examples/query_params/src/main.rs).