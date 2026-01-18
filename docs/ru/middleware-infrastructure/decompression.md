# Распаковка запросов

Аналогично сжатию, Волга предоставляет функцию middleware, которая распаковывает тела HTTP-запросов на основе заголовка `Content-Encoding`. В настоящее время Волга поддерживает четыре алгоритма распаковки: [Brotli](https://ru.wikipedia.org/wiki/Brotli), [Gzip](https://ru.wikipedia.org/wiki/Gzip), [Deflate](https://ru.wikipedia.org/wiki/Deflate) и [Zstandard](https://ru.wikipedia.org/wiki/Zstandard).

## Включение распаковки

Чтобы включить распаковку запросов, убедитесь, что вы включили необходимую функцию в `Cargo.toml`. Если вы не используете набор функций `full`, вы можете отдельно подключить функцию `decompression-full` делающую доступными все алгоритмы распаковки:

```toml
[dependencies]
volga = { version = "...", features = ["decompression-full"] }
```
Если вам нужны определенные алгоритмы, вы можете указать их явно:

```toml
[dependencies]
volga = { version = "...", features = ["decompression-brotli", "decompression-gzip"] }
```

## Пример использования

Чтобы использовать распаковку в вашем приложении, используйте метод [`use_decompression()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.use_decompression) в вашем `main.rs`:

```rust
use volga::{App, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // Подключает middleware распаковывающий запросы
    app.use_decompression();

    app.map_get("/hello", || async {
        ok!("Hello, World!")
    });
    
    app.run().await
}
```
Затем вы можете проверить это с помощью команды `curl`, предварительно создав и упаковав файл `users.json.gz`, который вы можете сделать из ответа [примера](/volga-docs/ru/getting-started/compression.html#пример-использования) предыдущей темы: Сжатие ответов:
```bash
curl -v -X POST --location 'http://127.0.0.1:7878/users' \
    -H "Content-Type: application/json" \
    -H "Content-Encoding: gzip" \
    --compressed \
    --data-binary users.json.gz
```

## Принцип работы

При получении запроса middleware распаковки проверяет HTTP-заголовок `Content-Encoding`, чтобы определить алгоритм сжатия, затем обертывает поток тела запроса в соответствующий поток распаковки и удаляет HTTP-заголовок `Content-Encoding`, указывая, что тело запроса больше не сжато.
Если заголовок `Content-Encoding` не указан, то middleware игнорирует этот запрос и оставляет тело как есть.

Если заголовок `Content-Encoding` указывает на неподдерживаемый алгоритм, то middleware отвечает кодом состояния [`415 Unsupported Media Type`](https://developer.mozilla.org/ru/docs/Web/HTTP/Status/415).

Полный пример можно посмотреть [здесь](https://github.com/RomanEmreis/volga/blob/main/examples/decompression/src/main.rs)