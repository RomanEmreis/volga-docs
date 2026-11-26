---
home: true
title: "Volga"
heroText: Volga
heroImage: /volga-logo-light.png
heroImageDark: /volga-logo.png
tagline: "Fast, async-first web framework for Rust built on tokio + hyper."
actions:
  - text: "Get Started"
    link: /en/getting-started/quick-start.html
    type: primary
  - text: "API Docs"
    link: https://docs.rs/volga/latest/volga/
    type: secondary
features:
  - title: "Feels like minimal APIs"
    details: "Routes in code, typed handler arguments, DI with singleton, scoped and transient lifetimes. Coming from ASP.NET Core, Spring or Go? You already know the shape."
  - title: "Mistakes fail at startup"
    details: "A service nobody registered, a path parameter the route never declares, a broken auth setup: the app stops before it serves a single request, and says why."
  - title: "Batteries, opt-in"
    details: "JWT and OAuth, validation, Problem Details, OpenAPI, rate limiting, WebSockets, SSE, HTTP/2. Each is a Cargo feature; the default build is just the HTTP server."
footer: "MIT Licensed • Built for performance"
---

<script setup>
const codeTabs = [
  {
    title: "Minimal API",
    description: "Routes in code and typed handler arguments: no attributes, no reflection. A body that is not valid JSON is answered 400 before your handler runs.",
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
    description: "Rules live on the type. Invalid input never reaches the handler: the client gets every broken rule at once as Problem Details (RFC 9457), and the same rules appear in your OpenAPI schema.",
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
    description: "Services resolved by type, no macros. Forget to register one and the app refuses to start: \"Greeter is not registered, and is resolved by GET /hello/{name}\". Not a 500 in production.",
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
    description: "Tokens checked, roles enforced, verified claims handed to your handler. Rejections answer 401 or 403 with the right WWW-Authenticate challenge, and a bearer token over plain HTTP is refused by default.",
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
    description: "OpenAPI with Swagger UI, CORS and per-IP rate limiting, one line each. Compression, WebSockets, SSE, TLS and static files work the same way.",
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
    description: "Start the real app on a free port and call it over HTTP. One test covers routing, middleware, auth and errors, and tests run in parallel.",
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

## Why Volga

If you have written an ASP.NET Core minimal API, a Spring controller or a Go handler, [this page](/volga-docs/en/getting-started/coming-from.html) maps what you know to Volga. To see the pieces work together, build a complete service in the [tutorial](/volga-docs/en/tutorial/overview.html).

## See It in Code

<CodeShowcase :tabs="codeTabs" />

## Explore the docs

- [Quick Start](/volga-docs/en/getting-started/quick-start.html)
- [Coming from ASP.NET Core, Spring or Go](/volga-docs/en/getting-started/coming-from.html)
- [Tutorial: a Bookmarks Service](/volga-docs/en/tutorial/overview.html)
- [Dependency Injection](/volga-docs/en/advanced-patterns/di.html)
- [Agent Skill](/volga-docs/en/agent-skill.html)
