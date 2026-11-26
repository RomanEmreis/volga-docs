# Coming from ASP.NET Core, Spring or Go

If you have built HTTP services in another stack, you already know most of Volga. It is closest to ASP.NET Core minimal APIs: routes are registered in code on an `App`, a handler's arguments say what it reads from the request, and services come from a container with the familiar three lifetimes. This page maps the names you know to Volga's, and lists what works differently in Rust.

## The Same Service in Four Stacks

A small users API: `GET /users/{id}` answers the user as JSON or `404`, and `POST /users` stores one and answers `201`.

**ASP.NET Core (minimal APIs)**

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

**Volga**

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

As in the other stacks, an `id` that is not a number and a body that is not valid JSON never reach the handler. Volga answers them `400` itself, because the argument types say what the request must contain.

## Names You Know

| Concept | ASP.NET Core | Spring Boot | Go | Volga |
|---|---|---|---|---|
| Start the server | `builder.Build()`, `app.Run()` | `SpringApplication.run` | `http.ListenAndServe` | `App::new()`, `app.run().await`, [`bind()`](/volga-docs/en/getting-started/quick-start.html) |
| Route | `app.MapGet(..)` | `@GetMapping` | `mux.HandleFunc("GET ..")` | [`app.map_get(..)`](/volga-docs/en/getting-started/handlers.html) |
| Route group | `app.MapGroup("/api")` | `@RequestMapping` on a class | `r.Route("/api", ..)` (chi) | [`app.group("/api", \|g\| ..)`](/volga-docs/en/getting-started/route-groups.html) |
| Path parameter | `int id`, `[FromRoute]` | `@PathVariable` | `r.PathValue("id")` | [`id: u32`, `Path<T>`, `NamedPath<T>`](/volga-docs/en/getting-started/route-params.html) |
| Query string | `[FromQuery]`, `[AsParameters]` | `@RequestParam` | `r.URL.Query()` | [`Query<T>`](/volga-docs/en/getting-started/query-params.html) |
| JSON body | `[FromBody] T` | `@RequestBody` | `json.NewDecoder(r.Body)` | [`Json<T>`](/volga-docs/en/requests-responses/json-payload.html) |
| Header | `[FromHeader]` | `@RequestHeader` | `r.Header.Get(..)` | [`Header<T>`, `HttpHeaders`](/volga-docs/en/requests-responses/headers.html) |
| Response with a status | `Results.Ok(x)`, `Results.Created(..)` | `ResponseEntity.ok(x)` | `w.WriteHeader(..)` | [`ok!(x)`, `created!(x)`, `not_found!()`](/volga-docs/en/getting-started/responses.html) |
| Error handling | exception handler, `UseExceptionHandler` | `@ControllerAdvice`, `@ExceptionHandler` | return an `error`, write it | [`Result<T, E>`, `map_err`](/volga-docs/en/reliability-observability/errors.html) |
| Problem Details | `AddProblemDetails()` | `ProblemDetail` | | [`map_problem()`, `Problem`](/volga-docs/en/reliability-observability/errors.html#problem-details) |
| Middleware | `app.Use(async (ctx, next) => ..)` | servlet `Filter` | `func(http.Handler) http.Handler` | [`with()`, `wrap()`](/volga-docs/en/middleware-infrastructure/middleware.html#running-code-around-the-handler) |
| Endpoint filter | `AddEndpointFilter` | `HandlerInterceptor` | middleware | [`filter()`](/volga-docs/en/middleware-infrastructure/middleware.html#filters) |
| Dependency injection | `AddSingleton`, `AddScoped`, `AddTransient` | `@Service`, `@Scope` | wiring by hand | [`add_singleton`, `add_scoped_factory`, `add_transient_factory`, `Dc<T>`](/volga-docs/en/advanced-patterns/di.html) |
| Configuration | `appsettings.json`, `IOptions<T>` | `application.yml`, `@ConfigurationProperties` | env vars, flags | [`app_config.toml`, `Config<T>`](/volga-docs/en/middleware-infrastructure/config-files.html) |
| Validation | Data Annotations, FluentValidation | `@Valid`, Bean Validation | `go-playground/validator` | [`Valid<T>`, `Validate`](/volga-docs/en/requests-responses/validation.html) |
| JWT authentication | `AddJwtBearer`, `RequireAuthorization` | Spring Security | middleware | [`with_bearer_auth`, `authorize`](/volga-docs/en/security-access/auth.html) |
| CORS | `AddCors`, `UseCors` | `@CrossOrigin` | `rs/cors` | [`with_cors`, `use_cors`](/volga-docs/en/middleware-infrastructure/cors.html) |
| Rate limiting | `AddRateLimiter` | Bucket4j | `x/time/rate` | [`with_token_bucket`, `token_bucket`](/volga-docs/en/middleware-infrastructure/rate-limiting.html) |
| OpenAPI | `AddOpenApi`, Swashbuckle | springdoc-openapi | swaggo | [`with_open_api`, `use_open_api`](/volga-docs/en/middleware-infrastructure/openapi.html) |
| Static files | `UseStaticFiles` | `resources/static` | `http.FileServer` | [`use_static_files`](/volga-docs/en/middleware-infrastructure/static-files.html) |
| Request cancellation | `HttpContext.RequestAborted` | | `r.Context().Done()` | [`CancellationToken`](/volga-docs/en/reliability-observability/cancellation.html) |
| Graceful shutdown | `IHostApplicationLifetime` | `server.shutdown=graceful` | `srv.Shutdown(ctx)` | [built in, `ShutdownHandle`](/volga-docs/en/reliability-observability/graceful-shutdown.html) |
| Integration tests | `WebApplicationFactory` | `@SpringBootTest`, `MockMvc` | `httptest.NewServer` | [`TestServer`](/volga-docs/en/reliability-observability/testing.html) |

## What Works Differently

* **No attributes, no reflection.** Routes, middleware and services are registered in code, and a handler's signature is its contract. A handler that reads something the request cannot provide fails to compile, or stops the app at startup, instead of failing a request in production.
* **Errors are values.** There are no exceptions to catch. A handler returns `Result`, `?` passes an error up, and the error handler turns it into a response. A bare string as the error answers `500`, so give a client error its status: `Err((StatusCode::BAD_REQUEST, "name is required"))`.
* **Everything is async on Tokio.** A handler is an `async fn` or a closure. Code that blocks, such as `std::fs` or a synchronous database driver, goes into [`blocking`](/volga-docs/en/advanced-patterns/blocking.html), the way you would use `Task.Run` or a separate executor.
* **Shared services are read-only handles.** `Dc<T>` gives `&T`, as a singleton is shared by every request at once. State that changes lives behind a `Mutex`, an `RwLock` or an atomic inside the service, as `Users` does above.
* **You opt into features.** The default build is the HTTP server alone. DI, middleware, auth and the rest are [Cargo features](/volga-docs/en/getting-started/features.html); `features = ["full"]` turns them all on while you learn.
* **Startup checks catch wiring mistakes.** `App::run()` refuses to start when a handler takes a service nobody registered, and `map_*` panics when a handler reads a path parameter its route does not declare.

Next, follow the [Quick Start](/volga-docs/en/getting-started/quick-start.html), then read [Handlers](/volga-docs/en/getting-started/handlers.html) and [Extractors](/volga-docs/en/getting-started/extractors.html), or build a whole service in the [tutorial](/volga-docs/en/tutorial/overview.html).
