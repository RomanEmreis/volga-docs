# Группировка маршрутов

Волга предоставляет удобный механизм для группировки маршрутов с использованием префиксов. Это помогает более эффективно организовывать и управлять связанными конечными точками. Этого можно добиться с помощью метода [`group`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.group). 

После определения группы можно применять те же методы сопоставления (например, [`map_get`](https://docs.rs/volga/latest/volga/app/router/struct.RouteGroup.html#method.map_get) или [`map_post`](https://docs.rs/volga/latest/volga/app/router/struct.RouteGroup.html#method.map_post)), что и в основном приложении.

### Пример использования

Пример, демонстрирующий использование групп маршрутов в приложении:

```rust compile
use volga::{App, HttpResult, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // Группирует маршруты по префиксу "/user"
    app.group("/user", |g| {
      g.map_get("/{id}", get_user);              // GET /user/{id}
      g.map_post("/create/{name}", create_user); // POST /user/create/{name}
    });

    app.run().await
}

async fn get_user(_id: i32) -> HttpResult {
    // Получаем пользователя
    ok!("John")
}

async fn create_user(name: String) -> HttpResult {
    // Создаем пользователя
    ok!("User {name} created!")
}
```

### Пояснения

- **Группировка**:  
  Метод [`group`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.group) создает [`RouteGroup`](https://docs.rs/volga/latest/volga/app/router/struct.RouteGroup.html), с префиксом `/user`.  
- **Сопоставление методов**:  
  Внутри группы маршруты определяются с помощью таких методов, как [`map_get`](https://docs.rs/volga/latest/volga/app/router/struct.RouteGroup.html#method.map_get) и [`map_post`](https://docs.rs/volga/latest/volga/app/router/struct.RouteGroup.html#method.map_post). Они работают так же, как и в основном объекте приложения, но наследуют префикс, определенный для группы.

## Настройки уровня группы

Группа — это **скоуп**: всё, что она держит — middleware (`wrap`, `with`, `filter`, `map_ok`, `map_err`, `tap_req`, `attach`), политика CORS, ограничение частоты, `authorize`, метаданные OpenAPI — применяется ко всем зарегистрированным группой маршрутам, в каком бы порядке это ни было написано внутри замыкания.

```rust compile
use volga::{App, HttpResult, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.group("/admin", |g| {
        g.map_get("/report", report);

        // Дойдёт и до /admin/report, хотя написано ниже него
        g.filter(|| async { true });
    });

    app.run().await
}

async fn report() -> HttpResult {
    ok!("report")
}
```

::: warning При переходе с 0.9.x
Конфигурация группы считывалась в момент каждого вызова `map_*`, поэтому то, что зарегистрировано *ниже* маршрута, до него не доходило. Теперь она доходит до каждого маршрута: маршрут, замапленный выше `authorize` или `token_bucket` своей группы, отвечает `401` / `403` / `429` там, где отвечал `200`.
:::

### Правила порядка

* Middleware по-прежнему **выполняется** в порядке регистрации.
* Middleware группы выполняется раньше, чем middleware маршрута или вложенной группы внутри неё — внешний скоуп всегда оборачивает внутренний.
* Вложенная группа наследует настройки родителя независимо от того, где она объявлена.
* Политика CORS, выбранная самим маршрутом или вложенной группой, **не** заменяется политикой внешней группы.

```rust compile
use volga::{App, HttpResult, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.group("/api", |api| {
        api.filter(|| async { true });     // выполнится первым

        api.group("/v1", |v1| {
            v1.filter(|| async { true });  // выполнится вторым

            v1.map_get("/ping", ping)
                .filter(|| async { true }); // выполнится третьим
        });
    });

    app.run().await
}

async fn ping() -> HttpResult {
    ok!("pong")
}
```

## Fallback группы

Начиная с **0.11.1** группа может отвечать за свою часть адресного пространства. Метод [`map_fallback()`](https://docs.rs/volga/latest/volga/app/router/struct.RouteGroup.html#method.map_fallback) у [`RouteGroup`](https://docs.rs/volga/latest/volga/app/router/struct.RouteGroup.html) обрабатывает запрос под префиксом группы, на который не замаплен ни один маршрут, — с любым методом. Это [`App::map_fallback()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_fallback) для одной ветки дерева:

```rust compile
use volga::{App, http::Uri, not_found, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.group("/api", |api| {
        api.map_get("/models", || async { ok!("models") });

        // GET /api/nope, POST /api/v1/whatever, DELETE /api  -> этот обработчик
        // POST /api/models                                   -> 405, маршрут есть
        api.map_fallback(|uri: Uri| async move {
            not_found!("no endpoint at {}", uri.path())
        });
    });

    app.run().await
}
```

Роутер разрешает его так же, как разрешает маршруты, поэтому запоминать отдельное правило не нужно:

* **Побеждает самый специфичный префикс.** Fallback группы `/api` отвечает на `/api/nope` раньше всего, что замаплено под `/` — маршрута `/{*path}` или оболочки SPA, раздаваемой из корня, — а fallback группы `/api/v2` отвечает раньше, чем fallback группы `/api`.
* **Маршрут всё равно отвечает первым.** Маршрут, замапленный на путь, к которому адресован запрос, отвечает на него для своего метода, а запрос с другим методом получает `405` этого маршрута со списком методов, которые у него есть. Это верно и для самого префикса.
* **Middleware и политика CORS группы оборачивают его**, вместе с middleware всех групп вокруг. Неизвестный путь под группой с `authorize` отклоняется так же, как известный, а не сообщает вызывающему, какие пути существуют.

Обработчик принимает то же, что и `App::map_fallback`, — всё, что реализует [`FromRequestParts`](https://docs.rs/volga/latest/volga/http/endpoints/args/trait.FromRequestParts.html), — а путь, к которому был адресован запрос, читается из `Uri`. Кроме того, он связывает параметры, объявленные его префиксом, и только их — одинаково на самом префиксе и под ним:

```rust compile
use volga::{App, NamedPath, not_found, ok};
use serde::Deserialize;

#[derive(Deserialize)]
struct Tenant {
    tenant: String,
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.group("/tenants/{tenant}", |g| {
        g.map_get("/users", || async { ok!("users") });

        // Читает {tenant} и для /tenants/acme, и для /tenants/acme/nope, и для /tenants/acme/a/b
        g.map_fallback(|params: NamedPath<Tenant>| async move {
            not_found!("tenant {} has no such endpoint", params.tenant)
        });
    });

    app.run().await
}
```

Под префиксом, который заканчивается catch-all-параметром — `group("/files/{*path}", ..)`, — fallback отвечает на всё, что читает этот catch-all, и связывает значение под тем именем, которое дал префикс.

Fallback группы — не маршрут: он не печатается вместе с маршрутами при старте, не описывается в OpenAPI, а [`matched_route()`](https://docs.rs/volga/latest/volga/middleware/struct.HttpContext.html#method.matched_route) для обработанного им запроса возвращает `false` — поэтому CORS preflight на путь, который отвечает только он, не обрабатывается так, будто там есть эндпоинт. Повторный маппинг fallback на том же префиксе заменяет предыдущий.

::: tip Когда это нужно
Когда API и одностраничное приложение живут на одном сервере. Оболочка раздаётся под `/` и превращает любой неизвестный путь в приложение — это правильно для `/settings` и неправильно для `/api/uesrs`: клиент просил JSON, а получил HTML. `map_fallback` на группе `/api` даёт этой половине адресного пространства ответ, который её клиенты умеют разбирать, и роутер предпочтёт его как более глубокий. Оформляйте его так же, как остальные ошибки API — тем же телом [Problem Details](/volga-docs/ru/reliability-observability/errors.html#problem-details), с теми же полями, — и вызывающий обработает неверный путь тем же кодом, который у него уже есть для неверного payload'а.
:::

## Один маршрут — одна регистрация

Маршрут регистрируется под тем именем, которое читает роутер, поэтому `/x`, `/x/` и `//x` — это один маршрут везде, где он запоминается, а не только в дереве маршрутов. Группа настраивает каждый свой маршрут один раз — независимо от того, замаплен ли он ею дважды или ещё раз вложенной группой.

Повторный маппинг уже замапленного маршрута **заменяет** его вместе со всем, что было привязано к заменяемой регистрации. Обработчик и его middleware пишутся вместе — вместе они и живут. Операция OpenAPI строится из той конфигурации, которую маршрут держит сейчас.

:::warning
Префикс группы — такой же шаблон маршрута, как любой другой, поэтому он участвует в [правилах именования параметров](/volga-docs/ru/getting-started/route-params.html#именование-параметров-принадлежит-маршруту): `group("/{tenant}", ..)` рядом с `map_get("/{id}/items", ..)` — это один маршрут под двумя именами, и это приводит к панике при регистрации.
:::

Больше примеров можно найти [здесь](https://github.com/RomanEmreis/volga/blob/main/examples/route_groups/src/main.rs).
