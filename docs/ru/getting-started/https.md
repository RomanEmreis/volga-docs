# HTTPS

Волга поддерживает протоколы HTTPS/TLS, реализованные поверх библиотеки `rustls`.

Если вы не используете набор функций `full`, убедитесь, что вы включили функцию `tls` в `Cargo.toml`:

```toml
[dependencies]
volga = { version = "0.4.5", features = ["tls"] }
```

## Простой HTTPS сервер

### Генерация Self-Signed сертификатов
Прежде всего, вам необходимо сгенерировать сертификат и закрытый ключ. Для тестирования вы можете использовать следующую команду:
```bash
openssl req -x509 -newkey rsa:4096 -nodes -keyout key.pem -out cert.pem -days 365 -subj '/CN=localhost'`
```

### Код для использования сертификата и закрытого ключа
Если вы сгенерировали сертификат и закрытый ключ в папке, где находится ваш `Cargo.toml`, вы можете просто сделать следующее:
```rust
use volga::{App, tls::TlsConfig};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new()
        .with_tls(TlsConfig::new());

    app.map_get("/hello", || async {
        "Hello, World!"
    });

    app.run().await
}
```
По умолчанию [`TlsConfig`](https://docs.rs/volga/latest/volga/tls/struct.TlsConfig.html) считывает эти файлы из этой папки и ожидает имена: `cert.pem` и `key.pem`.
Если вы создали эти файлы в другой папке, вы можете настроить TLS следующим образом:
```rust
let config = TlsConfig::from_pem("path/to/certs");
```
В случае, если у вас другие имена файлов, вы можете указать их отдельно:
```rust
let config = TlsConfig::new()
    .with_cert_path("path/to/certs/server.pem")
    .with_key_path("path/to/certs/server.key");
```
Вы можете протестировать приведенный выше код, используя команду `curl`:
```bash
> curl -v "https://localhost:7878/hello"
```

## Проверка подлинности клиента

Аутентификация клиента отключена по-умолчанию. Вы можете включить ее как необязательную или обязательную. Основное отличие в том, что в первом случае сервер все равно разрешает анонимные запросы.

### Генерация CA сертификата и закрытого ключе
Сначала давайте выполним следующие команды для генерации сертификата CA (Client Authority) и закрытого ключа:
```bash
openssl genrsa -out ca.key 2048
openssl req -x509 -new -nodes -key ca.key -sha256 -days 3650 -out ca.pem -subj "/C=US/ST=State/L=City/O=Organization/OU=OrgUnit/CN=CA"
```

### Необязательная Аутентификация
Таким образом, можно настроить необязательную (опциональную) аутентификацию:
```rust
let config = TlsConfig::new()
    .with_cert_path("path/to/certs/server.pem")
    .with_key_path("path/to/certs/server.key")
    .with_optional_client_auth("path/to/certs/ca.pem");
```

### Обязательная Аутентификация
Вот так, можно настроить обязательную аутентификацию:
```rust
let config = TlsConfig::new()
    .with_cert_path("tests/tls/server.pem")
    .with_key_path("tests/tls/server.key")
    .with_required_client_auth("path/to/certs/ca.pem");
```
Затем вам, так же, необходимо сгенерировать клиентский сертификат и закрытый ключ:
```bash
openssl req -x509 -newkey rsa:4096 -nodes -keyout client.key -out client.pem -days 365 -subj '/CN=localhost'`
```
И, наконец, можно протестировать при помощи `curl`:
```bash
> curl --cert client.pem --key client.key --cacert ca.pem https://localhost:7878/hello
```

## Перенаправление HTTPS

Волга также позволяет вам настроить перенаправление с HTTP-запроса на HTTPS.
Вы можете настроить его, используя метод [`with_https_redirection()`](https://docs.rs/volga/latest/volga/tls/struct.TlsConfig.html#method.with_https_redirection):
```rust
let config = TlsConfig::new()
    .with_cert_path("path/to/certs/server.pem")
    .with_key_path("path/to/certs/server.key")
    .with_https_redirection();
```
HTTP-порт по умолчанию — `7879`, но вы можете изменить его на любой другой:
```rust
let config = TlsConfig::new()
    .with_cert_path("path/to/certs/server.pem")
    .with_key_path("path/to/certs/server.key")
    .with_https_redirection()
    .with_http_port(7979);
```
Теперь, если вы запустите следующую команду `curl`, ваш запрос будет перенаправлен на `https://localhost:7878/hello`:
```bash
> curl -v "http://localhost:7979/hello"
```
Внутри, когда вы запускаете этот код в режиме отладки, он использует [Temporary Redirect](https://developer.mozilla.org/ru/docs/Web/HTTP/Status/307) (307), поскольку кэширование ссылок может привести к нестабильному поведению в среде для разработки. Однако в режиме релиза он отвечает 308 - [Permanent Redirect](https://developer.mozilla.org/ru/docs/Web/HTTP/Status/308).

## HTTP Strict Transport Security Protocol (HSTS)

HTTP Strict Transport Security (HSTS) — это дополнительное улучшение безопасности, которое указывается веб-сервером с помощью специального заголовка ответа. Когда браузер, поддерживающий HSTS, получает этот заголовок:
* Браузер сохраняет конфигурацию для домена, которая запрещает отправку любых сообщений по HTTP. 
* Браузер принудительно переводит все сообщения по HTTPS.
* Браузер не позволяет пользователю использовать ненадежные или недействительные сертификаты. 
* Браузер отключает запросы, которые позволяют пользователю временно доверять такому сертификату.

Поскольку HSTS принудительно применяется клиентом, у него есть некоторые ограничения:
* Клиент должен поддерживать HSTS.
* HSTS требует как минимум одного успешного запроса HTTPS для установки политики HSTS.
* Приложение должно проверять каждый запрос HTTP и перенаправлять или отклонять запрос HTTP.

Вы можете включить HSTS, используя метод [`use_hsts()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.use_hsts):
```rust
use volga::{App, tls::TlsConfig};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new()
        .with_tls(TlsConfig::new()
            .with_https_redirection());

    // Включает HSTS middleware
    app.use_hsts();

    app.map_get("/hello", || async {
        "Hello, World!"
    });

    app.run().await
}
```
Затем, если вы запустите этот код, вы получите HTTP-заголовок `Strict-Transport-Security` вместе с успешным ответом.

Больше примеров вы можете найти [здесь](https://github.com/RomanEmreis/volga/blob/main/examples/tls.rs).
