# Параметры маршрута

Волга предоставляет мощные возможности маршрутизации, позволяя использовать динамические маршруты с параметрами. Аргумент обработчика, тип которого реализует [`FromPathArg`](https://docs.rs/volga/latest/volga/http/endpoints/args/trait.FromPathArg.html), читается прямо из пути: примитивы, `String`, адреса из `std::net`, `PathBuf`, а с feature `uuid` — и [`Uuid`](https://docs.rs/uuid/latest/uuid/struct.Uuid.html), — а также [ваши собственные типы](#параметры-собственных-типов).

## Пример: Один параметр

Вот как настроить простой динамический маршрут, который приветствует пользователя по имени:

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
[`Path<T>`](https://docs.rs/volga/latest/volga/http/endpoints/args/path/struct.Path.html) читает параметры по позиции в одно значение: в кортеж — в том порядке, в каком их объявляет маршрут, или, начиная с **0.13.0**, в один тип — на маршруте, который объявляет ровно один параметр:
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
`Path<u32>` на маршруте с двумя параметрами отвечает `500`: он никогда не берёт первый из нескольких, поэтому `Path<OrderId>` на `/users/{user_id}/orders/{order_id}` не прочитает идентификатор пользователя как идентификатор заказа. Такой маршрут читайте кортежем, `Path<(u64, OrderId)>`, или по именам через [`NamedPath<T>`](#использование-namedpath-t).

То же правило действует и для обычных аргументов: обработчик, который принимает больше позиционных параметров, чем объявляет его маршрут, отвечает `500`, а лишний `Option<T>` читается как `None`.
:::

Структура с именованными полями — это не `Path<T>`: она читается через `NamedPath<T>`, и ошибка компиляции для `Path<MyStruct>` прямо об этом говорит.

## Параметры собственных типов
Начиная с **0.13.0** любой тип становится параметром пути, если реализует [`FromPathArg`](https://docs.rs/volga/latest/volga/http/endpoints/args/trait.FromPathArg.html). [`PathArg::parse`](https://docs.rs/volga/latest/volga/http/endpoints/args/struct.PathArg.html#method.parse) читает значение через `FromStr` и отвечает `400`, если оно не разбирается, поэтому для newtype хватает одной строки:
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
    app.map_get("/orders/{id}", |id: OrderId| ok!("order {}", id.0));

    // GET /users/7/orders/42
    app.map_get(
        "/users/{user_id}/orders/{order_id}",
        |Path((user, order)): Path<(u64, OrderId)>| ok!("order {} of user {user}", order.0),
    );

    app.run().await
}
```

Такой тип подходит везде, где подходит встроенный: как отдельный аргумент обработчика, как элемент кортежа `Path<(..)>` или как `T` в `Path<T>`.

Помимо `parse`, [`PathArg`](https://docs.rs/volga/latest/volga/http/endpoints/args/struct.PathArg.html) даёт имя параметра `name()` — так, как его записывает шаблон маршрута, — и его значение `value()`, уже [декодированное](#как-декодируются-значения-параметров). Собственная проверка возвращает любую подходящую ошибку — здесь это `400` с именем параметра:
```rust compile
use volga::{App, error::Error, ok};
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
    app.map_get("/posts/{slug}", |slug: Slug| ok!("post {}", slug.0));

    app.run().await
}
```

::: tip
Одиночный параметр собственного типа можно [валидировать](/volga-docs/ru/requests-responses/validation.html#валидация-параметра-пути) как `Valid<Path<T>>`, если он реализует ещё и `Validate`. Пусть `FromPathArg` отвечает только за *чтение* значения, а `Validate` — за правила, которым оно должно соответствовать.
:::

### `Uuid`
Feature `uuid`, входящая в `full`, делает [`uuid::Uuid`](https://docs.rs/uuid/latest/uuid/struct.Uuid.html) параметром пути. Volga не реэкспортирует этот тип, поэтому добавьте и крейт `uuid`:
```toml
[dependencies]
volga = { version = "0.13", features = ["uuid"] }
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

### Чтение всех параметров сразу
`Path<T>` читает свой `T` через [`FromPathArgs`](https://docs.rs/volga/latest/volga/http/endpoints/args/trait.FromPathArgs.html), а [`PathArgs`](https://docs.rs/volga/latest/volga/http/endpoints/args/struct.PathArgs.html) перебирает параметры в том порядке, в каком их объявляет маршрут, поэтому тип может прочитать сразу несколько:
```rust compile
use volga::{App, Path, error::Error, ok};
use volga::http::endpoints::args::{FromPathArgs, PathArgs};

struct Range {
    from: u32,
    to: u32,
}

impl FromPathArgs for Range {
    fn from_path_args(args: &PathArgs) -> Result<Self, Error> {
        let mut args = args.iter();
        match (args.next(), args.next(), args.next()) {
            (Some(from), Some(to), None) => Ok(Range { from: from.parse()?, to: to.parse()? }),
            _ => Err(Error::server_error("`Range` reads exactly two path parameters")),
        }
    }
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // GET /pages/3/7
    app.map_get("/pages/{from}/{to}", |Path(range): Path<Range>| {
        ok!("pages {} to {}", range.from, range.to)
    });

    app.run().await
}
```
Маршрут, который не объявляет того, что читает тип, — это ошибка в коде, а не в запросе, поэтому пример отвечает на неё `500`, как и `Path<T>` одного типа.

## Использование `NamedPath<T>`

Кроме того, вы можете использовать [`NamedPath<T>`](https://docs.rs/volga/latest/volga/http/endpoints/args/path/struct.NamedPath.html), чтобы обернуть параметры маршрута в специализированную структуру. Где `T` — это либо десериализуемая структура, либо `HashMap`. Убедитесь, что у вас установлена библиотека [serde](https://crates.io/crates/serde):

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
        // Здесь вы можете напрямую обращаться к полям структуры
        ok!("Hello {}! You're age is: {}!", user.name, user.age)
    });

    app.run().await
}
```

## Именование параметров принадлежит маршруту

Каждый эндпоинт несёт те имена параметров, с которыми был написан **его собственный** шаблон, и приходящий к нему запрос размечается именно ими. Два маршрута через одну позицию могут называть её по-разному: параметр сопоставляется по позиции, а имя, по которому его читает обработчик, — всегда имя его собственного маршрута.

```rust compile
use volga::{App, NamedPath, HttpResult, ok};
use std::collections::HashMap;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/users/{id}", by_id);
    app.map_post("/users/{name}", by_name); // свяжет `name`, а не `id`

    app.run().await
}

