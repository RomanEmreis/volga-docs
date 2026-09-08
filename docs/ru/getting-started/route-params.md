# Параметры маршрута

Волга предоставляет мощные возможности маршрутизации, позволяя использовать динамические маршруты с параметрами. Используя аргументы функций, которые реализуют trait [`FromStr`](https://doc.rust-lang.org/std/str/trait.FromStr.html), вы можете передавать их напрямую обработчику запросов.

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

Начиная с **0.10.0** каждый эндпоинт несёт те имена параметров, с которыми был написан его собственный шаблон, и приходящий к нему запрос размечается именно ими.

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

::: warning Исправлено в 0.10.0
Узел дерева маршрутов держит единственного динамического потомка, потому что параметр сопоставляется по позиции, а не по имени — и раньше этот потомок хранил ещё и имя, то самое, с которым был написан маршрут, дошедший до этой позиции первым. Все остальные маршруты через эту позицию размечались тем же именем: `POST /users/{name}` из примера выше отвечал правильно, но связывал свой параметр как `id`, поэтому `NamedPath<T>` и всё остальное, что читает параметр по имени, читало ключ, которого никто не писал, а в списке маршрутов при старте печаталось `POST /users/{id}`.

**Обработчик, написанный под старое поведение — читающий `id` из маршрута, где написано `{name}`, — теперь не прочитает ничего.** Позиционные экстракторы (`id: i32`, `Path<(A, B)>`) имя никогда не читали, и их это не затрагивает.
:::

### Два случая, приводящих к панике при регистрации

Два написания различить таким образом нельзя, поэтому о них сообщается там, где они написаны, а не замалчивается. Оба приводят к панике при регистрации, называя оба шаблона с их методами и то, что следует написать вместо этого:

* **Один метод, дважды именующий свой же маршрут** — `map_get("/users/{id}", ..)`, а следом `map_get("/users/{name}", ..)`. Вторая регистрация заменяет первую и забирает её middleware: замапленным оказывается один маршрут вместо двух, а различающееся имя говорит, что задумывалось не это.
* **Расхождение между `GET` и `HEAD`.** Запрос `HEAD`, у которого нет своего маршрута, обрабатывается маршрутом `GET` (RFC 9110 §9.3.2), поэтому они описывают один ресурс и не могут по-разному называть то, что его идентифицирует.

Любой другой метод волен называть позицию как угодно, а два маршрута одного метода, расходящиеся на позиции — `/users/{id}/posts` рядом с `/users/{name}/comments` — никогда не встречаются на одном эндпоинте и тоже сохраняют свои имена. Префикс группы учитывается так же, будучи таким же шаблоном маршрута, как любой другой.

Полный пример доступен по [ссылке](https://github.com/RomanEmreis/volga/blob/main/examples/route_params/src/main.rs).