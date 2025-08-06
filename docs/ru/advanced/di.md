# Внедрение Зависимостей

Волга поддерживает мощный механизм внедрения зависимостей (Dependency Injection, DI) с тремя жизненными циклами: **Singleton**, **Scoped** и **Transient**.

Если вы не используете функцию `full`, то, включите функцию `di`, либо переключитесь на `full` в вашем `Cargo.toml`:

```toml
[dependencies]
volga = { version = "0.4.5", features = ["di"] }
```

## Жизненные циклы зависимостей

### Singleton
**Singleton** обеспечивает создание и использование единственного экземпляра зависимости на протяжении всего жизненного цикла вашего веб-приложения. Этот экземпляр потокобезопасен и может использоваться одновременно в разных обработчиках.

#### Пример: Singleton

```rust
use volga::{App, di::Dc, ok, not_found};
use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
};

#[derive(Clone, Default)]
struct InMemoryCache {
    inner: Arc<Mutex<HashMap<String, String>>>,
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // Регистрация Singleton-сервиса
    app.add_singleton(InMemoryCache::default());

    // Использование общего экземпляра в обработчиках маршрутов
    app.map_get("/user/{id}", |id: String, cache: Dc<InMemoryCache>| async move {
        let user = cache.inner.lock().unwrap().get(&id);
        match user {
            Some(user) => ok!(user),
            None => not_found!("Пользователь не найден"),
        }
    });

    app.map_post("/user/{id}/{name}", |id: String, name: String, cache: Dc<InMemoryCache>| async move {
        cache.inner.lock().unwrap().insert(id, name);
        ok!()
    });

    app.run().await
}
```

В этом примере:
- Метод [`add_singleton`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.add_singleton) регистрирует `InMemoryCache` как Singleton.
- Экстрактор [`Dc<T>`](https://docs.rs/volga/latest/volga/di/dc/struct.Dc.html) разрешает зависимости по мере необходимости.
- [`Dc<T>`](https://docs.rs/volga/latest/volga/di/dc/struct.Dc.html) работает аналогично другим экстракторам, таким как [`Json<T>`](https://docs.rs/volga/latest/volga/http/endpoints/args/json/struct.Json.html) или [`Query<T>`](https://docs.rs/volga/latest/volga/http/endpoints/args/query/struct.Query.html).

::: info
Тип `T` должен реализовывать типажи [`Send`](https://doc.rust-lang.org/std/marker/trait.Send.html), [`Sync`](https://doc.rust-lang.org/std/marker/trait.Sync.html) и либо [`Default`](https://doc.rust-lang.org/std/default/trait.Default.html) или [`Singleton`](https://docs.rs/volga/latest/volga/di/derive.Singleton.html), если он не зависит от других объектов или используется готовый экземпляр.
:::

### Scoped
**Scoped** зависимость создает новый экземпляр для каждого HTTP-запроса. Экземпляр существует только в течение обработки запроса, обеспечивая изоляцию между запросами.

#### Пример: Scoped

```rust
use volga::{App, di::Dc, ok, not_found};
use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
};

#[derive(Clone, Default)]
struct InMemoryCache {
    inner: Arc<Mutex<HashMap<String, String>>>,
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // Регистрация Scoped-сервиса
    app.add_scoped::<InMemoryCache>();

    // Использование отдельного экземпляра для каждого запроса
    app.map_get("/user/{id}", |id: String, cache: Dc<InMemoryCache>| async move {
        let user = cache.inner.lock().unwrap().get(&id);
        match user {
            Some(user) => ok!(user),
            None => not_found!("Пользователь не найден"),
        }
    });

    app.map_post("/user/{id}/{name}", |id: String, name: String, cache: Dc<InMemoryCache>| async move {
        cache.inner.lock().unwrap().insert(id, name);
        ok!()
    });

    app.run().await
}
```

Основные отличия от Singleton:
- Метод [`add_scoped::<T>()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.add_scoped) регистрирует зависимость, которая создается для каждого HTTP-запроса.
- Каждый запрос имеет свой уникальный экземпляр `InMemoryCache`.

### Transient
**Transient** зависимость создает новый экземпляр при каждом запросе к контейнеру, независимо от контекста или запроса. Регистрация осуществляется с помощью метода [`add_transient::<T>()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.add_transient). Поведение похоже на Scoped, но экземпляр создается при каждом внедрении зависимости.

::: tip
Реализуя [`Default`](https://doc.rust-lang.org/std/default/trait.Default.html) вручную, вы можете управлять поведением создания экземпляров для **Scoped** и **Transient** зависимостей, а для более сложных сценариев используйте типаж [`Inject`](https://docs.rs/volga/latest/volga/di/inject/trait.Inject.html).
:::

## Использование DI в middleware
Чтобы внедрить зависимость в middleware, используйте метод [`resolve::<T>()`](https://docs.rs/volga/latest/volga/middleware/http_context/struct.HttpContext.html#method.resolve), либо [`resolve_shared::<T>`](https://docs.rs/volga/latest/volga/middleware/http_context/struct.HttpContext.html#method.resolve_shared) структуры [`HttpContext`](https://docs.rs/volga/latest/volga/middleware/http_context/struct.HttpContext.html).
Основное различие между ними заключается в том, что первый метод требует реализации типажа [`Clone`](https://doc.rust-lang.org/std/clone/trait.Clone.html) для `T`, тогда как последний просто возвращает [`Arc<T>`](https://doc.rust-lang.org/std/sync/struct.Arc.html).

```rust
app.wrap(|ctx: HttpContext, next: Next| async move {
    let cache = ctx.resolve::<InMemoryCache>()?;
    // Выполнить действия...
    next(ctx).await
});
```

## Итог
- **Singleton**: Общий экземпляр на весь жизненный цикл приложения.
- **Scoped**: Новый экземпляр для каждого HTTP-запроса.
- **Transient**: Новый экземпляр при каждом запросе к контейнеру.

Более сложные примеры можно найти [здесь](https://github.com/RomanEmreis/volga/blob/main/examples/dependency_injection/src/main.rs).