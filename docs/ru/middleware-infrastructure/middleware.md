# Middleware

Middleware это код, который выполняется для каждого запроса своей области до или после обработчика: проверка API-ключа, добавление заголовка, логирование, замер времени. Его можно зарегистрировать на всё приложение `App`, на [группу маршрутов](/volga-docs/ru/getting-started/route-groups.html) или на один маршрут, и у всех трёх одни и те же методы. Запрос сначала проходит middleware приложения, затем группы, затем маршрута, а ответ возвращается тем же путём.

## Включение поддержки middleware

Если вы не используете набор фич `full`, включите фичу `middleware` в `Cargo.toml`:

```toml
[dependencies]
volga = { version = "0.15", features = ["middleware"] }
```

## Выбор метода

| Метод | Зачем | Когда выполняется |
|---|---|---|
| [`filter()`](#фильтры) | отклонить запрос до обработчика | до обработчика |
| [`tap_req()`](#обработка-входящего-запроса) | изменить запрос: добавить заголовок, заменить тело | до обработчика |
| [`map_ok()`](#обработка-успешного-ответа) | изменить успешный ответ | после обработчика |
| [`map_err()`](#обработка-ошибок) | превратить ошибку в ответ | после ошибки |
| [`with()`](#код-вокруг-обработчика) | выполнить код вокруг обработчика или ответить вместо него | вокруг обработчика |
| [`wrap()`](#with-или-wrap) | то же, но со всем запросом, включая тело | вокруг обработчика |
| [`attach()`](/volga-docs/ru/middleware-infrastructure/parameterized-middleware.html) | зарегистрировать переиспользуемый тип middleware со своими настройками | вокруг обработчика |

Начинайте с самого узкого метода, которого хватает для задачи. Первые четыре принимают [экстракторы](/volga-docs/ru/getting-started/extractors.html), как обработчик, и по их сигнатуре видно, что они могут изменить. Если вы пришли из ASP.NET Core или Go, `with()` и `wrap()` это привычный middleware, который вызывает `next`, а остальные четыре метода это сокращения для самых частых его применений.

## Фильтры

Метод [`filter()`](https://docs.rs/volga/latest/volga/app/router/struct.Route.html#method.filter) позволяет задать условную логику (например, проверку прав или валидацию) для конкретного маршрута или группы маршрутов.

```rust compile
use volga::{App, Path};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // Разрешаем только положительные числа
    app.group("/positive", |g| {
        g.filter(|Path((x, y)): Path<(i32, i32)>| async move { x >= 0 && y >= 0 });
        g.map_get("/sum/{x}/{y}", sum);
    });
    
    // Разрешаем только отрицательные числа
    app.map_get("/negative/sum/{x}/{y}", sum)
        .filter(|Path((x, y)): Path<(i32, i32)>| async move { x < 0 && y < 0 });

    app.run().await
}

async fn sum(x: i32, y: i32) -> i32 {
    x + y
}
```

### Что возвращает фильтр

Вердикт фильтра — это `bool`, `()`, [`FilterResult`](https://docs.rs/volga/latest/volga/http/response/filter_result/struct.FilterResult.html) или `Result<(), E>`. Остановленный фильтром запрос уходит в [обработчик ошибок](/volga-docs/ru/reliability-observability/errors.html) со статусом того, что вернул фильтр:

| Фильтр возвращает | Ответ |
|---|---|
| `false` или `FilterResult::err()` | `400 Bad Request` с сообщением `Request rejected by filter` |
| `Err` чего угодно со статусом — `Error`, `StatusCode`, `(StatusCode, E)`, `std::io::Error`, `ValidationError`, `OAuthError`, `Problem`, ваш тип, реализующий [`IntoError`](https://docs.rs/volga/latest/volga/error/trait.IntoError.html) | этот статус — тот же, что получил бы такой `Err` из [обработчика](/volga-docs/ru/reliability-observability/errors.html#возврат-ошибок-из-обработчика) |
| `Err` строки или `Box<dyn std::error::Error + Send + Sync>` | `400 Bad Request` с этим сообщением |

Фильтр отклоняет запрос по любой причине — из-за отсутствующего API-ключа так же часто, как из-за неверного параметра, — поэтому сообщение для `false` никакой причины не называет. Фильтр, которому нужен собственный статус или сообщение, возвращает `Err`.

Последняя строка — единственное отличие от обработчика, где строка даёт `500`: ошибка без собственного статуса, возвращённая фильтром, считается причиной отказа в запросе. Ошибка со статусом его сохраняет — `OAuthError` отвечает `401` для `invalid_token` и `403` для `insufficient_scope`, а `Error` сохраняет свой instance и [прикреплённый ответ](/volga-docs/ru/reliability-observability/errors.html#ответ-с-собственным-телом).

```rust compile
use volga::{App, headers::HttpHeaders, http::StatusCode};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // 401 Unauthorized без заголовка
    app.filter(|headers: HttpHeaders| match headers.get_raw("x-api-key") {
        Some(_) => Ok(()),
        None => Err((StatusCode::UNAUTHORIZED, "missing API key")),
    });

    app.map_get("/sum/{x}/{y}", |x: i32, y: i32| x + y);

    app.run().await
}
```

[`FilterResult::with_error()`](https://docs.rs/volga/latest/volga/http/response/filter_result/struct.FilterResult.html#method.with_error) принимает те же типы и отвечает так же, как `Err` с этой ошибкой.

::: warning Одного std::error::Error недостаточно
`Err` фильтра должен быть `Error` или реализовывать `IntoError`. Тип, который реализует только `std::error::Error`, — `ParseIntError`, ошибка из другого крейта — там не компилируется; дайте ему статус через `.map_err(|err| (StatusCode::BAD_REQUEST, err))` или оберните в собственный тип ошибки, реализующий `IntoError`.
:::

## Обработка входящего запроса

Метод [`tap_req()`](https://docs.rs/volga/latest/volga/app/router/struct.Route.html#method.tap_req) позволяет получить доступ к [`HttpRequestMut`](https://docs.rs/volga/latest/volga/http/request/struct.HttpRequestMut.html), чтобы модифицировать или исследовать запрос до обработки.

```rust compile
use volga::{App, HttpRequestMut, headers};

headers! {
    (CustomHeader, "x-custom-header")
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app
        .map_get("/sum/{x}/{y}", |x: i32, y: i32| async move { x + y })
        .tap_req(|mut req: HttpRequestMut| async move { 
            req.try_insert_header::<CustomHeader>("Custom Value")?;
            Ok(req)
        });

    app.run().await
}
```

Как `with` и `filter`, `tap_req` принимает экстракторы после первого аргумента: параметры пути и строки запроса, заголовки, `Dc<T>`, [собственный экстрактор](/volga-docs/ru/advanced-patterns/custom-extractors.html). Они читаются до запуска замыкания, поэтому описывают запрос таким, каким он пришёл в этот middleware:

```rust compile
use serde::Deserialize;
use volga::{App, HttpRequestMut, Query, headers};

headers! {
    (Locale, "x-locale")
}

#[derive(Deserialize)]
struct Lang {
    lang: String,
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // GET /hello?lang=fr доходит до обработчика с `x-locale: fr`
    app.tap_req(|mut req: HttpRequestMut, q: Query<Lang>| {
        req.try_insert_header::<Locale>(q.lang.as_str())?;
        Ok(req)
    });

    app.map_get("/hello", || "hello");

    app.run().await
}
```

Если экстрактор не сработал, замыкание не запускается, и на запрос отвечают ошибкой экстрактора.

### Замена тела

[`map_body()`](https://docs.rs/volga/latest/volga/http/request/struct.HttpRequestMut.html#method.map_body) и [`try_map_body()`](https://docs.rs/volga/latest/volga/http/request/struct.HttpRequestMut.html#method.try_map_body) ставят новое тело на место тела запроса — например, распакованное алгоритмом, которого в Волге нет:

```rust compile
use volga::{App, HttpBody, HttpRequestMut, Json, error::Error, ok};

fn decompress(body: HttpBody) -> Result<HttpBody, Error> {
    // например, обернуть поток в декодер
    Ok(body)
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.tap_req(|req: HttpRequestMut| req.try_map_body(decompress));
    app.map_post("/items", |item: Json<serde_json::Value>| ok!("{}", item.0));

    app.run().await
}
```

[`try_map_body_async()`](https://docs.rs/volga/latest/volga/http/request/struct.HttpRequestMut.html#method.try_map_body_async) сначала читает тело — например, чтобы проверить подпись, — и возвращает байты обработчику:

```rust compile
use http_body_util::BodyExt;
use volga::{App, HttpBody, HttpRequestMut, Json, error::Error, http::StatusCode, ok};

fn verify_signature(bytes: &[u8]) -> Result<(), Error> {
    if bytes.is_empty() {
        return Err((StatusCode::UNAUTHORIZED, "unsigned payload").into());
    }
    Ok(())
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.tap_req(|req: HttpRequestMut| async move {
        req.try_map_body_async(|body| async move {
            let bytes = body.collect().await?.to_bytes();
            verify_signature(&bytes)?;
            Ok(HttpBody::full(bytes))
        })
        .await
    });

    app.map_post("/webhook", |event: Json<serde_json::Value>| ok!("{}", event.0));

    app.run().await
}
```

* Новое тело читается под [ограничением размера тела](/volga-docs/ru/requests-responses/body.html#ограничение-размера-тела) запроса, как и старое, поэтому тело, которое растёт по пути, получает `413`, как только превысит ограничение.
* Заголовки остаются как есть. Заголовок, который больше не описывает тело, например `Content-Length` или `Content-Encoding`, удаляется через `remove_header()`.
* `HttpRequestMut::into_parts()` и `from_parts()` устарели: они отдавали расширения запроса, в которых лежит собственное состояние Волги для запроса. Тело заменяйте этими методами, а заголовки — собственными методами `HttpRequestMut`.

## Обработка успешного ответа

Метод [`map_ok()`](https://docs.rs/volga/latest/volga/app/router/struct.Route.html#method.map_ok) позволяет изменить или дополнить HTTP-ответ после успешной обработки.

```rust compile
use volga::{App, HttpResponse, HttpResult, headers};

headers! {
    (CustomHeader, "x-custom-header")
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.group("/positive", |g| {
        g.map_ok(group_response);
        g.map_get("/sum/{x}/{y}", sum);
    });

    app.map_get("/negative/sum/{x}/{y}", sum)
        .map_ok(route_response);

    app.run().await
}

async fn group_response(mut resp: HttpResponse) -> HttpResult {
    resp.try_insert_header::<CustomHeader>("for-group")?;
    Ok(resp)
}

async fn route_response(mut resp: HttpResponse) -> HttpResult {
    resp.try_insert_header::<CustomHeader>("for-route")?;
    Ok(resp)
}

async fn sum(x: i32, y: i32) -> i32 {
    x + y
}
```

`map_ok` видит только успешные ответы. Ошибка, в том числе `401`, `404` или `429`, которые [создаёт сама Волга](/volga-docs/ru/reliability-observability/errors.html#ошибки-которые-создает-волга), уходит в `map_err`.

## Обработка ошибок

Метод [`map_err()`](https://docs.rs/volga/latest/volga/app/router/struct.Route.html#method.map_err) позволяет определить кастомную логику обработки ошибок — глобально, для отдельного маршрута или для группы.

```rust compile
use volga::{App, error::{Error, ProblemDetails}};
use std::io::Error as IoError;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();
    
    app.map_get("/error", produce_err)
        .map_err(handle_err);

    app.run().await
}

async fn handle_err(error: Error) -> ProblemDetails {
    ProblemDetails::from(error)
}

async fn produce_err() -> IoError {
    IoError::other("some error")
}
```

Любой `Err`, который возвращает обработчик, доходит до этого `map_err` как `Error` — включая `Err(StatusCode::NOT_FOUND)` и `Err` вашего собственного типа ошибки.

`map_err` маршрута или группы охватывает всю область вместе с её middleware, в каком бы порядке его ни зарегистрировали, а второй такой вызов заменяет первый. См. [Обработчик ошибок маршрута или группы](/volga-docs/ru/reliability-observability/errors.html#обработчик-ошибок-маршрута-или-группы).

::: tip
Если вызвать [`map_err()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_err) у [`App`](https://docs.rs/volga/latest/volga/app/struct.App.html), вы настроите глобальный обработчик ошибок. Подробнее о глобальной обработке ошибок читайте [здесь](/volga-docs/ru/reliability-observability/errors.html).
:::

## Код вокруг обработчика

[`with()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.with) и [`wrap()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.wrap) получают остаток конвейера как `next`. Код до `next` выполняется по пути внутрь, код после него по пути обратно. Middleware выполняются в порядке регистрации, поэтому зарегистрированный первым оказывается внешним:

```rust compile
use volga::{App, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // Middleware 1
    app.wrap(|context, next| async move {
        println!("Перед Middleware 2");
        let response = next(context).await;
        println!("После Middleware 2");
        response
    });

    // Middleware 2
    app.with(|next| async move {
        println!("Перед обработчиком запроса");
        let response = next.await;
        println!("После обработчика запроса");
        response
    });

    app.map_get("/hello", || async {
        ok!("Hello World!")
    });

    app.run().await
}
```

Middleware, который возвращается, не вызвав `next`, отвечает вместо всего, что идёт после него, включая обработчик:

```rust compile
use volga::{App, ok, status};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.with(|_| async {
        // `next` не вызывается, поэтому обработчик не выполнится
        status!(400)
    });

    app.map_get("/hello", || async {
        ok!()
    });

    app.run().await
}
```

Чтобы отклонить запрос по условию, [фильтр](#фильтры) сделает то же самое короче.

### `with()` или `wrap()`

`with()` принимает экстракторы перед `next`, как обработчик: заголовки, параметры пути и строки запроса, `Dc<T>`. Его хватает для большинства задач, но тела запроса он не видит:

```rust compile
use std::time::Instant;
use volga::{App, Path, middleware::Next};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/users/{id}", |id: u32| async move { id.to_string() })
        .with(|Path(id): Path<u32>, next: Next| async move {
            let started = Instant::now();
            let response = next.await;
            println!("user {id} answered in {:?}", started.elapsed());
            response
        });

    app.run().await
}
```

`wrap()` получает весь запрос как [`HttpContext`](https://docs.rs/volga/latest/volga/middleware/struct.HttpContext.html), вместе с телом, а это нужно сжатию, декодированию и похожим middleware. Используйте `with()`, если тело не нужно.

## Синхронные middleware

[`filter()`](https://docs.rs/volga/latest/volga/app/router/struct.Route.html#method.filter), [`map_ok()`](https://docs.rs/volga/latest/volga/app/router/struct.Route.html#method.map_ok), [`map_err()`](https://docs.rs/volga/latest/volga/app/router/struct.Route.html#method.map_err) и [`tap_req()`](https://docs.rs/volga/latest/volga/app/router/struct.Route.html#method.tap_req) принимают также обычную `fn` или замыкание, которое возвращает вердикт, ответ или запрос напрямую, когда ждать нечего, — у [`App`](https://docs.rs/volga/latest/volga/app/struct.App.html), маршрута и группы маршрутов, так же как и [обработчики](/volga-docs/ru/getting-started/handlers.html#синхронные-обработчики):

```rust compile
use volga::{App, HttpResponse, HttpResult, Path, headers, headers::HttpHeaders};

headers! {
    (CustomHeader, "x-custom-header")
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // Отклонять запросы без API-ключа
    app.filter(|headers: HttpHeaders| headers.get_raw("x-api-key").is_some());

    app.map_get("/positive/sum/{x}/{y}", |x: i32, y: i32| x + y)
        .filter(|Path((x, y)): Path<(i32, i32)>| x >= 0 && y >= 0)
        .map_ok(tag_response);

    app.run().await
}

fn tag_response(mut resp: HttpResponse) -> HttpResult {
    resp.try_insert_header::<CustomHeader>("sync")?;
    Ok(resp)
}
```

[`wrap()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.wrap), [`with()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.with) и [`attach()`](/volga-docs/ru/middleware-infrastructure/parameterized-middleware.html) остаются асинхронными: они существуют ради того, чтобы дождаться `next`.

## Запросы, не совпавшие ни с одним маршрутом

Маршрутизация выполняется первой и решает, *что* ответит на запрос. Все три её исхода — совпавший маршрут, fallback-обработчик и `405` со своим заголовком `Allow` — проходят через одну и ту же глобальную цепочку.

Из этого следуют три вещи:

* **Глобальный middleware, обрывающий конвейер, решает и судьбу несовпавших запросов.** `filter`, `with` с ранним возвратом и `authorize` выполняются до того, как известен ответ маршрутизации, поэтому глобальный middleware авторизации отвечает на несуществующий путь `401`, а не `404`, — и тем самым меньше рассказывает о том, что есть в сервисе. Middleware маршрута и группы это не затрагивает: они принадлежат маршруту, который по определению совпал.
* **Rate Limiting считает запросы, не совпавшие ни с одним маршрутом.** Бюджет лимитера расходуется трафиком, который до обработчика не доходит, поэтому рассчитывайте его по реальному трафику, а не по количеству маршрутов.
* **Скоуп запроса создаётся и для таких запросов.** [`ClientIp`](https://docs.rs/volga/latest/volga/struct.ClientIp.html), `CancellationToken`, `Config<T>`, `HostEnv` и `Dc<T>` работают внутри fallback-обработчика, и ограничение размера тела приложения действует там тоже — запрос не забрал ни один маршрут или группа, поэтому их [ограничения](/volga-docs/ru/requests-responses/body.html#для-группы-и-для-маршрута) не действуют.

### Как отличить одно от другого

Middleware, который должен работать только для реального эндпоинта, читает [`matched_route()`](https://docs.rs/volga/latest/volga/middleware/struct.HttpContext.html#method.matched_route):

```rust compile
use volga::App;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.wrap(|ctx, next| async move {
        if !ctx.matched_route() {
            // нечего учитывать для запроса, на который не ответит ни один маршрут
            return next(ctx).await;
        }

        next(ctx).await
    });

    app.run().await
}
```

Он возвращает `true`, когда маршрутизация нашла эндпоинт для этого запроса, и `false` для запросов, на которые отвечает fallback или `405`. Ответ одинаков на любом слое: собственный middleware маршрута или группы выполняется уже после того, как конвейер маршрута выбран, и по-прежнему видит `true`. Первым это использует middleware CORS — он по этому признаку решает, отвечать ли на preflight.

## Примеры

* [Пример middleware](https://github.com/RomanEmreis/volga/blob/main/examples/middleware/src/main.rs)
* [Пример фильтрации запроса](https://github.com/RomanEmreis/volga/blob/main/examples/request_validation/src/main.rs)
* [Пример обработки ответа](https://github.com/RomanEmreis/volga/blob/main/examples/response_handler/src/main.rs)
