# Server-Sent Events (SSE)

Волга включает встроенную поддержку [Server-Sent Events (SSE)](https://developer.mozilla.org/ru/docs/Web/API/Server-sent_events), что позволяет вам реализовать одностороннюю связь в реальном времени от сервера к клиенту в ваших веб-приложениях. Эта функция доступна по умолчанию и совместима с протоколами HTTP/1 и HTTP/2.

# Базовая реализация

В примере ниже показано, как создать простую конечную точку SSE. Она сопоставляет запрос `GET` с маршрутом `/events`, устанавливает Content Type как `text/event-stream` и непрерывно отправляет сообщение `"Hello, world!"` раз в секунду, пока клиент не отключится:

```rust
use volga::{App, error::Error, http::sse::Message, sse};
use futures_util::stream::repeat_with;
use std::time::Duration;
use tokio_stream::StreamExt;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_get("/events", || async {
        // Создаем поток сообщений с отправкой раз в секунду
        let stream = repeat_with(|| Message::new().data("Hello, world!"))
            .map(Ok::<_, Error>)
            .throttle(Duration::from_secs(1));

        sse!(stream)
    });

    app.run().await
}
```

## Настройка сообщений

Волга предоставляет структуру [`Message`](https://docs.rs/volga/latest/volga/http/endpoints/args/sse/struct.Message.html), которая поможет вам создавать и настраивать сообщения SSE.

Для простых текстовых сообщений используйте метод [`data()`](https://docs.rs/volga/latest/volga/http/endpoints/args/sse/struct.Message.html#method.data), как показано выше. Если вам необходимо отправить структурированные данные, такие как JSON, используйте метод [`json()`](https://docs.rs/volga/latest/volga/http/endpoints/args/sse/struct.Message.html#method.json), который принимает любой тип, реализующий типаж [`serde::Serialize`](https://docs.rs/serde/1.0.219/serde/ser/trait.Serialize.html):

```rust
use volga::http::sse::Message;
use serde::Serialize;

#[derive(Serialize)]
struct SseData {
    data: String,
}

let payload = SseData { data: "Hello, world!".into() };
Message::new().json(payload);
```

В дополнение к этому, `Message` также поддерживает настройку имени события (поле `event`), идентификатора (поле `id`), комментариев (поле `comment`) и интервала попыток повторного подключения клиента (поле `retry`). Подробную информацию о формате сообщения SSE см. в [руководстве MDN](https://developer.mozilla.org/ru/docs/Web/API/Server-sent_events/Using_server-sent_events#%D1%84%D0%BE%D1%80%D0%BC%D0%B0%D1%82_%D0%BF%D0%BE%D1%82%D0%BE%D0%BA%D0%B0_%D1%81%D0%BE%D0%B1%D1%8B%D1%82%D0%B8%D0%B9).

Полный пример использования можно так же найти по по [ссылке](https://github.com/RomanEmreis/volga/blob/main/examples/sse.rs).