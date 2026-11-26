# Если вы пришли с ASP.NET Core, Spring или Go

Если вы писали HTTP-сервисы на другом стеке, большая часть Волги вам уже знакома. Ближе всего она к minimal API в ASP.NET Core: маршруты регистрируются в коде на `App`, аргументы обработчика говорят, что он читает из запроса, а сервисы берутся из контейнера с привычными тремя жизненными циклами. Эта страница сопоставляет знакомые вам имена с именами Волги и перечисляет, что в Rust устроено иначе.

## Один сервис на четырёх стеках

Небольшой API пользователей: `GET /users/{id}` отвечает пользователем в JSON или `404`, а `POST /users` сохраняет пользователя и отвечает `201`.

**ASP.NET Core (minimal API)**

```csharp
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddSingleton<Users>();
var app = builder.Build();

app.MapGet("/users/{id}", (int id, Users users) =>
    users.Find(id) is { } user ? Results.Ok(user) : Results.NotFound());

app.MapPost("/users", (User user, Users users) =>
{
    users.Add(user);
    return Results.Created($"/users/{user.Id}", user);
});

app.Run();
```

**Spring Boot**

```java
@RestController
@RequestMapping("/users")
class UserController {
    private final Users users;

    UserController(Users users) { this.users = users; }

    @GetMapping("/{id}")
    ResponseEntity<User> get(@PathVariable int id) {
        return users.find(id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    ResponseEntity<User> create(@RequestBody User user) {
        users.add(user);
        return ResponseEntity.status(HttpStatus.CREATED).body(user);
    }
}
```

**Go (`net/http`, Go 1.22+)**

```go
func main() {
    users := NewUsers()
    mux := http.NewServeMux()

    mux.HandleFunc("GET /users/{id}", func(w http.ResponseWriter, r *http.Request) {
        id, err := strconv.Atoi(r.PathValue("id"))
        if err != nil {
            http.Error(w, "bad id", http.StatusBadRequest)
            return
        }
        user, ok := users.Find(id)
        if !ok {
            http.NotFound(w, r)
            return
        }
        json.NewEncoder(w).Encode(user)
    })

    mux.HandleFunc("POST /users", func(w http.ResponseWriter, r *http.Request) {
        var user User
        if err := json.NewDecoder(r.Body).Decode(&user); err != nil {
            http.Error(w, err.Error(), http.StatusBadRequest)
            return
        }
        users.Add(user)
        w.WriteHeader(http.StatusCreated)
        json.NewEncoder(w).Encode(user)
    })

    http.ListenAndServe(":7878", mux)
}
```

**Волга**

```rust compile
use std::{collections::HashMap, sync::RwLock};
use serde::{Deserialize, Serialize};
use volga::{App, HttpResult, Json, created, di::Dc, not_found, ok};

#[derive(Clone, Serialize, Deserialize)]
struct User {
    id: u32,
    name: String,
}

#[derive(Default)]
struct Users {
    items: RwLock<HashMap<u32, User>>,
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();
    app.add_singleton(Users::default());

    app.map_get("/users/{id}", get_user);
    app.map_post("/users", create_user);

    app.run().await
}

async fn get_user(id: u32, users: Dc<Users>) -> HttpResult {
    match users.items.read().unwrap().get(&id) {
        Some(user) => ok!(user),
        None => not_found!(),
    }
}

async fn create_user(Json(user): Json<User>, users: Dc<Users>) -> HttpResult {
    users.items.write().unwrap().insert(user.id, user.clone());
    created!(user)
}
```

Как и в других стеках, `id`, который не является числом, и тело, которое не является корректным JSON, не доходят до обработчика. Волга сама отвечает на них `400`, потому что типы аргументов говорят, что должно быть в запросе.

## Знакомые имена

