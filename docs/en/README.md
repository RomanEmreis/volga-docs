---
home: true
title: Volga
heroText: Volga
heroImage: /volga-logo-light.png
heroImageDark: /volga-logo.png
tagline: Fast, async-first web framework for Rust built on tokio + hyper.
actions:
  - text: Get Started
    link: /en/getting-started/quick-start.html
    type: primary
  - text: API Docs
    link: https://docs.rs/volga/latest/volga/
    type: secondary
features:
  - title: Productive by default
    details: Minimal setup, clear routing, and an ergonomic handler API that keeps your focus on the business logic.
  - title: Batteries included
    details: Built-in DI, rate limiting, middleware, tracing, CORS, static files, and more.
  - title: Type-safe extractors
    details: Read JSON, query params, headers, cookies, or files with composable, strongly typed extractors.
footer: MIT Licensed • Built for performance
---

<script setup>
const codeTabs = [
  {
    title: "Minimal API",
    description: "Routes in code, typed handler arguments. Bad input is rejected before your handler runs.",
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
    title: "Validation",
    description: "Rules live on the type. Every broken rule comes back at once as Problem Details.",
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
    title: "Dependency Injection",
    description: "Services resolved by type. Forget one and the app won't start, instead of failing in production.",
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
    title: "JWT Auth",
    description: "Tokens checked, roles enforced, verified claims handed to your handler.",
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
    title: "Batteries",
    description: "OpenAPI with Swagger UI, CORS and rate limiting, one line each.",
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
    title: "Testing",
    description: "Start the real app and test it over HTTP.",
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

## Build APIs that scale with confidence

Volga ships with performance-friendly primitives and modern developer ergonomics. From routing to middleware and advanced infrastructure features, you can scale from a single endpoint to a full microservice surface without rewriting core pieces.

## Examples that hook developers fast

<CodeShowcase :tabs="codeTabs" />

## Explore the docs

- [Quick Start](/volga-docs/en/getting-started/quick-start.html)
- [Tutorial](/volga-docs/en/tutorial/overview.html)
- [Dependency Injection](/volga-docs/en/advanced-patterns/di.html)
- [Rate Limiting](/volga-docs/en/middleware-infrastructure/rate-limiting.html)
- [Handling JSON](/volga-docs/en/requests-responses/json-payload.html)
