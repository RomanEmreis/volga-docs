---
home: true
title: Волга
heroText: Волга
tagline: Быстрый async-first веб-фреймворк для Rust на базе tokio + hyper.
actions:
  - text: Быстрый старт
    link: /ru/getting-started/quick-start.html
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

<script setup>
const codeTabs = [
  {
    title: 'Extractors',
    description: 'Данные запроса десериализуются прямо в аргументы обработчика. Никакого ручного парсинга — Volga автоматически маппит JSON, query params, заголовки и многое другое.',
    code: [
      'use volga::{App, Json, ok};',
      'use serde::Deserialize;',
      '',
      '#[derive(Deserialize)]',
      'struct User {',
      '    name: String,',
      '    age: i32,',
      '}',
      '',
      '#[tokio::main]',
      'async fn main() -> std::io::Result<()> {',
      '    let mut app = App::new();',
      '',
      '    app.map_post("/hello", |user: Json<User>| async move {',
      '        ok!("Hello {}!", user.name)',
      '    });',
      '',
      '    app.run().await',
      '}',
    ].join('\n')
  },
  {
    title: 'Dependency Injection',
    description: 'Зарегистрируйте сервисы один раз — получайте их везде. Встроенный DI Volga резолвит зависимости по типу — без макросов, без бойлерплейта, просто нативный Rust.',
    code: [
      'use volga::{App, di::Dc, ok, not_found};',
      'use std::{',
      '    collections::HashMap,',
      '    sync::{Arc, Mutex},',
      '};',
      '',
      '#[derive(Clone, Default)]',
      'struct InMemoryCache {',
      '    inner: Arc<Mutex<HashMap<String, String>>>,',
      '}',
      '',
      '#[tokio::main]',
      'async fn main() -> std::io::Result<()> {',
      '    let mut app = App::new();',
      '    app.add_singleton(InMemoryCache::default());',
      '',
      '    app.map_get("/user/{id}", |id: String, cache: Dc<InMemoryCache>| async move {',
      '        let user = cache.inner.lock().unwrap().get(&id);',
      '        match user {',
      '            Some(user) => ok!(user),',
      '            None => not_found!("User not found"),',
      '        }',
      '    });',
      '',
      '    app.run().await',
      '}',
    ].join('\n')
  },
  {
    title: 'Rate Limiting',
    description: 'Защитите эндпоинты с помощью rate limiting. Применяйте политики per-IP или кастомные политики для каждого маршрута одним fluent-вызовом.',
    code: [
      'use volga::{App, rate_limiting::{by, TokenBucket}};',
      '',
      '#[tokio::main]',
      'async fn main() -> std::io::Result<()> {',
      '    let burst = TokenBucket::new(2, 0.5).with_name("burst");',
      '    let mut app = App::new()',
      '        .with_token_bucket(burst);',
      '',
      '    app.map_get("/upload", upload_handler)',
      '        .token_bucket(by::ip().using("burst"));',
      '',
      '    app.run().await',
      '}',
    ].join('\n')
  }
]
</script>

## Масштабируйте API уверенно

Volga предоставляет производительные примитивы и современные практики разработки. От роутинга до middleware и продвинутой инфраструктуры — масштабируйте сервисы без переписывания базовых вещей.

## Примеры, которые цепляют

<CodeShowcase :tabs="codeTabs" />

## Изучайте документацию дальше

- [Быстрый старт](/volga-docs/ru/getting-started/quick-start.html)
- [Внедрение зависимостей](/volga-docs/ru/advanced-patterns/di.html)
- [Ограничение запросов](/volga-docs/ru/middleware-infrastructure/rate-limiting.html)
- [Работа с JSON](/volga-docs/ru/requests-responses/json-payload.html)