| Понятие | ASP.NET Core | Spring Boot | Go | Волга |
|---|---|---|---|---|
| Запуск сервера | `builder.Build()`, `app.Run()` | `SpringApplication.run` | `http.ListenAndServe` | `App::new()`, `app.run().await`, [`bind()`](/volga-docs/ru/getting-started/quick-start.html) |
| Маршрут | `app.MapGet(..)` | `@GetMapping` | `mux.HandleFunc("GET ..")` | [`app.map_get(..)`](/volga-docs/ru/getting-started/handlers.html) |
| Группа маршрутов | `app.MapGroup("/api")` | `@RequestMapping` на классе | `r.Route("/api", ..)` (chi) | [`app.group("/api", \|g\| ..)`](/volga-docs/ru/getting-started/route-groups.html) |
| Параметр пути | `int id`, `[FromRoute]` | `@PathVariable` | `r.PathValue("id")` | [`id: u32`, `Path<T>`, `NamedPath<T>`](/volga-docs/ru/getting-started/route-params.html) |
| Строка запроса | `[FromQuery]`, `[AsParameters]` | `@RequestParam` | `r.URL.Query()` | [`Query<T>`](/volga-docs/ru/getting-started/query-params.html) |
| Тело JSON | `[FromBody] T` | `@RequestBody` | `json.NewDecoder(r.Body)` | [`Json<T>`](/volga-docs/ru/requests-responses/json-payload.html) |
| Заголовок | `[FromHeader]` | `@RequestHeader` | `r.Header.Get(..)` | [`Header<T>`, `HttpHeaders`](/volga-docs/ru/requests-responses/headers.html) |
| Ответ со статусом | `Results.Ok(x)`, `Results.Created(..)` | `ResponseEntity.ok(x)` | `w.WriteHeader(..)` | [`ok!(x)`, `created!(x)`, `not_found!()`](/volga-docs/ru/getting-started/responses.html) |
| Обработка ошибок | обработчик исключений, `UseExceptionHandler` | `@ControllerAdvice`, `@ExceptionHandler` | вернуть `error` и записать его | [`Result<T, E>`, `map_err`](/volga-docs/ru/reliability-observability/errors.html) |
| Problem Details | `AddProblemDetails()` | `ProblemDetail` | | [`map_problem()`, `Problem`](/volga-docs/ru/reliability-observability/errors.html#problem-details) |
| Middleware | `app.Use(async (ctx, next) => ..)` | servlet `Filter` | `func(http.Handler) http.Handler` | [`with()`, `wrap()`](/volga-docs/ru/middleware-infrastructure/middleware.html#код-вокруг-обработчика) |
| Фильтр эндпоинта | `AddEndpointFilter` | `HandlerInterceptor` | middleware | [`filter()`](/volga-docs/ru/middleware-infrastructure/middleware.html#фильтры) |
| Внедрение зависимостей | `AddSingleton`, `AddScoped`, `AddTransient` | `@Service`, `@Scope` | ручная сборка зависимостей | [`add_singleton`, `add_scoped_factory`, `add_transient_factory`, `Dc<T>`](/volga-docs/ru/advanced-patterns/di.html) |
| Конфигурация | `appsettings.json`, `IOptions<T>` | `application.yml`, `@ConfigurationProperties` | переменные окружения, флаги | [`app_config.toml`, `Config<T>`](/volga-docs/ru/middleware-infrastructure/config-files.html) |
| Валидация | Data Annotations, FluentValidation | `@Valid`, Bean Validation | `go-playground/validator` | [`Valid<T>`, `Validate`](/volga-docs/ru/requests-responses/validation.html) |
| JWT-аутентификация | `AddJwtBearer`, `RequireAuthorization` | Spring Security | middleware | [`with_bearer_auth`, `authorize`](/volga-docs/ru/security-access/auth.html) |
| CORS | `AddCors`, `UseCors` | `@CrossOrigin` | `rs/cors` | [`with_cors`, `use_cors`](/volga-docs/ru/middleware-infrastructure/cors.html) |
| Rate limiting | `AddRateLimiter` | Bucket4j | `x/time/rate` | [`with_token_bucket`, `token_bucket`](/volga-docs/ru/middleware-infrastructure/rate-limiting.html) |
| OpenAPI | `AddOpenApi`, Swashbuckle | springdoc-openapi | swaggo | [`with_open_api`, `use_open_api`](/volga-docs/ru/middleware-infrastructure/openapi.html) |
| Статические файлы | `UseStaticFiles` | `resources/static` | `http.FileServer` | [`use_static_files`](/volga-docs/ru/middleware-infrastructure/static-files.html) |
| Отмена запроса | `HttpContext.RequestAborted` | | `r.Context().Done()` | [`CancellationToken`](/volga-docs/ru/reliability-observability/cancellation.html) |
| Плавное завершение работы | `IHostApplicationLifetime` | `server.shutdown=graceful` | `srv.Shutdown(ctx)` | [встроено, `ShutdownHandle`](/volga-docs/ru/reliability-observability/graceful-shutdown.html) |
| Интеграционные тесты | `WebApplicationFactory` | `@SpringBootTest`, `MockMvc` | `httptest.NewServer` | [`TestServer`](/volga-docs/ru/reliability-observability/testing.html) |

## Что работает иначе

* **Ни атрибутов, ни рефлексии.** Маршруты, middleware и сервисы регистрируются в коде, а сигнатура обработчика это его контракт. Обработчик, который читает то, чего запрос дать не может, не компилируется или останавливает приложение при старте, а не роняет запрос в продакшене.
* **Ошибки это значения.** Ловить исключения не нужно. Обработчик возвращает `Result`, `?` передаёт ошибку выше, а обработчик ошибок превращает её в ответ. Голая строка в качестве ошибки отвечает `500`, поэтому дайте клиентской ошибке статус: `Err((StatusCode::BAD_REQUEST, "name is required"))`.
* **Всё асинхронно, на Tokio.** Обработчик это `async fn` или замыкание. Блокирующий код, например `std::fs` или синхронный драйвер базы данных, уходит в [`blocking`](/volga-docs/ru/advanced-patterns/blocking.html), как вы использовали бы `Task.Run` или отдельный пул потоков.
* **Общие сервисы доступны только для чтения.** `Dc<T>` даёт `&T`, потому что singleton одновременно разделяют все запросы. Изменяемое состояние живёт внутри сервиса за `Mutex`, `RwLock` или атомиком, как в `Users` выше.
* **Возможности включаются явно.** Сборка по умолчанию содержит только HTTP-сервер. DI, middleware, аутентификация и остальное это [фичи Cargo](/volga-docs/ru/getting-started/features.html); пока вы изучаете Волгу, `features = ["full"]` включает их все.
* **Проверки при старте ловят ошибки сборки.** `App::run()` не запускается, если обработчик принимает сервис, который никто не зарегистрировал, а `map_*` паникует, если обработчик читает параметр пути, которого маршрут не объявляет.

Дальше пройдите [Быстрый старт](/volga-docs/ru/getting-started/quick-start.html), затем прочитайте [Обработчики](/volga-docs/ru/getting-started/handlers.html) и [Экстракторы](/volga-docs/ru/getting-started/extractors.html).
