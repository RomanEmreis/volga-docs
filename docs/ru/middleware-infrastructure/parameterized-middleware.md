# Параметризованные Middleware

Помимо встроенных middleware-замыканий, регистрируемых через [`wrap()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.wrap) и [`with()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.with), Volga также поддерживает регистрацию middleware в виде повторно используемых настраиваемых типов через метод [`attach()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.attach).

Такой подход удобен, когда middleware требует собственного состояния, конфигурации или должен использоваться повторно в нескольких приложениях.

## Обзор

Параметризованный middleware — это обычный Rust-тип (как правило, `struct`), реализующий трейт [`Middleware`](https://docs.rs/volga/latest/volga/middleware/trait.Middleware.html). Такой тип хранит всю необходимую конфигурацию и разделяемое состояние, а его метод [`call()`](https://docs.rs/volga/latest/volga/middleware/trait.Middleware.html#tymethod.call) содержит основную логику middleware.

Это похоже на паттерны middleware в других экосистемах (например, слои Tower, middleware ASP.NET Core или классы Express.js).

## Трейт `Middleware`

Трейт определён следующим образом:
```rust
pub trait Middleware: Send + Sync + 'static {
    fn call(
        &self,
        ctx: HttpContext,
        next: NextFn,
    ) -> impl Future<Output = HttpResult> + Send + 'static;
}
```

Любой тип, реализующий этот трейт, можно передать в [`attach()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.attach).

## Пример: Middleware `Timeout`

Ниже приведён небольшой middleware, добавляющий искусственную задержку перед дальнейшей обработкой запроса. Длительность задержки настраивается при регистрации:
```rust
use std::time::Duration;
use volga::{App, HttpResult, middleware::{HttpContext, NextFn, Middleware}};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // Регистрируем параметризованный middleware
    app.attach(Timeout {
        duration: Duration::from_secs(1),
    });

    app.map_get("/hello", || async { "Hello, World!" });

    app.run().await
}

struct Timeout {
    duration: Duration,
}

impl Middleware for Timeout {
    fn call(&self, ctx: HttpContext, next: NextFn) -> impl Future<Output = HttpResult> + 'static {
        let duration = self.duration;
        async move {
            tokio::time::sleep(duration).await;
            next(ctx).await
        }
    }
}
```

Структура `Timeout` хранит свою конфигурацию (`duration`) и реализует логику middleware внутри `call()`. Можно создать несколько экземпляров с разными значениями задержки или переиспользовать один экземпляр для нескольких маршрутов.

## .wrap() и .attach()

Оба метода регистрируют middleware, работающие с полным [`HttpContext`](https://docs.rs/volga/latest/volga/middleware/struct.HttpContext.html), но рассчитаны на разные сценарии:

- [`wrap()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.wrap) оптимизирован для коротких встроенных замыканий. Аннотации типов для `ctx` и `next` не требуются.
- [`attach()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.attach) предназначен для повторно используемых параметризованных типов middleware — как правило, структур, реализующих трейт [`Middleware`](https://docs.rs/volga/latest/volga/middleware/trait.Middleware.html).

::: tip
Используйте [`wrap()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.wrap) для быстрых встроенных middleware и [`attach()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.attach), когда нужно оформить middleware как именованный настраиваемый тип, пригодный для повторного использования.
:::

`attach()` также принимает замыкания, но в этом случае требуется указывать аннотации типов для аргументов:
```rust
use volga::{App, middleware::{HttpContext, NextFn}};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.attach(|ctx: HttpContext, next: NextFn| async move {
        next(ctx).await
    });

    app.run().await
}
```

## Регистрация на маршрутах и группах маршрутов

Параметризованные middleware могут быть прикреплены не только ко всему приложению, но и к отдельным маршрутам и [группам маршрутов](../getting-started/route-groups.md):
```rust
use std::time::Duration;
use volga::{App, HttpResult, middleware::{HttpContext, NextFn, Middleware}};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // Прикрепление к одному маршруту
    app
        .map_get("/hello", || async { "Hello, World!" })
        .attach(Timeout { duration: Duration::from_secs(1) });

    // Прикрепление к группе маршрутов
    app.group("/api", |api| {
        api.attach(Timeout { duration: Duration::from_secs(2) });
        api.map_get("/ping", || async { "pong" });
    });

    app.run().await
}

struct Timeout {
    duration: Duration,
}

impl Middleware for Timeout {
    fn call(&self, ctx: HttpContext, next: NextFn) -> impl Future<Output = HttpResult> + 'static {
        let duration = self.duration;
        async move {
            tokio::time::sleep(duration).await;
            next(ctx).await
        }
    }
}
```

## Когда использовать параметризованные Middleware

Выбирайте [`attach()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.attach) и отдельный тип, если:

- Middleware требует **конфигурации** при регистрации (таймауты, лимиты, feature flags и т. п.).
- Middleware должен быть **переиспользуемым** между проектами или крейтами.
- Middleware хранит **разделяемое состояние**, счётчики или дескрипторы внешних систем.
- Вы хотите **юнит-тестировать** middleware независимо от работающего приложения.

Для простых разовых преобразований, как правило, лаконичнее оставить логику встроенной через [`wrap()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.wrap) или [`with()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.with).

Встроенные возможности, такие как [CORS](./cors.md), [аутентификация](../security-access/auth.md) и [ограничение частоты запросов](./rate-limiting.md), сами реализованы как параметризованные middleware поверх [`attach()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.attach).
