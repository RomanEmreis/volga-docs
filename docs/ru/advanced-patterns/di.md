# Внедрение Зависимостей

Волга поддерживает мощный механизм внедрения зависимостей (Dependency Injection, DI) с тремя жизненными циклами: **Singleton**, **Scoped** и **Transient**.

Если вы не используете функцию `full`, то, включите функцию `di`, либо переключитесь на `full` в вашем `Cargo.toml`:

```toml
[dependencies]
volga = { version = "...", features = ["di"] }
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

#[derive(Clone)]
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
Тип `T` должен реализовывать типажи [`Send`](https://doc.rust-lang.org/std/marker/trait.Send.html) и [`Sync`](https://doc.rust-lang.org/std/marker/trait.Sync.html).
:::

### Scoped
**Scoped** зависимость создает новый экземпляр для каждого HTTP-запроса. Экземпляр существует только в течение обработки запроса, обеспечивая изоляцию между запросами.

#### Пример: Scoped

```rust
use volga::{App, di::{Container, Dc, Error, Inject}, ok, not_found};
use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
};

#[derive(Clone, Default)]
struct InMemoryCache {
    inner: Arc<Mutex<HashMap<String, String>>>,
}

impl Inject for InMemoryCache {
    fn inject(_container: Container) -> Result<Self, Error> {
        Ok(Self { inner: Default::default() })
    }
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

#### Регистрация с помощью `Default` или фабрики

Чтобы использовать метод [`add_scoped::<T>()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.add_scoped), тип должен реализовывать типаж [`Inject`](https://docs.rs/volga/latest/volga/di/inject/trait.Inject.html). Это удобный и мощный подход, когда ваш тип зависит от других сервисов, зарегистрированных в контейнере зависимостей.

Однако, если у типа нет зависимостей, вы можете зарегистрировать его напрямую, используя фабрику:

```rust
#[derive(Clone)]
struct InMemoryCache {
    inner: Arc<Mutex<HashMap<String, String>>>,
}

// Регистрация Scoped-сервиса с помощью фабрики
app.add_scoped_factory(|| InMemoryCache {
    inner: Default::default(),
});
```
::: tip
Вы так же можете использовать [`Dc<T>`](https://docs.rs/volga/latest/volga/di/dc/struct.Dc.html) или [`Container`](https://docs.rs/volga/latest/volga/di/struct.Container.html) в качестве аргументов фабрики для гибкости и лучшего контроля над разрешением зависимостей.
:::

Если тип реализует [`Default`](https://doc.rust-lang.org/std/default/trait.Default.html), вы можете упростить это ещё больше, используя [`add_scoped_default::<T>()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.add_scoped_default):

```rust
#[derive(Default, Clone)]
struct InMemoryCache {
    inner: Arc<Mutex<HashMap<String, String>>>,
}

app.add_scoped_default::<InMemoryCache>();
```

### Transient

**Transient** зависимость создаёт **новый экземпляр каждый раз при её разрешении**, независимо от области действия или контекста запроса. Вы можете зарегистрировать такую службу одним из следующих способов:

* [`add_transient::<T>()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.add_transient)
* [`add_transient_factory::<T>()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.add_transient_factory)
* [`add_transient_default::<T>()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.add_transient_default)

Поведение аналогично **Scoped**, с ключевым отличием: **новый экземпляр создаётся для каждого внедрения**, а не один раз для каждого запроса или области действия.

## Использование DI в middleware
Чтобы внедрить зависимость в middleware, в случае использования [`with()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.with) можно воспользоваться структурой [`Dc`](https://docs.rs/volga/latest/volga/di/dc/struct.Dc.html) аналогично использованию в обработчиках запросов. Для [`wrap()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.wrap) используйте метод [`resolve::<T>()`](https://docs.rs/volga/latest/volga/middleware/http_context/struct.HttpContext.html#method.resolve), либо [`resolve_shared::<T>`](https://docs.rs/volga/latest/volga/middleware/http_context/struct.HttpContext.html#method.resolve_shared) структуры [`HttpContext`](https://docs.rs/volga/latest/volga/middleware/http_context/struct.HttpContext.html).
Основное различие между ними заключается в том, что первый метод требует реализации типажа [`Clone`](https://doc.rust-lang.org/std/clone/trait.Clone.html) для `T`, тогда как последний просто возвращает [`Arc<T>`](https://doc.rust-lang.org/std/sync/struct.Arc.html).

```rust
// Пример .wrap()
app.wrap(|ctx: HttpContext, next: NextFn| async move {
    let cache = ctx.resolve::<InMemoryCache>()?;
    // Выполнить действия...
    next(ctx).await
});

// Пример .with()
app.with(|cache: Dc<InMemoryCache>, next: Next| async move {
    // Выполнить действия...
    next.await
});
```

## Итог
- **Singleton**: Общий экземпляр на весь жизненный цикл приложения.
- **Scoped**: Новый экземпляр для каждого HTTP-запроса.
- **Transient**: Новый экземпляр при каждом запросе к контейнеру.

Более сложные примеры можно найти [здесь](https://github.com/RomanEmreis/volga/blob/main/examples/dependency_injection/src/main.rs).