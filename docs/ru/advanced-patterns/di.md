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

```rust compile
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
        let user = cache.inner.lock().unwrap().get(&id).cloned();
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

```rust compile
use volga::{App, di::{Container, Dc, Inject, error::Error}, ok, not_found};
use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
};

#[derive(Clone, Default)]
struct InMemoryCache {
    inner: Arc<Mutex<HashMap<String, String>>>,
}

impl Inject for InMemoryCache {
    fn inject(_container: &Container) -> Result<Self, Error> {
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
        let user = cache.inner.lock().unwrap().get(&id).cloned();
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

Чтобы использовать метод [`add_scoped::<T>()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.add_scoped), тип должен реализовывать типаж [`Inject`](https://docs.rs/volga/latest/volga/di/trait.Inject.html). Это удобный и мощный подход, когда ваш тип зависит от других сервисов, зарегистрированных в контейнере зависимостей.

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

Поведение аналогично **Scoped**, с ключевым отличием: **новый экземпляр создаётся для каждого внедрения**, а не один раз для каждого запроса или области действия. Transient, полученный через [`Container::resolve`](https://docs.rs/volga/latest/volga/di/struct.Container.html#method.resolve), перемещается из контейнера, а не клонируется, — это стоит держать в голове для типа, у которого `Clone` или `Drop` имеет побочные эффекты.

## Изменение зависимости

[`Dc<T>`](https://docs.rs/volga/latest/volga/di/dc/struct.Dc.html) — это ссылка на экземпляр, который контейнер разделяет между потребителями, поэтому он даёт `&T` и никогда `&mut T`. **Singleton** разделяют все запросы, которые обслуживает приложение, а **Scoped** — всё, что резолвит его в течение одного запроса, обработчик и его middleware в том числе. Состояние, которое меняют обработчики, живёт внутри `T` за внутренней изменяемостью (interior mutability), и методы `T` меняют его через `&self`:

```rust compile
use volga::{App, di::Dc, ok};
use std::{
    collections::HashMap,
    sync::{RwLock, atomic::{AtomicU64, Ordering}},
};

#[derive(Default)]
struct Users {
    names: RwLock<HashMap<String, String>>,
    writes: AtomicU64,
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();
    app.add_singleton(Users::default());

    app.map_put("/user/{id}/{name}", |id: String, name: String, users: Dc<Users>| async move {
        users.names.write().unwrap().insert(id, name);
        users.writes.fetch_add(1, Ordering::Relaxed);
        ok!()
    });

    app.map_get("/user/writes", |users: Dc<Users>| async move {
        ok!(users.writes.load(Ordering::Relaxed))
    });

    app.run().await
}
```

* [`Mutex`](https://doc.rust-lang.org/std/sync/struct.Mutex.html) или [`RwLock`](https://doc.rust-lang.org/std/sync/struct.RwLock.html) вокруг данных — `RwLock`, если чтений больше, чем записей.
* Атомик, например [`AtomicU64`](https://doc.rust-lang.org/std/sync/atomic/struct.AtomicU64.html), для счётчика или флага.
* [`tokio::sync::Mutex`](https://docs.rs/tokio/latest/tokio/sync/struct.Mutex.html) — только если guard удерживается через `.await`; guard из `std::sync` отпускается до него.

Собственный `Arc` вокруг этого состояния `T` не нужен: контейнер и так разделяет экземпляр. Он нужен, когда `T` реализует `Clone` и резолвится ещё и по значению — через [`Container::resolve`](https://docs.rs/volga/latest/volga/di/struct.Container.html#method.resolve), [`Dc::cloned()`](https://docs.rs/volga/latest/volga/di/dc/struct.Dc.html#method.cloned) или в поле другого сервиса, — чтобы каждый клон видел одно и то же состояние. Поэтому `Clone`-кэши выше держат `Arc<Mutex<..>>`.

Обработчик, которому нужна собственная копия для изменений, берёт `Dc::cloned()`; зарегистрированный экземпляр остаётся прежним. Клон самого `Dc<T>` — это ещё одна ссылка на тот же экземпляр, и он доступен для любого `T`.

::: warning При переходе с 0.13
До 0.14.0 `Dc<T>` реализовывал `DerefMut`, и запись через него — `counter.hits += 1` — меняла приватную копию: контейнер держит ссылку на каждый singleton, а на scoped-сервис — до конца его запроса, поэтому первая запись клонировала значение. Другие запросы этого изменения не видели. Теперь такая запись не компилируется:

```text
error[E0594]: cannot assign to data in dereference of `Dc<Counter>`
  = help: trait `DerefMut` is required to modify through a dereference, but it is not implemented for `Dc<Counter>`
```

Перенесите состояние внутрь сервиса за `Mutex`, `RwLock` или атомик либо возьмите `Dc::cloned()` там, где обработчику и нужна была приватная копия.
:::

## Граф проверяется при старте

[`App::run()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.run) проверяет граф зависимостей до того, как что-либо запустить, и возвращает `Err`, перечисляя сразу все найденные проблемы, а не первую из них:

```text
dependency injection: dependency cycle: myapp::Repo -> myapp::Db -> myapp::Repo; `myapp::Api` depends on `myapp::Clock`, which is not registered
```

Пока проверка не пройдена, ничего не биндится, не спавнится и не объявляется — ни фоновая задача, ни слушатель HTTPS-редиректа, ни приветственная строка, — поэтому вызывающий код, который обработал ошибку и попробовал снова, найдёт порт свободным, а незарегистрированный сервис роняет старт, а не отдаёт `500` на одном маршруте.

Проверяется то, что регистрация **декларирует**. Фабрика декларирует свои аргументы, поэтому контейнер уже знает, что она резолвит:

```rust
// говорит, что резолвит `Db`
app.add_scoped_factory(|db: Dc<Db>| Repo { db });
```

Ручная реализация [`Inject`](https://docs.rs/volga/latest/volga/di/trait.Inject.html) резолвит из контейнера руками — значит, и декларирует это руками:

```rust compile
use volga::di::{Container, Dependencies, Inject, error::Error};

#[derive(Default, Clone)]
struct Clock;

struct Session {
    clock: Clock,
}

impl Inject for Session {
    fn inject(container: &Container) -> Result<Self, Error> {
        Ok(Self { clock: container.resolve::<Clock>()? })
    }

    // Без этого `Session` в проверку не попадёт
    fn dependencies(deps: &mut Dependencies) {
        deps.add::<Clock>();
    }
}
```

[`dependencies()`](https://docs.rs/volga/latest/volga/di/trait.Inject.html#method.dependencies) — метод с реализацией по умолчанию, и по умолчанию он не декларирует ничего: это оставляет тип вне стартовой проверки, не делая его при этом неправильным. Декларировать нужно ровно то, что резолвит `inject`: зависимость, объявленная здесь, но там не запрошенная, всё равно будет проверена.

Тип, который ничего не декларирует, проверяется в момент конструирования: цикл, встреченный при резолве, паникует, называя найденный путь — `A -> B -> A`.

Та же проверка доступна прямо на [`ContainerBuilder`](https://docs.rs/volga/latest/volga/di/struct.ContainerBuilder.html) — для контейнера, собранного вне `App`:

```rust compile
use volga::di::ContainerBuilder;

fn main() {
    let mut builder = ContainerBuilder::new();
    builder.register_singleton(42u32);

    assert!(builder.validate().is_ok());

    let container = builder.build();
    let _ = container;
}
```

### Что принимают обработчики и middleware

Начиная с **0.14.0** проверка охватывает и то, что принимают обработчики и middleware. Маршрут, обработчик которого принимает `Dc<T>` для `T`, который никто не зарегистрировал, раньше стартовал и отвечал `500` на каждый запрос. Теперь `App::run()` не запускается и называет тип и всё, что его принимает:

```text
dependency injection: `myapp::Db` is not registered, and is resolved by `GET /users/{id}`, `with` on group `/api`. Register a service with `add_singleton`, `add_scoped` or `add_transient` (or their `_factory` and `_default` forms), or take `Option<Dc<T>>` where it is optional
```

* **Проверяются:** обработчики маршрутов, [`map_ws()`](/volga-docs/ru/protocols-realtime/ws.html) и `map_msg()`, `map_err()`, `map_fallback()` приложения и группы, а также `with()`, `filter()`, `map_ok()`, `map_err()` и `tap_req()` приложения, группы или маршрута. Подписанные и приватные cookies считаются принимающими свой ключ.
* **Проверяется только то, что ещё может выполниться:** маршрут, замапленный повторно, `map_err()` или fallback, заменённые более поздним вызовом или `use_problem_details()`, и middleware группы, не привязанный ни к одному маршруту, не учитываются.
* **`Option<Dc<T>>` выводит из проверки.** Он говорит, что сервис необязателен, и равен `None`, если ничего не зарегистрировано. `Result<Dc<T>, Error>` — нет: он лишь передаёт ошибку обработчику.
* **Не проверяются:** сервисы, которые резолвятся во время выполнения, — через `wrap()`, `Middleware`, переданный в `attach()`, [`HttpContext::resolve()`](https://docs.rs/volga/latest/volga/middleware/http_context/struct.HttpContext.html#method.resolve) или сам `Container`. Отсутствующий сервис там по-прежнему роняет запрос.

```rust compile
use volga::{App, di::Dc, ok};

struct Metrics;

impl Metrics {
    fn record(&self, _route: &str) {}
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // Стартует, зарегистрирован `Metrics` или нет
    app.map_get("/", |metrics: Option<Dc<Metrics>>| async move {
        if let Some(metrics) = metrics {
            metrics.record("/");
        }
        ok!()
    });

    app.run().await
}
```

Собственный экстрактор, который резолвит из контейнера, участвует в проверке так же, как сервис: у [`FromContainer`](https://docs.rs/volga/latest/volga/di/trait.FromContainer.html), [`FromRequestRef`](https://docs.rs/volga/latest/volga/http/endpoints/args/trait.FromRequestRef.html) и [`FromRequestParts`](https://docs.rs/volga/latest/volga/http/endpoints/args/trait.FromRequestParts.html) есть метод `dependencies()`, который декларирует, что он резолвит, а по умолчанию не декларирует ничего.

## Использование DI в middleware
Чтобы внедрить зависимость в middleware, в случае использования [`with()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.with) можно воспользоваться структурой [`Dc`](https://docs.rs/volga/latest/volga/di/dc/struct.Dc.html) аналогично использованию в обработчиках запросов. Для [`wrap()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.wrap) используйте метод [`resolve::<T>()`](https://docs.rs/volga/latest/volga/middleware/http_context/struct.HttpContext.html#method.resolve), либо [`resolve_shared::<T>`](https://docs.rs/volga/latest/volga/middleware/http_context/struct.HttpContext.html#method.resolve_shared) структуры [`HttpContext`](https://docs.rs/volga/latest/volga/middleware/http_context/struct.HttpContext.html).
Основное различие между ними заключается в том, что первый метод требует реализации типажа [`Clone`](https://doc.rust-lang.org/std/clone/trait.Clone.html) для `T`, тогда как последний просто возвращает [`Arc<T>`](https://doc.rust-lang.org/std/sync/struct.Arc.html).
`Dc<T>`, принятый в `with()`, входит в [стартовую проверку](#что-принимают-обработчики-и-middleware); то, что `wrap()` резолвит во время выполнения, — нет.

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