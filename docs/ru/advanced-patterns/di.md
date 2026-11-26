# Внедрение зависимостей

Обработчик, которому нужен пул соединений с базой, кэш или клиент, принимает его аргументом `Dc<T>`, а Волга достаёт его из контейнера. Сервисы регистрируются на `App` с одним из трёх жизненных циклов, тех же, что в ASP.NET Core: **singleton**, **scoped** и **transient**. Если вы пришли из Go, это заменяет передачу общего состояния через замыкания или контекст.

Если вы не используете набор фич `full`, включите фичу `di` в `Cargo.toml`:

```toml
[dependencies]
volga = { version = "0.15", features = ["di"] }
```

## Жизненные циклы кратко

| Жизненный цикл | Экземпляр | Регистрация |
|---|---|---|
| Singleton | один на всё приложение | `add_singleton(value)` |
| Scoped | один на запрос, общий для обработчика и его middleware | `add_scoped_factory(f)`, `add_scoped_default::<T>()`, `add_scoped::<T>()` |
| Transient | новый при каждом резолве | `add_transient_factory(f)`, `add_transient_default::<T>()`, `add_transient::<T>()` |

`T` должен быть [`Send`](https://doc.rust-lang.org/std/marker/trait.Send.html) и [`Sync`](https://doc.rust-lang.org/std/marker/trait.Sync.html), потому что один экземпляр может обслуживать несколько запросов одновременно.

## Singleton

[`add_singleton`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.add_singleton) регистрирует уже созданное значение. Все запросы получают один и тот же экземпляр:

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

    app.add_singleton(InMemoryCache::default());

    app.map_get("/user/{id}", |id: String, cache: Dc<InMemoryCache>| async move {
        let user = cache.inner.lock().unwrap().get(&id).cloned();
        match user {
            Some(user) => ok!(user),
            None => not_found!("User not found"),
        }
    });

    app.map_post("/user/{id}/{name}", |id: String, name: String, cache: Dc<InMemoryCache>| async move {
        cache.inner.lock().unwrap().insert(id, name);
        ok!()
    });

    app.run().await
}
```

[`Dc<T>`](https://docs.rs/volga/latest/volga/di/dc/struct.Dc.html) это [экстрактор](/volga-docs/ru/getting-started/extractors.html), как `Json<T>` или `Query<T>`: он достаёт сервис из контейнера до вызова обработчика.

## Scoped

Scoped-сервис создаётся один раз на запрос, когда что-то в этом запросе впервые его попросит. Регистрируйте его **фабрикой**, замыканием, которое его создаёт. Аргументы фабрики это нужные ей сервисы, поэтому контейнер узнаёт её зависимости из сигнатуры:

```rust compile
use volga::{App, di::Dc, ok};

struct Db {
    url: String,
}

#[derive(Clone)]
struct Repo {
    db: Dc<Db>,
}

impl Repo {
    fn describe(&self) -> String {
        format!("repo over {}", self.db.url)
    }
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.add_singleton(Db { url: "postgres://localhost/app".into() });

    // Новый `Repo` на каждый запрос, построенный из singleton `Db`
    app.add_scoped_factory(|db: Dc<Db>| Ok(Repo { db }));

    app.map_get("/repo", |repo: Dc<Repo>| async move {
        ok!(repo.describe())
    });

    app.run().await
}
```

### Правила фабрик

* **Фабрика без аргументов возвращает `T`:** `add_scoped_factory(|| Cache::new())`.
* **Фабрика с аргументами возвращает `Result<T, volga::di::error::Error>`**, поэтому пример выше оборачивает значение в `Ok(..)`. Аргументы резолвятся до вызова, а создание сервиса всё равно может завершиться ошибкой. Если такая фабрика вернёт просто `T`, код не скомпилируется, и ошибка не упомянет тип результата.
* **Не больше пяти аргументов.** Аргументом может быть всё, что контейнер умеет резолвить, обычно `Dc<T>`.
* **Аргумент `Container` ничего не декларирует**, поэтому фабрика, которая его принимает, выпадает из [проверки при старте](#граф-проверяется-при-старте). Принимайте сами сервисы как `Dc<T>`.

### Тип с `Default`

Типу, который реализует [`Default`](https://doc.rust-lang.org/std/default/trait.Default.html), фабрика не нужна:

```rust compile-fragment
#[derive(Default, Clone)]
struct RequestLog {
    lines: std::sync::Arc<std::sync::Mutex<Vec<String>>>,
}

app.add_scoped_default::<RequestLog>();
```

### Ручная реализация `Inject`

Когда создание не укладывается в замыкание, тип реализует [`Inject`](https://docs.rs/volga/latest/volga/di/trait.Inject.html) и регистрируется через [`add_scoped::<T>()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.add_scoped). `inject` резолвит нужное из контейнера вручную, поэтому должен и объявить эти сервисы в `dependencies()`, иначе тип выпадет из проверки при старте:

