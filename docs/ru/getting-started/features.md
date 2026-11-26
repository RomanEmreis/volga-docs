# Фичи

Волга разбита на фичи Cargo, чтобы приложение компилировало только то, чем пользуется. По умолчанию включена только `http1`. С ней работают маршрутизация, обработчики, экстракторы, макросы ответов и обработка ошибок, а всё остальное (middleware, DI, cookie, TLS и другое) требует своей фичи.

## С чего начать

Пока вы изучаете Волгу или делаете прототип, включите `full`:

```toml
[dependencies]
volga = { version = "0.15", features = ["full"] }
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
```

Все примеры на этом сайте компилируются с этим набором, если на странице не сказано иное. Когда приложение устоится, замените `full` на фичи, которые оно действительно использует: зависимостей станет меньше, а сборка быстрее.

::: tip Если метода нет
Ошибка `no method named wrap found for struct App` (или `add_singleton`, `use_cors`, `map_ws`…) почти всегда означает, что фича выключена. Найдите метод в таблице ниже и включите его фичу.
:::

## Список фич

| Фича | Что включает | Входит в `full` |
|---|---|---|
| `http1` | сервер HTTP/1 (включена по умолчанию) | да |
| `http2` | сервер HTTP/2; вместе с `http1` протокол согласуется | да |
| `middleware` | `wrap`, `with`, `filter`, `map_ok`, `tap_req`, `attach`, [CORS](/volga-docs/ru/middleware-infrastructure/cors.html) | да |
| `di` | [внедрение зависимостей](/volga-docs/ru/advanced-patterns/di.html): `add_singleton`, `add_scoped`, `Dc<T>` | да |
| `config` | [файлы конфигурации](/volga-docs/ru/middleware-infrastructure/config-files.html) | да |
| `tls` | [HTTPS](/volga-docs/ru/protocols-realtime/https.html), HSTS, перенаправление на HTTPS | да |
| `tracing` | интеграция с [tracing](/volga-docs/ru/reliability-observability/tracing.html) | да |
| `ws` | [WebSockets](/volga-docs/ru/protocols-realtime/ws.html) | да |
| `multipart` | загрузка и ответы `Multipart` | да |
| `openapi` | документ и UI [OpenAPI](/volga-docs/ru/middleware-infrastructure/openapi.html) | да |
| `problem-details` | [Problem Details](/volga-docs/ru/reliability-observability/errors.html#problem-details) (RFC 9457) | да |
| `rate-limiting` | [Rate Limiting](/volga-docs/ru/middleware-infrastructure/rate-limiting.html) | да |
| `static-files` | [статические файлы](/volga-docs/ru/middleware-infrastructure/static-files.html) | да |
| `compression-full` | [сжатие ответов](/volga-docs/ru/middleware-infrastructure/compression.html): brotli, gzip, deflate, zstd | да |
| `decompression-full` | [распаковка запросов](/volga-docs/ru/middleware-infrastructure/decompression.html) | да |
| `cookie-full` | [cookie](/volga-docs/ru/requests-responses/cookie.html), включая подписанные и закрытые | да |
| `auth` | [Basic- и Bearer-аутентификация (JWT)](/volga-docs/ru/security-access/auth.html), `authorize` | да |
| `oauth-client` | проверка bearer-токенов по [эмитенту OAuth 2.1 / OIDC](/volga-docs/ru/security-access/oauth.html) | да |
| `validation-derive` | `#[derive(Validate)]` для [валидации](/volga-docs/ru/requests-responses/validation.html) | да |
| `uuid` | `uuid::Uuid` как [параметр пути](/volga-docs/ru/getting-started/route-params.html#uuid) | да |
| `jwt-derive` | `#[derive(Claims)]`; `auth-full` это `auth` плюс эта фича | нет |
| `macros` | атрибут `#[http_header]` для [собственных заголовков](/volga-docs/ru/requests-responses/headers.html) | нет |
| `dev-cert` | самоподписанные [сертификаты разработки](/volga-docs/ru/protocols-realtime/https.html#использование-сертификатов-разработки) | нет |
| `test` | [`TestServer`](/volga-docs/ru/reliability-observability/testing.html) для интеграционных тестов | нет |

У некоторых фич есть более мелкие части: `compression-gzip`, `compression-brotli` и `compression-zstd` вместо `compression-full`; `cookie`, `signed-cookie` и `private-cookie` вместо `cookie-full`; `basic-auth` и `jwt-auth` вместо `auth`. Они перечислены на страницах этих тем.

Фичи складываются, поэтому те, что не входят в `full`, указываются рядом с ней:

```toml
[dependencies]
volga = { version = "0.15", features = ["full", "auth-full", "macros"] }

[dev-dependencies]
volga = { version = "0.15", features = ["test"] }
```
