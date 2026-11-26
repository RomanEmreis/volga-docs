---
home: true
title: Волга
heroText: Волга
heroImage: /volga-logo-light.png
heroImageDark: /volga-logo.png
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
    title: "Minimal API",
    description: "Маршруты в коде, типизированные аргументы. Неверный ввод отклоняется до вызова обработчика.",
    code: [
      "use serde::Deserialize;",
      "use volga::{App, Json, ok};",
      "",
      "#[derive(Deserialize)]",
      "struct User {",
      "    name: String,",
      "    age: u32,",
      "}",
      "",
      "#[tokio::main]",
      "async fn main() -> std::io::Result<()> {",
      "    let mut app = App::new();",
      "",
      "    // GET /hello/Alice",
      "    app.map_get(\"/hello/{name}\", |name: String| ok!(\"Hello, {name}!\"));",
      "",
      "    // POST /users {\"name\": \"Bob\", \"age\": 35}",
      "    app.map_post(\"/users\", |Json(user): Json<User>| {",
      "        ok!(\"{} is {}\", user.name, user.age)",
      "    });",
      "",
      "    app.run().await",
      "}",
    ].join('\n')
  },
  {
    title: "Валидация",
    description: "Правила записаны на типе. Все нарушения возвращаются сразу в формате Problem Details.",
    code: [
      "use serde::{Deserialize, Serialize};",
      "use volga::validation::{Valid, Validate};",
      "use volga::{App, Json, ValidJson, created};",
      "",
      "#[derive(Serialize, Deserialize, Validate)]",
      "struct Signup {",
      "    #[validate(length(min = 3, max = 32))]",
      "    username: String,",
      "    #[validate(range(min = 18))]",
      "    age: u32,",
      "}",
      "",
      "#[tokio::main]",
      "async fn main() -> std::io::Result<()> {",
      "    let mut app = App::new();",
      "    app.map_problem(); // every error as RFC 9457 JSON",
      "",
      "    app.map_post(\"/signup\", |Valid(Json(user)): ValidJson<Signup>| {",
      "        created!(user)",
      "    });",
      "",
      "    app.run().await",
      "}",
    ].join('\n')
  },
  {
    title: "Внедрение зависимостей",
    description: "Сервисы разрешаются по типу. Забыли зарегистрировать, и приложение не запустится, а не упадёт в продакшене.",
    code: [
      "use volga::{App, di::Dc, ok};",
      "",
      "struct Greeter {",
      "    greeting: String,",
      "}",
      "",
      "#[tokio::main]",
      "async fn main() -> std::io::Result<()> {",
      "    let mut app = App::new();",
      "",
      "    // Leave this line out and the app refuses to start",
      "    app.add_singleton(Greeter { greeting: \"Hello\".into() });",
      "",
      "    app.map_get(\"/hello/{name}\", |name: String, greeter: Dc<Greeter>| {",
      "        ok!(\"{}, {name}!\", greeter.greeting)",
      "    });",
      "",
      "    app.run().await",
      "}",
    ].join('\n')
  },
  {
    title: "JWT",
    description: "Токены проверены, роли соблюдены, claims переданы в обработчик.",
    code: [
      "use serde::Deserialize;",
      "use volga::auth::{Authenticated, DecodingKey, roles};",
      "use volga::{App, claims, ok};",
      "",
      "claims! {",
      "    #[derive(Clone, Deserialize)]",
      "    struct Claims { sub: String, role: String }",
      "}",
      "",
      "#[tokio::main]",
      "async fn main() -> std::io::Result<()> {",
      "    let secret = std::env::var(\"JWT_SECRET\").expect(\"JWT_SECRET must be set\");",
      "    let mut app = App::new().with_bearer_auth(|auth| {",
      "        auth.set_decoding_key(DecodingKey::from_secret(secret.as_bytes()))",
      "    });",
      "",
      "    app.map_get(\"/me\", |user: Authenticated<Claims>| ok!(\"Hello, {}!\", user.sub))",
      "        .authorize::<Claims>(roles([\"admin\", \"user\"]));",
      "",
      "    app.run().await",
      "}",
    ].join('\n')
  },
  {
    title: "Всё в комплекте",
    description: "OpenAPI со Swagger UI, CORS и Rate Limiting, по одной строке.",
    code: [
      "use volga::App;",
      "use volga::rate_limiting::{TokenBucket, by};",
      "",
      "#[tokio::main]",
      "async fn main() -> std::io::Result<()> {",
      "    let mut app = App::new()",
      "        .with_open_api(|api| api.with_title(\"My API\").with_ui())",
      "        .with_cors(|cors| cors.with_any_origin())",
      "        .with_token_bucket(TokenBucket::new(10, 5.0));",
      "",
      "    app.use_open_api();   // /openapi.json and Swagger UI",
      "    app.use_cors();",
      "    app.use_token_bucket(by::ip()); // 429 past 10 requests per IP",
      "",
      "    app.map_get(\"/hello\", || \"Hello, World!\");",
      "",
      "    app.run().await",
      "}",
    ].join('\n')
  },
  {
    title: "Тестирование",
    description: "Запустите настоящее приложение и тестируйте его по HTTP.",
    code: [
      "use volga::{App, ok, test::TestServer};",
      "",
      "fn routes(app: &mut App) {",
      "    app.map_get(\"/health\", || ok!(\"healthy\"));",
      "}",
      "",
      "#[tokio::test]",
      "async fn health_check() {",
      "    let server = TestServer::spawn(routes).await;",
      "",
      "    let res = server.client().get(server.url(\"/health\")).send().await.unwrap();",
      "    assert!(res.status().is_success());",
      "",
      "    server.shutdown().await;",
      "}",
    ].join('\n')
  },
]
</script>

## Масштабируйте API уверенно

Волга предоставляет производительные примитивы и современные практики разработки. От роутинга до middleware и продвинутой инфраструктуры — масштабируйте сервисы без переписывания базовых вещей.

## Примеры, которые цепляют

<CodeShowcase :tabs="codeTabs" />

## Изучайте документацию дальше

- [Быстрый старт](/volga-docs/ru/getting-started/quick-start.html)
- [Туториал](/volga-docs/ru/tutorial/overview.html)
- [Внедрение зависимостей](/volga-docs/ru/advanced-patterns/di.html)
- [Ограничение запросов](/volga-docs/ru/middleware-infrastructure/rate-limiting.html)
- [Работа с JSON](/volga-docs/ru/requests-responses/json-payload.html)