async fn by_id(NamedPath(p): NamedPath<HashMap<String, String>>) -> HttpResult {
    ok!("{:?}", p.get("id"))
}

async fn by_name(NamedPath(p): NamedPath<HashMap<String, String>>) -> HttpResult {
    ok!("{:?}", p.get("name"))
}
```

### Два случая, приводящих к панике при регистрации

Два написания различить таким образом нельзя, поэтому о них сообщается там, где они написаны. Оба приводят к панике при регистрации, называя оба шаблона с их методами и то, что следует написать вместо этого:

* **Один метод, дважды именующий свой же маршрут** — `map_get("/users/{id}", ..)`, а следом `map_get("/users/{name}", ..)`. Вторая регистрация заменяет первую и забирает её middleware: замапленным оказывается один маршрут вместо двух, а различающееся имя говорит, что задумывалось не это.
* **Расхождение между `GET` и `HEAD`.** Запрос `HEAD`, у которого нет своего маршрута, обрабатывается маршрутом `GET` (RFC 9110 §9.3.2), поэтому они описывают один ресурс и не могут по-разному называть то, что его идентифицирует.

Любой другой метод волен называть позицию как угодно, а два маршрута одного метода, расходящиеся на позиции — `/users/{id}/posts` рядом с `/users/{name}/comments` — никогда не встречаются на одном эндпоинте и тоже сохраняют свои имена. Префикс группы учитывается так же, будучи таким же шаблоном маршрута, как любой другой.

### В документе OpenAPI

OpenAPI 3.0 допускает один шаблонный путь на позицию, поэтому начиная с **0.11.2** маршруты, по-разному называющие одну позицию, описываются в каждом [документе OpenAPI](/volga-docs/ru/middleware-infrastructure/openapi.html) под одним путём: тем, которым записано большинство маршрутов в нём, а при равенстве — первым по алфавиту. `GET /users/{id}` и `POST /users/{name}` становятся путём `/users/{id}` с двумя операциями, и параметр операции `POST` называется там `id`.

Клиент этого не замечает — параметр пути передаётся и читается по позиции, — но документ больше не показывает имя, по которому читает обработчик, поэтому debug-сборка сообщает о каждом переименованном маршруте при запуске.

::: tip
Называйте параметр одинаково на всех маршрутах через одну позицию — и каждый маршрут будет описан под своими именами. Разные имена стоит оставлять только там, где обработчики действительно читают разное.
:::

## Литерал не заслоняет параметр

Маршруты сопоставляются посегментно, и там, где подходят и литерал, и параметр, побеждает литерал. Но это *не* значит, что побеждает литерал, ведущий в никуда: если начатый им путь не приводит ни к одному маршруту, поиск возвращается к ближайшему пройденному параметру и продолжает оттуда.

```rust compile-fragment
app.map_get("/files/{name}", || async { ok!("by name") });
app.map_get("/files/shared/latest", || async { ok!("the shared one") });
```

`GET /files/shared/latest` — это литеральный маршрут. `GET /files/shared` — нет: `/files/shared` сам по себе не именует никакого маршрута, поэтому поиск откатывается назад, и запрос обрабатывает `/files/{name}` с `name = "shared"`.

Литерал по-прежнему имеет приоритет везде, где он *действительно* ведёт к маршруту, а литерал с обработчиком для другого метода по-прежнему отвечает `405`, а не проваливается в параметр. Каждый узел посещается не более одного раза, поэтому там, где откатов не бывает, за них никто не платит.

## Catch-all параметры

Начиная с **v0.11.0** последний сегмент маршрута может быть catch-all параметром `{*name}`, который связывает весь остаток пути одним значением:

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
* **Значение — это весь остаток пути**, от первого прочитанного сегмента до конца, включая разделители и завершающий `/`: `GET /files/a/b/` связывает `"a/b/"`. Он [декодируется](#как-декодируются-значения-параметров) целиком, поэтому `GET /files/a%2Fb/c` связывает `"a/b/c"`.
* **У него наименьший приоритет.** На каждой позиции сначала читается литерал, затем параметр, и только потом catch-all; выбор между двумя маршрутами решает первая позиция, на которой они различаются, в каком бы порядке их ни зарегистрировали.
* **Он всегда последний сегмент.** Маршрут, продолжающийся после него, — включая маршрут внутри группы, префикс которой заканчивается catch-all, — вызывает панику при регистрации.
* **Он именуется как любой другой параметр**, и [два случая, приводящих к панике при регистрации](#два-случая-приводящих-к-панике-при-регистрации), относятся к нему точно так же.

```rust compile-fragment
app.map_get("/api/users/{id}", |id: u32| async move { id.to_string() });
app.map_get("/assets/{*path}", |path: String| async move { path });
app.map_get("/{lang}/{page}", |lang: String, page: String| async move { format!("{lang}/{page}") });
app.map_get("/{*path}", |path: String| async move { path });

