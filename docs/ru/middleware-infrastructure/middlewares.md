# Пользовательские Middleware

Волга предоставляет гибкий конвейер middleware, который позволяет обрабатывать и изменять HTTP-запросы и ответы последовательно через функции middleware перед передачей управления конечному обработчику запросов, а так же и после обработки.

## Обзор работы Middleware

Каждая функция middleware в конвейере должна явно вызывать замыкание [`next`](https://docs.rs/volga/latest/volga/middleware/type.NextFn.html) для передачи управления следующему middleware или обработчику запроса. Если замыкание [`next`](https://docs.rs/volga/latest/volga/middleware/type.NextFn.html) не вызвано, выполнение оставшейся части конвейера прерывается, что может быть полезно для обработки определённых условий до дальнейших этапов обработки.

Возможность вызова замыкания [`next`](https://docs.rs/volga/latest/volga/middleware/type.NextFn.html) предоставляет большой контроль над потоком выполнения, позволяя запускать код до или после последующих функций middleware или обработчика запроса.

## Настройка Middleware
Прежде всего, если вы не используете функцию `full`, то либо необходимо добавить функцию `middleware`, либо переключиться на `full` в вашем `Cargo.toml`:
```toml
[dependencies]
volga = { version = "...", features = ["middleware"] }
```

### Пример: Последовательное выполнение Middleware

Практический пример настройки последовательного выполнения middleware в Volga:
```rust compile
use volga::{App, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    // Настройка сервера
    let mut app = App::new();

    // Middleware 1
    app.wrap(|context, next| async move {
        // Код до выполнения Middleware 2
        println!("Перед Middleware 2");

        let response = next(context).await;

        // Код после завершения Middleware 2
        println!("После Middleware 2");

        response
    });

    // Middleware 2
    app.with(|next| async {
        // Код до выполнения обработчика запроса
        println!("Перед обработчиком запроса");

        let response = next.await;

        // Код после завершения обработчика запроса
        println!("После обработчика запроса");

        response
    });
    
    // Пример обработчика запроса
    app.map_get("/hello", || async {
        ok!("Hello World!")
    });
    
    // Запуск сервера
    app.run().await
}
```

### Пример: Прерывание конвейера Middleware
Следующий пример демонстрирует, как прервать выполнение конвейера middleware, чтобы предотвратить выполнение обработчика запроса. Такой подход особенно полезен для реализации авторизационных фильтров или проверок, которые могут завершить запрос на раннем этапе:
```rust
use volga::{App, ok, status};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    // Настройка сервера
    let mut app = App::new();

    // Middleware 1
    app.wrap(|context, next| async move {
        // Код до выполнения Middleware 2
        println!("Обработано Middleware 1");

        let response = next(context).await;

        // Код после завершения Middleware 2
        println!("Возврат в Middleware 1");

        response
    });

    // Middleware 2
    app.wrap(|_| async {
        // Немедленный возврат без вызова 'next', прерывание конвейера
        status!(400)
    });
    
    // Пример асинхронного обработчика запроса
    app.map_get("/hello", || async {
        // Этот код никогда не будет выполнен
        ok!()
    });
    
    // Запуск сервера
    app.run().await
}
```

## Запросы, не совпавшие ни с одним маршрутом

Маршрутизация выполняется первой и решает, *что* ответит на запрос. Все три её исхода — совпавший маршрут, fallback-обработчик и `405` со своим заголовком `Allow` — проходят через одну и ту же глобальную цепочку.

Из этого следуют три вещи:

* **Глобальный middleware, обрывающий конвейер, решает и судьбу несовпавших запросов.** `filter`, `with` с ранним возвратом и `authorize` выполняются до того, как известен ответ маршрутизации, поэтому глобальный middleware авторизации отвечает на несуществующий путь `401`, а не `404`, — и тем самым меньше рассказывает о том, что есть в сервисе. Middleware маршрута и группы это не затрагивает: они принадлежат маршруту, который по определению совпал.
* **Ограничение частоты считает запросы, не совпавшие ни с одним маршрутом.** Бюджет лимитера расходуется трафиком, который до обработчика не доходит, поэтому рассчитывайте его по реальному трафику, а не по количеству маршрутов.
* **Скоуп запроса создаётся и для таких запросов.** [`ClientIp`](https://docs.rs/volga/latest/volga/struct.ClientIp.html), `CancellationToken`, `Config<T>`, `HostEnv` и `Dc<T>` работают внутри fallback-обработчика, и настроенный лимит тела запроса действует там тоже.

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

## .wrap() и .with()

Как вы могли заметить, для настройки конвейера промежуточных обработчиков доступны два схожих метода. Метод [`wrap()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.wrap) предоставляет низкоуровневый доступ и полный контроль над всем объектом [`HttpRequest`](https://docs.rs/volga/latest/volga/http/request/struct.HttpRequest.html), включая [`HttpBody`](https://docs.rs/volga/latest/volga/http/body/struct.HttpBody.html). Это делает его особенно подходящим для сложных сценариев, таких как сжатие, распаковка, кодирование или декодирование. В свою очередь, метод [`with()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.with) ориентирован на удобство и покрывает около 80% типичных случаев. Он предоставляет гибкий доступ к внедрению зависимостей, [`HttpHeaders`](https://docs.rs/volga/latest/volga/headers/header/struct.HttpHeaders.html) и других метаданных запроса, однако не позволяет получить доступ к телу запроса.

::: tip
Как правило, рекомендуется использовать [`with()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.with), если только вам не нужен доступ к телу запроса.
:::

Полный пример можно найти [здесь](https://github.com/RomanEmreis/volga/blob/main/examples/middleware/src/main.rs).