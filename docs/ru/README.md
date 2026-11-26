---
home: true
title: "Волга"
heroText: Волга
heroImage: /volga-logo-light.png
heroImageDark: /volga-logo.png
tagline: "Быстрый async-first веб-фреймворк для Rust на базе tokio + hyper."
actions:
  - text: "Быстрый старт"
    link: /ru/getting-started/quick-start.html
    type: primary
  - text: "API Docs"
    link: https://docs.rs/volga/latest/volga/
    type: secondary
features:
  - title: "Как minimal APIs"
    details: "Маршруты в коде, типизированные аргументы обработчиков, DI с временами жизни Singleton, Scoped и Transient. Пришли с ASP.NET Core, Spring или Go? Форма вам уже знакома."
  - title: "Ошибки видны при старте"
    details: "Сервис, который никто не зарегистрировал, параметр пути, которого нет в маршруте, сломанная настройка аутентификации: приложение останавливается до первого запроса и объясняет почему."
  - title: "Всё нужное, по выбору"
    details: "JWT и OAuth, валидация, Problem Details, OpenAPI, Rate Limiting, WebSockets, SSE, HTTP/2. Каждое это фича Cargo; сборка по умолчанию содержит только HTTP-сервер."
footer: "MIT Licensed • Сфокусирован на производительности"
---

<script setup>
const codeTabs = [
  {
    title: "Minimal API",
    description: "Маршруты в коде и типизированные аргументы обработчиков: без атрибутов и рефлексии. Тело, которое не является корректным JSON, получает 400 ещё до вызова обработчика.",
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
    description: "Правила записаны на типе. Неверный ввод не доходит до обработчика: клиент получает все нарушенные правила сразу в формате Problem Details (RFC 9457), а те же правила попадают в вашу схему OpenAPI.",
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
    description: "Сервисы разрешаются по типу, без макросов. Забыли зарегистрировать сервис, и приложение не запустится: \"Greeter is not registered, and is resolved by GET /hello/{name}\". А не 500 в продакшене.",
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
    description: "Токены проверены, роли соблюдены, проверенные claims переданы в обработчик. Отказы отвечают 401 или 403 с правильным WWW-Authenticate, а bearer-токен по обычному HTTP по умолчанию отклоняется.",
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
    description: "OpenAPI со Swagger UI, CORS и Rate Limiting по IP, по одной строке. Сжатие, WebSockets, SSE, TLS и статические файлы подключаются так же.",
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
    description: "Запустите настоящее приложение на свободном порту и вызывайте его по HTTP. Один тест проверяет маршрутизацию, middleware, аутентификацию и ошибки, а тесты идут параллельно.",
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

## Почему Волга

Если вы писали minimal API на ASP.NET Core, контроллер на Spring или обработчик на Go, [эта страница](/volga-docs/ru/getting-started/coming-from.html) сопоставит знакомое с Волгой. Чтобы увидеть, как части работают вместе, соберите законченный сервис в [туториале](/volga-docs/ru/tutorial/overview.html).

## Как это выглядит в коде

<CodeShowcase :tabs="codeTabs" />

## Изучайте документацию дальше

- [Быстрый старт](/volga-docs/ru/getting-started/quick-start.html)
- [Если вы пришли с ASP.NET Core, Spring или Go](/volga-docs/ru/getting-started/coming-from.html)
- [Туториал: сервис закладок](/volga-docs/ru/tutorial/overview.html)
- [Внедрение зависимостей](/volga-docs/ru/advanced-patterns/di.html)
- [Agent Skill](/volga-docs/ru/agent-skill.html)
