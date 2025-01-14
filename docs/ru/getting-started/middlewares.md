# Пользовательские Middleware

Волга предоставляет гибкий конвейер middleware, который позволяет обрабатывать и изменять HTTP-запросы и ответы последовательно через функции middleware перед передачей управления конечному обработчику запросов, а так же и после обработки.

## Обзор работы Middleware

Каждая функция middleware в конвейере должна явно вызывать замыкание [`next`](https://docs.rs/volga/latest/volga/middleware/type.Next.html) для передачи управления следующему middleware или обработчику запроса. Если замыкание [`next`](https://docs.rs/volga/latest/volga/middleware/type.Next.html) не вызвано, выполнение оставшейся части конвейера прерывается, что может быть полезно для обработки определённых условий до дальнейших этапов обработки.

Возможность вызова замыкания [`next`](https://docs.rs/volga/latest/volga/middleware/type.Next.html) предоставляет большой контроль над потоком выполнения, позволяя запускать код до или после последующих функций middleware или обработчика запроса.

## Настройка Middleware
Прежде всего, если вы не используете функцию `full`, то либо необходимо добавить функцию `middleware`, либо переключиться на `full` в вашем `Cargo.toml`:
```toml
[dependencies]
volga = { version = "0.4.4", features = ["middleware"] }
```

### Пример: Последовательное выполнение Middleware

Практический пример настройки последовательного выполнения middleware в Volga:
```rust
use volga::{App, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    // Настройка сервера
    let mut app = App::new();

    // Middleware 1
    app.use_middleware(|context, next| async move {
        // Код до выполнения Middleware 2
        println!("Перед Middleware 2");

        let response = next(context).await;

        // Код после завершения Middleware 2
        println!("После Middleware 2");

        response
    });

    // Middleware 2
    app.use_middleware(|context, next| async move {
        // Код до выполнения обработчика запроса
        println!("Перед обработчиком запроса");

        let response = next(context).await;

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
    app.use_middleware(|context, next| async move {
        // Код до выполнения Middleware 2
        println!("Обработано Middleware 1");

        let response = next(context).await;

        // Код после завершения Middleware 2
        println!("Возврат в Middleware 1");

        response
    });

    // Middleware 2
    app.use_middleware(|context, _next| async move {
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

Полный пример можно найти [здесь](https://github.com/RomanEmreis/volga/blob/main/examples/middleware.rs).