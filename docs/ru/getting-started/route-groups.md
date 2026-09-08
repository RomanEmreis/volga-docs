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

::: warning Изменено в 0.10.0
Раньше группа считывала свои middleware, политику CORS и конфигурацию OpenAPI в момент каждого вызова `map_*`, поэтому `g.with(require_api_key)`, написанный *ниже* маршрута, до него молча не доходил — а группа обычно несёт именно авторизацию, ограничение частоты или CORS. В 0.9.11 появилось предупреждение об этом; в 0.10.0 сама проблема устранена: группа применяет то, что держит, когда её замыкание завершилось, а вместе с этим исчезло и предупреждение `RouteGroup::<method> must be called before any map_* in the group`.

**Это значит, что middleware, который раньше пропускался, теперь выполняется — отключить это нельзя.** Маршрут, замапленный до `authorize` или `token_bucket` своей группы, вёл себя так, будто их нет, а теперь отвечает `401` / `403` / `429` там, где отвечал `200`.
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

## Один маршрут — одна регистрация

Начиная с 0.10.0 маршрут регистрируется под тем именем, которое читает роутер, поэтому `/x`, `/x/` и `//x` — это один маршрут везде, где он запоминается, а не только в дереве маршрутов. Группа настраивает каждый свой маршрут один раз — независимо от того, замаплен ли он ею дважды или ещё раз вложенной группой.

Повторный маппинг уже замапленного маршрута **заменяет** его вместе со всем, что было привязано к заменяемой регистрации. Раньше обе регистрации попадали на один эндпоинт, и результат не соответствовал ни одной из них: отвечал обработчик, замапленный последним, а выполнялся middleware того, что был замаплен первым. Обработчик и его middleware пишутся вместе — теперь они вместе и живут. Операция OpenAPI строится из той конфигурации, которую маршрут держит сейчас.

:::warning
Префикс группы — такой же шаблон маршрута, как любой другой, поэтому он участвует в [правилах именования параметров](/volga-docs/ru/getting-started/route-params.html#именование-параметров-принадлежит-маршруту): `group("/{tenant}", ..)` рядом с `map_get("/{id}/items", ..)` — это один маршрут под двумя именами, и это приводит к панике при регистрации.
:::

Больше примеров можно найти [здесь](https://github.com/RomanEmreis/volga/blob/main/examples/route_groups/src/main.rs).