// GET /api/users/7        -> /api/users/{id}
// GET /assets/app.js      -> /assets/{*path}, а не /{lang}/{page}
// GET /en/home            -> /{lang}/{page}
// GET /api/users/7/extra  -> /{*path}, ничто другое не читает его целиком
```

::: warning Catch-all — не безопасный путь в файловой системе
Значение никак не нормализуется, поэтому сегмент `..` доходит до обработчика в том виде, в каком его прислали: `GET /files/../../etc/passwd` связывает `"../../etc/passwd"`. Обработчик, который присоединяет значение к каталогу, должен сам отклонять `..`, корень и префикс диска либо разрешать полученный путь и проверять, что он всё ещё внутри этого каталога. Для раздачи файлов с диска используйте [`use_static_files()`](/volga-docs/ru/middleware-infrastructure/static-files.html) — она делает это за вас.
:::

В документе OpenAPI catch-all описывается как параметр пути `{name}`. Catch-all рядом с параметрическим маршрутом того же метода на той же позиции — `/files/{name}` и `/files/{*path}` — дал бы там один и тот же шаблонный путь, поэтому, если оба привязаны к одному документу, в нём описывается параметрический маршрут, а catch-all опускается с предупреждением при запуске в debug-сборке. Для разных методов — `GET /files/{*path}` рядом с `POST /files/{id}` — описываются оба, под одним путём, как [выше](#в-документе-openapi).

## Как декодируются значения параметров

Начиная с **0.13.0** маршрутизатор один раз декодирует percent-escape-последовательности в пути, посегментно, и каждый экстрактор читает уже декодированное значение — обычный аргумент, тип с `FromPathArg`, `Path<T>` и `NamedPath<T>` одинаково:

| Запрос | `/users/{name}` связывает |
|---|---|
| `GET /users/John%20Doe` | `"John Doe"` |
| `GET /users/100%25` | `"100%"` |
| `GET /users/caf%C3%A9` | `"café"` |
| `GET /users/C++` | `"C++"` — `+` в пути означает плюс, а не пробел |
| `GET /users/a&admin=true` | `"a&admin=true"` — одно значение, без разбиения |
| `GET /users/a%2Fb` | `"a/b"` |

Число декодируется до разбора, поэтому `%31`, прочитанное в `u32`, — это `1`.

* **`%2F` никогда не делит сегмент.** Он декодируется в `/` внутри своего сегмента: `GET /users/a%2Fb` попадает в `/users/{name}` со значением `"a/b"` и никогда не попадает в маршрут `/users/a/b`. Catch-all декодируется целиком, поэтому `GET /files/a%2Fb/c` связывает `"a/b/c"`.
* **Путь, который не декодируется, получает `400`** — некорректная escape-последовательность (`%zz`, `%2` в конце) или последовательность, которая не декодируется в UTF-8 (`%FF`). Ответ даётся ещё до поиска маршрута и, как и `404`, проходит через глобальный middleware и [обработчик ошибок](/volga-docs/ru/reliability-observability/errors.html), так что его оформляют `map_err` и problem details.
* **Исходный путь никуда не девается.** URI запроса хранит путь ровно в том виде, в каком его прислали, — для обработчика или middleware, которым он нужен.

::: warning Значение уже декодировано
`%2E%2E` приходит как `..`, а `%2F` — как `/`, поэтому даже одиночный параметр может содержать разделитель. Проверяйте то значение, которое получает обработчик, — например, отклоняя `..` или `/` в имени файла, — и не декодируйте его повторно после проверки: `%252F` пройдёт проверку как `%2F` и лишь потом превратится в `/`.
:::

### Литеральные сегменты записываются как текст

Литерал тоже сравнивается с декодированным путём, поэтому записывайте его тем текстом, который он означает: `/lit/a b` или `/café` — клиент пришлёт их как `/lit/a%20b` и `/caf%C3%A9`. Литерал с percent-escape-последовательностью — `app.map_get("/lit/a%20b", ..)` — вызывает панику при регистрации, ведь он мог бы совпасть только с `a%2520b`. Точно так же проверяются префикс группы и префикс [раздачи статических файлов](/volga-docs/ru/middleware-infrastructure/static-files.html#разбор-пути).

::: warning Обновление с 0.12
До 0.13.0 позиционный экстрактор читал значение в том виде, в каком оно было записано, вместе с escape-последовательностями. Обработчик, который сам декодировал параметры `String`, теперь декодирует их дважды: `100%25` приходит как `100%`, и повторное декодирование завершается ошибкой. Уберите лишнее декодирование. Путь с некорректной escape-последовательностью, который `String` и `Path<T>` раньше принимали, теперь получает `400`.
:::

Полный пример доступен по [ссылке](https://github.com/RomanEmreis/volga/blob/main/examples/route_params/src/main.rs).