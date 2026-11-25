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

```rust compile
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
Затем вы можете проверить это с помощью команды `curl`, предварительно создав и упаковав файл `users.json.gz`, который вы можете сделать из ответа [примера](/volga-docs/ru/middleware-infrastructure/compression.html#пример-использования) предыдущей темы: Сжатие ответов:
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

На тело, которое не является корректным потоком своего `Content-Encoding`, — мусор или оборванный поток — начиная с **0.15.1** Волга отвечает [`400 Bad Request`](https://developer.mozilla.org/ru/docs/Web/HTTP/Status/400) с текстом `Decompression error: InvalidCompressedBody`. Раньше на большинство таких тел приходил `500`.

На тело, превысившее ограничение распаковки, заданное через [`with_decompression_limits()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.with_decompression_limits) (или, начиная с **0.14.1**, переданное целиком через [`set_decompression_limits()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.set_decompression_limits)), Волга отвечает [`413 Content Too Large`](https://developer.mozilla.org/ru/docs/Web/HTTP/Status/413) — так же, как на тело больше [ограничения размера тела запроса](/volga-docs/ru/requests-responses/body.html#ограничение-размера-тела). Ограничение размера тела считается по распакованному телу.

Алгоритм, которого в Volga нет, подключается в собственном [`tap_req`](/volga-docs/ru/middleware-infrastructure/middleware.html#замена-тела): `req.try_map_body(decode)` оборачивает тело в ваш декодер под тем же ограничением размера тела.

### Размер окна

Декодер выделяет окно, которое объявляет поток, ещё до того, как появится вывод, который могли бы посчитать ограничения, поэтому окно ограничивается отдельно. Начиная с **0.15.1**:

* потоки **Brotli** должны соответствовать RFC 7932, где окно не больше 16 MiB. На поток с расширением large-window, окно которого доходит до 1 GiB, Волга отвечает `400`: раньше тело в несколько байт могло заставить сервер выделить гигабайт;
* кадры **zstd** могут объявлять окно до 8 MiB — предел, который RFC 9659 задаёт для content coding `zstd`, тогда как сам zstd допускает 128 MiB. На кадр с окном больше Волга отвечает `400`. zstd укладывается в 8 MiB до уровня 19 включительно; уровни `--ultra` с 20 по 22 и `--long` на больших входных данных используют окна больше, поэтому клиенту не стоит сжимать ими тела запросов.

Полный пример можно посмотреть [здесь](https://github.com/RomanEmreis/volga/blob/main/examples/decompression/src/main.rs)