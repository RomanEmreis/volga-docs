# Параметры маршрута

Маршрут объявляет параметры в фигурных скобках, `/users/{id}`, а обработчик получает их значения аргументами. Встроенные типы читаются прямо из пути: примитивы, `String`, адреса из `std::net`, `PathBuf`, а с фичей `uuid` и [`Uuid`](#uuid). Значение, которое не разбирается в тип аргумента, получает `400` ещё до вызова обработчика.

## Один параметр

```rust compile
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

```bash
> curl "http://localhost:7878/hello/world"
Hello world!
```

## Несколько параметров

```rust compile
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

```bash
> curl "http://localhost:7878/hello/beautiful/world"
Hello beautiful world!
```

::: warning Параметры читаются по позиции
Каждый аргумент берёт следующий параметр, объявленный маршрутом, как бы тот ни назывался. Для `/hello/{descr}/{name}` обработчик выглядит как `|descr: String, name: String|`; если поменять аргументы местами, поменяются и значения. Обработчик, который читает больше параметров, чем объявляет маршрут, [вызывает панику при регистрации](/volga-docs/ru/reference/routing.html#обработчик-читает-только-то-что-объявляет-маршрут).
:::

## Использование `Path<T>`

[`Path<T>`](https://docs.rs/volga/latest/volga/http/endpoints/args/path/struct.Path.html) читает параметры по позиции в одно значение: в кортеж, в том порядке, в каком их объявляет маршрут, или в один тип на маршруте, который объявляет ровно один параметр:

```rust compile
use volga::{App, Path, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // GET /hello/beautiful/world
    app.map_get("/hello/{descr}/{name}", |Path((descr, name)): Path<(String, String)>| {
        ok!("Hello {descr} {name}!")
    });

    // GET /users/42
    app.map_get("/users/{id}", |Path(id): Path<u32>| ok!("user {id}"));

    app.run().await
}
```

::: warning `Path<T>` одного типа читает ровно один параметр
`Path<u32>` на маршруте с двумя параметрами отклоняется там, где его регистрируют: он никогда не берёт первый из нескольких, поэтому `Path<OrderId>` на `/users/{user_id}/orders/{order_id}` не прочитает идентификатор пользователя как идентификатор заказа. Такой маршрут читайте кортежем, `Path<(u64, OrderId)>`, или по именам через [`NamedPath<T>`](#использование-namedpath-t).
:::

Структура с именованными полями не может быть `Path<T>`. Она читается через `NamedPath<T>`, и ошибка компиляции для `Path<MyStruct>` прямо об этом говорит.

## Использование `NamedPath<T>`

[`NamedPath<T>`](https://docs.rs/volga/latest/volga/http/endpoints/args/path/struct.NamedPath.html) читает параметры по именам в структуру или в `HashMap`. Структура выводит `Deserialize`, поэтому проекту нужен [serde](https://crates.io/crates/serde):

```rust compile
use volga::{App, NamedPath, ok};
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
    app.map_get("/hello/{name}/{age}", |user: NamedPath<User>| async move {
        ok!("Hello {}! Your age is: {}!", user.name, user.age)
    });

    app.run().await
}
```

Обработчик читает параметры своего маршрута одним из этих способов. Позиционные аргументы рядом с `Path<T>` или `NamedPath<T>` не компилируются.

## Необязательный сегмент

`Option<T>` читает `None` там, где у маршрута не осталось параметров, поэтому один обработчик может обслуживать маршрут с сегментом и без него:

```rust compile-fragment
let posts = |page: Option<u32>| ok!("{page:?}");
app.map_get("/posts", posts);        // None
app.map_get("/posts/{page}", posts); // Some(3)
```

## Параметры собственных типов

Любой тип становится параметром пути, если реализует [`FromPathArg`](https://docs.rs/volga/latest/volga/http/endpoints/args/trait.FromPathArg.html). [`PathArg::parse`](https://docs.rs/volga/latest/volga/http/endpoints/args/struct.PathArg.html#method.parse) читает значение через `FromStr` и отвечает `400`, если оно не разбирается, поэтому для newtype хватает одной строки:

```rust compile
use volga::{App, Path, error::Error, ok};
use volga::http::endpoints::args::{FromPathArg, PathArg};

struct OrderId(u64);

impl FromPathArg for OrderId {
    fn from_path_arg(arg: &PathArg) -> Result<Self, Error> {
        arg.parse().map(OrderId)
    }
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // GET /orders/42
    app.map_get("/orders/{id}", |Path(id): Path<OrderId>| ok!("order {}", id.0));

    // GET /users/7/orders/42
    app.map_get(
        "/users/{user_id}/orders/{order_id}",
        |Path((user, order)): Path<(u64, OrderId)>| ok!("order {} of user {user}", order.0),
    );

    app.run().await
}
```

Такой тип читается через `Path<T>`: как его `T` или как элемент кортежа `Path<(..)>`. Необязательный записывается как `Option<Path<OrderId>>`. В отличие от встроенного типа, сам по себе он не аргумент обработчика, так что по вызову видно, откуда берётся значение. Голый собственный тип в сигнатуре обработчика это [собственный экстрактор](/volga-docs/ru/advanced-patterns/custom-extractors.html).

Помимо `parse`, [`PathArg`](https://docs.rs/volga/latest/volga/http/endpoints/args/struct.PathArg.html) даёт имя параметра `name()`, так, как его записывает шаблон маршрута, и его значение `value()`, уже [декодированное](#значения-приходят-декодированными). Собственная проверка возвращает любую подходящую ошибку, здесь это `400` с именем параметра:

```rust compile
use volga::{App, Path, error::Error, ok};
use volga::http::endpoints::args::{FromPathArg, PathArg};

struct Slug(String);

impl FromPathArg for Slug {
    fn from_path_arg(arg: &PathArg) -> Result<Self, Error> {
        let value = arg.value();
        let valid = !value.is_empty()
            && value.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-');

        if !valid {
            return Err(Error::client_error(format!("`{}` is not a valid slug", arg.name())));
        }
        Ok(Slug(value.to_owned()))
    }
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // GET /posts/hello-world
    app.map_get("/posts/{slug}", |Path(slug): Path<Slug>| ok!("post {}", slug.0));

    app.run().await
}
```

::: tip
Одиночный параметр собственного типа можно [валидировать](/volga-docs/ru/requests-responses/validation.html#валидация-параметра-пути) как `Valid<Path<T>>`, если он реализует ещё и `Validate`. Пусть `FromPathArg` отвечает только за *чтение* значения, а `Validate` за правила, которым оно должно соответствовать.
:::

Тип, который читает сразу несколько параметров, реализует вместо этого `FromPathArgs`, см. [Чтение всех параметров сразу](/volga-docs/ru/reference/routing.html#чтение-всех-параметров-сразу).

### `Uuid`

Фича `uuid`, входящая в `full`, делает [`uuid::Uuid`](https://docs.rs/uuid/latest/uuid/struct.Uuid.html) параметром пути. Волга не реэкспортирует этот тип, поэтому добавьте и крейт `uuid`:

```toml
[dependencies]
volga = { version = "0.15", features = ["uuid"] }
uuid = "1"
```

```rust compile
use volga::{App, Path, ok};
use uuid::Uuid;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // GET /files/0199a0f1-1111-7000-8000-000000000001
    app.map_get("/files/{id}", |id: Uuid| ok!("file {id}"));

    // GET /users/0199a0f1-1111-7000-8000-000000000001/files/0199a0f1-1111-7000-8000-000000000002
    app.map_get("/users/{user}/files/{file}", |Path((user, file)): Path<(Uuid, Uuid)>| {
        ok!("file {file} of user {user}")
    });

    app.run().await
}
```

Значение, которое не является UUID, получает `400` ещё до вызова обработчика.

## Catch-all параметры

Последний сегмент маршрута может быть catch-all параметром `{*name}`, который связывает весь остаток пути одним значением:

```rust compile
use volga::{App, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // GET /files/docs/2026/report.pdf -> path = "docs/2026/report.pdf"
    app.map_get("/files/{*path}", |path: String| async move {
        ok!("file: {path}")
    });

    app.run().await
}
```

* **Он читает хотя бы один сегмент.** `/files/{*path}` не отвечает на `/files` и `/files/`, так что на этой позиции может быть свой маршрут.
* **Значение это весь остаток пути**, включая разделители и завершающий `/`: `GET /files/a/b/` связывает `"a/b/"`.
* **Он проигрывает любому другому маршруту.** Литерал или обычный параметр на той же позиции проверяются раньше, в каком бы порядке маршруты ни зарегистрировали. Полные правила описаны в разделе [Приоритет catch-all](/volga-docs/ru/reference/routing.html#приоритет-catch-all).

::: warning Catch-all не безопасный путь в файловой системе
Значение никак не нормализуется, поэтому сегмент `..` доходит до обработчика в том виде, в каком его прислали: `GET /files/../../etc/passwd` связывает `"../../etc/passwd"`. Обработчик, который присоединяет значение к каталогу, должен сам отклонять `..`, корень и префикс диска либо разрешать полученный путь и проверять, что он всё ещё внутри этого каталога. Для раздачи файлов с диска используйте [`use_static_files()`](/volga-docs/ru/middleware-infrastructure/static-files.html), она делает это за вас.
:::

## Значения приходят декодированными

Роутер один раз декодирует percent-escape-последовательности в пути, и каждый экстрактор читает уже декодированное значение: `GET /users/John%20Doe` даёт `"John Doe"`, а `%31`, прочитанное в `u32`, это `1`. Не декодируйте значение повторно. Путь с некорректной escape-последовательностью получает `400` ещё до поиска маршрута. Подробности, в том числе во что превращаются `%2F` и `+`, описаны в разделе [Как декодируются значения параметров](/volga-docs/ru/reference/routing.html#как-декодируются-значения-параметров).

## Другие правила

Как роутер считает параметры, выбирает между пересекающимися маршрутами, именует параметры для каждого маршрута и описывает их в OpenAPI, собрано на странице [Правила маршрутизации](/volga-docs/ru/reference/routing.html). Она пригодится, когда два маршрута делят одну позицию или регистрация вызывает панику.

Полный пример доступен по [ссылке](https://github.com/RomanEmreis/volga/blob/main/examples/route_params/src/main.rs).