```rust compile
use volga::{App, di::{Container, Dc, Dependencies, Inject, error::Error}, ok};

#[derive(Default, Clone)]
struct Clock;

#[derive(Clone)]
struct Session {
    clock: Clock,
}

impl Inject for Session {
    fn inject(container: &Container) -> Result<Self, Error> {
        Ok(Self { clock: container.resolve::<Clock>()? })
    }

    // Этот список должен совпадать с тем, что резолвит `inject`
    fn dependencies(deps: &mut Dependencies) {
        deps.add::<Clock>();
    }
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.add_singleton(Clock);
    app.add_scoped::<Session>();

    app.map_get("/session", |_session: Dc<Session>| async { ok!() });

    app.run().await
}
```

Ничто не сравнивает `dependencies()` с тем, что `inject` резолвит на самом деле, поэтому фабрика остаётся первым выбором.

## Transient

Transient-сервис создаётся заново **при каждом резолве**, даже дважды в одном запросе. Он регистрируется теми же тремя способами, что и scoped:

* [`add_transient_factory(f)`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.add_transient_factory), по тем же [правилам фабрик](#правила-фабрик)
* [`add_transient_default::<T>()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.add_transient_default)
* [`add_transient::<T>()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.add_transient) для ручной реализации `Inject`

Transient, полученный через [`Container::resolve`](https://docs.rs/volga/latest/volga/di/struct.Container.html#method.resolve), перемещается из контейнера, а не клонируется. Это стоит знать для типа, у которого `Clone` или `Drop` имеют побочные эффекты.

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

## Граф проверяется при старте

[`App::run()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.run) проверяет граф зависимостей до того, как что-либо запустить, и возвращает `Err`, перечисляя сразу все найденные проблемы, а не первую из них:

```text
dependency injection: dependency cycle: myapp::Repo -> myapp::Db -> myapp::Repo; `myapp::Api` depends on `myapp::Clock`, which is not registered
```

Пока проверка не пройдена, ничего не биндится, не спавнится и не объявляется — ни фоновая задача, ни слушатель HTTPS-редиректа, ни приветственная строка, — поэтому вызывающий код, который обработал ошибку и попробовал снова, найдёт порт свободным, а незарегистрированный сервис роняет старт, а не отдаёт `500` на одном маршруте.

Проверяется то, что регистрация **декларирует**. [Фабрика](#scoped) декларирует свои аргументы, поэтому `add_scoped_factory(|db: Dc<Db>| Ok(Repo { db }))` сообщает, что резолвит `Db`, и синхронизировать ничего не нужно. [Ручная реализация `Inject`](#ручная-реализация-inject) декларирует то, что резолвит, в `dependencies()`.

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

Проверка охватывает и то, что принимают обработчики и middleware. Если обработчик принимает `Dc<T>` для `T`, который никто не зарегистрировал, `App::run()` не запускается и называет тип и всё, что его принимает:

```text
dependency injection: `myapp::Db` is not registered, and is resolved by `GET /users/{id}`, `with` on group `/api`. Register a service with `add_singleton`, `add_scoped` or `add_transient` (or their `_factory` and `_default` forms), or take `Option<Dc<T>>` where it is optional
```

* **Проверяются:** обработчики маршрутов, [`map_ws()`](/volga-docs/ru/protocols-realtime/ws.html) и `map_msg()`, `map_err()`, `map_fallback()` приложения и группы, а также `with()`, `filter()`, `map_ok()`, `map_err()` и `tap_req()` приложения, группы или маршрута. Подписанные и приватные cookies считаются принимающими свой ключ.
* **Проверяется только то, что ещё может выполниться:** маршрут, замапленный повторно, `map_err()` или fallback, заменённые более поздним вызовом или `map_problem()`, и middleware группы, не привязанный ни к одному маршруту, не учитываются.
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

[Собственный экстрактор](/volga-docs/ru/advanced-patterns/custom-extractors.html#сервисы-из-контеинера), который резолвит из контейнера, участвует в проверке так же, как сервис: `FromRequestHead::dependencies()` декларирует, что он резолвит, а по умолчанию не декларирует ничего.

## Использование DI в middleware
Чтобы внедрить зависимость в middleware, в случае использования [`with()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.with), `filter()`, `map_ok()`, `map_err()` или `tap_req()` можно воспользоваться структурой [`Dc`](https://docs.rs/volga/latest/volga/di/dc/struct.Dc.html) аналогично использованию в обработчиках запросов. Для [`wrap()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.wrap) используйте метод [`resolve::<T>()`](https://docs.rs/volga/latest/volga/middleware/http_context/struct.HttpContext.html#method.resolve), либо [`resolve_shared::<T>`](https://docs.rs/volga/latest/volga/middleware/http_context/struct.HttpContext.html#method.resolve_shared) структуры [`HttpContext`](https://docs.rs/volga/latest/volga/middleware/http_context/struct.HttpContext.html).
Основное различие между ними заключается в том, что первый метод требует реализации типажа [`Clone`](https://doc.rust-lang.org/std/clone/trait.Clone.html) для `T`, тогда как последний просто возвращает [`Arc<T>`](https://doc.rust-lang.org/std/sync/struct.Arc.html).
`Dc<T>`, принятый в этих методах, входит в [стартовую проверку](#что-принимают-обработчики-и-middleware); то, что `wrap()` резолвит во время выполнения, — нет.

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