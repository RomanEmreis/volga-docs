---
home: true
title: Волга
heroText: Волга
tagline: Быстрый async-first веб-фреймворк для Rust на базе Tokio + Hyper.
actions:
  - text: Быстрый старт
    link: /ru/basics/quick-start.html
    type: primary
  - text: API Docs
    link: https://docs.rs/volga/latest/volga/
    type: secondary
features:
  - title: Продуктивность по умолчанию
    details: Минимальная настройка, понятный роутинг и удобный API обработчиков для фокуса на логике.
  - title: Все необходимое внутри
    details: DI, rate limiting, middleware, tracing, CORS, static files и многое другое из коробки.
  - title: Типобезопасные экстракторы
    details: JSON, query params, headers, cookies, файлы — все через композицию типизированных экстракторов.
footer: MIT Licensed • Сфокусирован на производительности
---

## Масштабируйте API уверенно

Volga предоставляет производительные примитивы и современные практики разработки. От роутинга до middleware и продвинутой инфраструктуры — масштабируйте сервисы без переписывания базовых вещей.

## Примеры, которые цепляют

### DI, которое ощущается нативно

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
    app.add_singleton(InMemoryCache::default());

    app.map_get("/user/{id}", |id: String, cache: Dc<InMemoryCache>| async move {
        let user = cache.inner.lock().unwrap().get(&id);
        match user {
            Some(user) => ok!(user),
            None => not_found!("User not found"),
        }
    });

    app.run().await
}
```

### Rate limiting с именованными политиками

```rust
use std::time::Duration;
use volga::{App, rate_limiting::{by, FixedWindow}};

let burst = FixedWindow::new(100, Duration::from_secs(30)).with_name("burst");

let mut app = App::new().with_fixed_window(burst);

app.map_get("/upload", upload_handler)
    .fixed_window(by::ip().using("burst"));
```

### Экстракторы, которые держат код чистым

```rust
use volga::{App, Json, ok};
use serde::Deserialize;

#[derive(Deserialize)]
struct User {
    name: String,
    age: i32,
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_post("/hello", |user: Json<User>| async move {
        ok!("Hello {}!", user.name)
    });

    app.run().await
}
```

## Изучайте документацию дальше

- [Быстрый старт](/ru/basics/quick-start.html)
- [Dependency Injection](/ru/advanced/di.html)
- [Rate Limiting](/ru/advanced/rate-limiting.html)
- [Handling JSON](/ru/data/json-payload.html)
