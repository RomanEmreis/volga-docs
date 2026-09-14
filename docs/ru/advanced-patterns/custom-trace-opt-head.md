# Пользовательская обработка методов HEAD, OPTIONS и TRACE

В данном руководстве представлены различные способы обработки таких методов HTTP как `HEAD`, `OPTIONS` и `TRACE`.

## Метод HEAD
По умолчанию обработчик, замапленный на метод `GET`, отвечает и на `HEAD`: маршрутизация передаёт запрос `HEAD`, у которого нет собственного маршрута, маршруту `GET`, а тело отбрасывается на выходе.

Поэтому запрос `HEAD` проходит через всё то же, через что проходит его маршрут `GET`: middleware маршрута, middleware группы и политику CORS. Health-check на основе `HEAD`, бьющий в маршрут за `authorize`, получит `401` / `403` так же, как и `GET` рядом; если на каком-то пути `HEAD` работать не должен, для него нужен собственный `map_head`, который об этом и говорит.

Чтобы настроить поведение метода `HEAD`, явно определите его с помощью метода [`map_head`](https://docs.rs/volga/latest/volga/app/router/trait.Router.html#tymethod.map_head). `map_head` по-прежнему имеет приоритет и выполняет свои собственные middleware, а не middleware маршрута `GET`:
```rust compile
use volga::{App, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // HEAD /resource
    app.map_head("/resource", || async {
        ok!([
            ("x-custom-header", "some-value-get")
        ])
    });

    // GET /resource
    app.map_get("/resource", || async {
        ok!("Hello World!"; [
            ("x-custom-header", "some-value-get")
        ])
    });

    app.run().await
}
```
Здесь метод `HEAD` возвращает заголовки без тела, часто зеркально отражая те заголовки, которые вернул бы запрос `GET`.

::: tip
`GET` и `HEAD`, замапленные на один путь, описывают один ресурс, поэтому их параметры маршрута должны называться одинаково — `map_get("/file/{id}", ..)` рядом с `map_head("/file/{name}", ..)` приводит к панике при регистрации. См. [Параметры маршрута](/volga-docs/ru/getting-started/route-params.html#два-случая-приводящих-к-панике-при-регистрации).
:::

## Метод OPTIONS

Для специальной обработки запросов `OPTIONS` используйте метод [`map_options`](https://docs.rs/volga/latest/volga/app/router/trait.Router.html#tymethod.map_options) для сопоставления этого метода HTTP:
```rust compile
use volga::{App, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // OPTIONS /resource
    app.map_options("/resource", || async {
        ok!([
            ("Allow", "GET, OPTIONS")
        ])
    });

    // GET /resource
    app.map_get("/resource", || async {
        ok!("Hello World!")
    });

    app.run().await
}
```
Пример выше включает заголовок `Allow` для указания поддерживаемых HTTP-методов для ресурса. Тело ответа необязательно и зависит от конкретных потребностей вашего API.

## Метод TRACE

Метод `TRACE` полезен для отладки, так как он позволяет отслеживать путь запроса к серверу и возвращает сообщение запроса для диагностических целей:

```rust compile
use volga::{App, HttpRequest, stream};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // TRACE /
    app.map_trace("/", |req: HttpRequest| async move {
        let body = req.into_body().into_data_stream();
        stream!(body; [
            ("content-type", "message/http")
        ])
    });

    app.run().await
}
```
Этот обработчик захватывает входящий запрос и отправляет его обратно в ответе с соответствующим типом содержимого.

Вы можете посмотреть примеры здесь:
* [HEAD](https://github.com/RomanEmreis/volga/blob/main/examples/head_request/src/main.rs)
* [OPTIONS](https://github.com/RomanEmreis/volga/blob/main/examples/options_request/src/main.rs)
* [TRACE](https://github.com/RomanEmreis/volga/blob/main/examples/trace_request/src/main.rs)
