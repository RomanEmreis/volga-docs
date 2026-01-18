# Cookies

Волга обеспечивает полную поддержку cookie посредством интеграции с библиотекой [`cookie`](https://crates.io/crates/cookie). В этом руководстве объясняется, как включить и использовать функциональность cookie в вашем приложении, включая базовое использование, настройку и безопасные (подписанные и закрытые) файлы cookie.


## Enabling Cookie Support

Чтобы использовать cookie в вашем приложении, вам необходимо включить соответствующие флаги функций в вашем `Cargo.toml`. Если вы не используете `full` набор функций, добавьте флаг `cookie` вручную:

```toml
[dependencies]
volga = { version = "...", features = ["cookie"] }

# Необязательно: явно добавить библиотеку cookie
cookie = "0.18.1"
```

Информацию о подписанных или закрытых cookie см. в разделе [Signed & Private Cookies](#signed--private-cookies).


## Пример использования

```rust
use volga::{
    App, HttpResult,
    http::Cookies,
    headers::{Header, Authorization},
    error::Error,
    status, ok, see_other
};

async fn login(cookies: Cookies, auth: Header<Authorization>) -> Result<(HttpResult, Cookies), Error> {
    let session_id = authorize(auth)?;
    Ok((see_other!("/me"), cookies.add(("session-id", session_id))))
}

async fn me(cookies: Cookies) -> HttpResult {
    if cookies.get("session-id").is_some() {
        ok!("Success")
    } else {
        status!(401, "Unauthorized")
    }
}

fn authorize(auth: Header<Authorization>) -> Result<String, Error> {
    // Фиктивная реализация. Замените своей логикой.
    Ok("generated-session-id".to_string())
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_post("/login", login);
    app.map_get("/me", me);

    app.run().await
}
```

### Примечания:

* Экстрактор [`Cookies`](https://docs.rs/volga/latest/volga/http/cookie/struct.Cookies.html) обрабатывает чтение из заголовков [`Cookie`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cookie) и автоматически устанавливает заголовки [`Set-Cookie`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie) для ответов.
* Вы можете связать несколько добавлений cookie с помощью метода [`.add(...)`](https://docs.rs/volga/latest/volga/http/cookie/struct.Cookies.html#method.add).


## Создание защищенных Cookies

Для защищенных или настраиваемых cookie (например, `HttpOnly`, `Secure`, кастомный домен/путь) используйте [`CookieBuilder`](https://docs.rs/cookie/latest/cookie/struct.CookieBuilder.html):

```rust
use cookie::{Cookie, time::Duration};

let cookie = Cookie::build(("session-id", session_id))
    .domain("www.example.org")
    .path("/")
    .secure(true)
    .http_only(true)
    .max_age(Duration::days(1))
    .build();

cookies.add(cookie);
```
::: tip
[`Cookie::build(...)`](https://docs.rs/cookie/latest/cookie/struct.Cookie.html#method.build) принимает либо кортеж имя/значение, либо просто имя, в зависимости от ваших потребностей.
:::

## Чтение Cookies

Вот как можно получить cookie по имени:

```rust
if let Some(cookie) = cookies.get("session-id") {
    println!("Session ID: {}", cookie.value());
}
```


## Signed & Private Cookies

Для защиты целостности или конфиденциальности cookie Волга поддерживает два безопасных режима:

| Type           | Use Case                            | Crate Feature    | API              |
| -------------- | ----------------------------------- | ---------------- | ---------------- |
| **Signed**     | Обнаружение несанкционированного доступа (читаемо)         | `signed-cookie`  | [`SignedCookies`](https://docs.rs/volga/latest/volga/http/cookie/signed/struct.SignedCookies.html)  |
| **Private**    | Защищен от несанкционированного доступа и зашифрован (скрыт) | `private-cookie` | [`PrivateCookies`](https://docs.rs/volga/latest/volga/http/cookie/private/struct.PrivateCookies.html) |

Обновите `Cargo.toml`, подключив желаемый флаг, а так же Внедрение зависимостей (`di`):

```toml
# Для signed cookies
volga = { version = "...", features = ["signed-cookie", "di"] }

# Для private cookies
volga = { version = "...", features = ["private-cookie", "di"] }

# Для всех cookies
volga = { version = "...", features = ["cookie-full", "di"] }
```

### Регистрация секретных ключей

Подписанные и закрыте файлы cookie требуют секретных ключей, предоставляемых через DI:

```rust
use volga::http::SignedKey;

app.add_singleton(SignedKey::generate());
```

Alternatively, for private cookies:

```rust
use volga::http::PrivateKey;

app.add_singleton(PrivateKey::generate());
```

После регистрации вы можете извлечь [`SignedCookies`](https://docs.rs/volga/latest/volga/http/cookie/signed/struct.SignedCookies.html) или [`PrivateCookies`](https://docs.rs/volga/latest/volga/http/cookie/private/struct.PrivateCookies.html) точно так же, как [`Cookies`](https://docs.rs/volga/latest/volga/http/cookie/struct.Cookies.html).

## Best Practices

* **Используйте флаги `HttpOnly` и `Secure`** для сессионных или аутентификационных cookie, чтобы предотвратить XSS и перехват.
* **Установите политику `SameSite`** (через `cookie::CookieBuilder`) для межсайтовой защиты.
* **Периодически меняйте ключи подписи/шифрования**, если используете `SignedCookies` или `PrivateCookies`.
* **Избегайте хранения конфиденциальных данных** непосредственно в cookie, если они не зашифрованы с помощью закрытых cookie.

## Примеры

* [Basic Cookies](https://github.com/RomanEmreis/volga/blob/main/examples/cookies/src/main.rs)
* [Signed Cookies](https://github.com/RomanEmreis/volga/blob/main/examples/signed_cookies/src/main.rs)
* [Private Cookies](https://github.com/RomanEmreis/volga/blob/main/examples/private_cookies/src/main.rs)

