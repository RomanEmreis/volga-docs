# Сжатие ответов

Волга предоставляет middleware, которое сжимает тела ответов HTTP на основе заголовка `Accept-Encoding`. В настоящее время поддерживается четыре алгоритма сжатия: [Brotli](https://ru.wikipedia.org/wiki/Brotli), [Gzip](https://ru.wikipedia.org/wiki/Gzip), [Deflate](https://ru.wikipedia.org/wiki/Deflate) и [Zstandard](https://ru.wikipedia.org/wiki/Zstandard).

## Включение сжатия

Чтобы включить сжатие ответов, убедитесь, что вы включили необходимую функцию в `Cargo.toml`. Если вы не используете набор функций `full`, вы можете отдельно подключить функцию `compression-full` делающую доступными все алгоритмы сжатия:

```toml
[dependencies]
volga = { version = "...", features = ["compression-full"] }
```
Если вам нужны определенные алгоритмы сжатия, вы можете указать их явно:

```toml
[dependencies]
volga = { version = "...", features = ["compression-brotli", "compression-gzip"] }
```

## Пример использования

Чтобы использовать сжатие в вашем приложении, используйте метод [`use_compression()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.use_compression) в вашем `main.rs`:
```rust
use volga::{App, ok};
use serde::Serialize;
 
#[derive(Serialize)]
struct User {
    name: String,
    age: i32
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // Подключает middleware сжимающий ответы
    app.use_compression();

    app.map_get("/users", || async {
        let mut values = Vec::new();
        for i in 0..10000 {
            values.push(User { 
                age: i, 
                name: i.to_string()
            });
        }
        ok!(values)
    });
    
    app.run().await
}
```
Затем вы можете протестировать это с помощью команды `curl`:
```bash
> curl -v --location "http://127.0.0.1:7878/users" \
      -H "Accept-Encoding: br" \
      -H "Content-Type: application/json"
```
```bash
*   Trying 127.0.0.1:7878...
* Connected to 127.0.0.1 (127.0.0.1) port 7878
> GET /hello HTTP/1.1
> Host: 127.0.0.1:7878
> User-Agent: curl/8.9.1
> Accept: */*
> Accept-Encoding: br
> Content-Type: application/json
>
* Request completely sent off
< HTTP/1.1 200 OK
< server: Volga
< content-type: application/json
< vary: accept-encoding
< content-encoding: br
< transfer-encoding: chunked
< date: Fri, 10 Jan 2025 14:14:37 GMT
<
...binary data
```

## Принцип работы

При получении запроса middleware сжатия проверяет HTTP-заголовок `Accept-Encoding`, чтобы определить подходящий алгоритм сжатия, учитывая, при этом, доступность требуемой функции и q-value (q-factor), если предоставлено несколько вариантов. Затем middleware сжимает тело ответа с помощью выбранного алгоритма и устанавливает HTTP-заголовок `Content-Encoding` соответствующим образом.

Если заголовок `Accept-Encoding` указывает неподдерживаемый сервером алгоритм, то middleware отвечает кодом состояния [`406 Not Acceptable`](https://developer.mozilla.org/ru/docs/Web/HTTP/Status/406).

Полный пример можно посмотреть [здесь](https://github.com/RomanEmreis/volga/blob/main/examples/compression/src/main.rs)