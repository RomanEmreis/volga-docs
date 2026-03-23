# Rate Limiting

Волга предоставляет высокопроизводительную систему ограничения скорости запросов для HTTP API и микросервисов.
Из коробки доступны четыре алгоритма, гибкие ключи партиционирования, подключаемые хранилища и возможность применения на уровне всего приложения, группы маршрутов или отдельного маршрута.

Это руководство демонстрирует основы на примере алгоритма **Token Bucket** — хороший выбор по умолчанию, который позволяет контролируемые всплески нагрузки, сохраняя при этом стабильную среднюю скорость.

## Включение Rate Limiting

Rate limiting — опциональная функция. Включите её в `Cargo.toml`:

```toml
[dependencies]
volga = { version = "...", features = ["rate-limiting"] }
```

Или включите все функции сразу:

```toml
[dependencies]
volga = { version = "...", features = ["full"] }
```

## Основные концепции

### Политика

**Политика** описывает поведение rate limiting:

* Алгоритм (например, token bucket, fixed window)
* Параметры ограничения (ёмкость, скорость пополнения, размер окна и т.д.)
* Опциональный период вытеснения для очистки состояния неактивных клиентов
* Опциональное имя — полезно, когда разным маршрутам нужны разные лимиты

Политики настраиваются один раз на уровне приложения.

### Ключ партиционирования (Partition Key)

**Ключ партиционирования** определяет, как запросы группируются для подсчёта.

Типичные примеры:

* IP-адрес клиента
* HTTP-заголовок (например, `x-api-key`)
* Идентификатор аутентифицированного пользователя
* Параметр запроса или пути

Волга предоставляет готовые вспомогательные функции в модуле `volga::rate_limiting::by`.

### Область применения

Middleware для rate limiting можно подключить на трёх уровнях:

* **Глобально** — ко всем входящим запросам
* **Группа маршрутов** — к набору маршрутов с общим префиксом
* **Отдельный маршрут** — к конкретному endpoint'у

## Определение политики Token Bucket

Token bucket начинается заполненным (до `capacity` токенов) и пополняется с постоянной скоростью. Каждый запрос потребляет один токен. Когда корзина пуста, запросы отклоняются до тех пор, пока токены не пополнятся.

```rust
use volga::rate_limiting::TokenBucket;

let bucket = TokenBucket::new(10, 5.0);
```

Это создаёт корзину с **ёмкостью 10 токенов** и **скоростью пополнения 5 токенов в секунду** — допуская короткие всплески до 10 запросов при средней скорости 5 запросов/сек.

### Именованные политики

Когда разным частям вашего API нужны разные лимиты, дайте каждой политике имя:

```rust
let standard = TokenBucket::new(10, 5.0)
    .with_name("standard");

let premium = TokenBucket::new(100, 50.0)
    .with_name("premium");
```

### Вытеснение (Eviction)

По умолчанию состояние неактивных клиентов очищается через 60 секунд. Это можно настроить:

```rust
use std::time::Duration;

let bucket = TokenBucket::new(10, 5.0)
    .with_eviction(Duration::from_secs(300));
```

## Регистрация политик

Зарегистрируйте политики в приложении перед их применением:

```rust
use volga::App;

let mut app = App::new()
    .with_token_bucket(standard)
    .with_token_bucket(premium);
```

На этом этапе политики существуют, но ещё **не активны** — их нужно применить к маршрутам.

## Применение Rate Limiting

### Глобально

Применение rate limiting ко всем входящим запросам:

```rust
use volga::rate_limiting::by;

app.use_token_bucket(by::ip());
```

Это ограничивает каждого клиента по его IP-адресу, используя политику token bucket по умолчанию (без имени).

### Использование именованной политики

```rust
app.use_token_bucket(by::ip().using("standard"));
```

### На уровне маршрута

```rust
app.map_get("/upload", upload_handler)
    .token_bucket(by::ip());
```

Или с именованной политикой:

```rust
app.map_get("/upload", upload_handler)
    .token_bucket(by::ip().using("premium"));
```

### На уровне группы маршрутов

```rust
app.group("/api", |api| {
    api.token_bucket(by::header("x-api-key").using("standard"));

    api.map_get("/status", status_handler);
    api.map_post("/upload", upload_handler);
});
```

## Вспомогательные функции для ключей партиционирования

Волга предоставляет встроенные экстракторы для типичных ключей партиционирования:

```rust
by::ip()                // IP-адрес клиента
by::header("x-api-key") // Значение HTTP-заголовка
by::query("tenant_id")  // Параметр строки запроса
by::path("user_id")     // Параметр пути
```

При включённой аутентификации:

```rust
by::user(|claims| claims.sub.as_str())
```

Также можно комбинировать несколько rate limiter'ов с разными ключами, наслаивая middleware.

## Другие алгоритмы

Помимо **Token Bucket**, Волга поддерживает ещё три алгоритма:

| Алгоритм | Подходит для | Паттерн методов |
|---|---|---|
| **Fixed Window** | Простой подсчёт запросов за временное окно | `.with_fixed_window()` / `.fixed_window()` |
| **Sliding Window** | Более плавное распределение без всплесков на границах окон | `.with_sliding_window()` / `.sliding_window()` |
| **GCRA** | Точное распределение с настраиваемой допустимой нагрузкой | `.with_gcra()` / `.gcra()` |

Каждый алгоритм следует одному и тому же паттерну регистрации и применения. Например, для Fixed Window:

```rust
use std::time::Duration;
use volga::rate_limiting::FixedWindow;

let mut app = App::new()
    .with_fixed_window(FixedWindow::new(100, Duration::from_secs(30)));

app.use_fixed_window(by::ip());
```

## Подключаемые хранилища (Pluggable Store)

По умолчанию все алгоритмы используют in-memory хранилище на основе конкурентной хэш-таблицы (`DashMap`). Это отлично работает для развёртываний на одном инстансе.

Для распределённых сценариев (например, несколько инстансов за балансировщиком нагрузки) можно реализовать собственное хранилище — например, на основе Redis — имплементировав соответствующий trait:

| Алгоритм | Store trait |
|---|---|
| Token Bucket | `TokenBucketStore` |
| Fixed Window | `FixedWindowStore` |
| Sliding Window | `SlidingWindowStore` |
| GCRA | `GcraStore` |

Store trait'ы определены в крейте `volga_rate_limiter`, и каждый требует реализации одной атомарной операции:

```rust
use volga_rate_limiter::TokenBucketStore;
use volga_rate_limiter::store::TokenBucketParams;

struct MyRedisStore { /* ... */ }

impl TokenBucketStore for MyRedisStore {
    fn try_consume(&self, params: TokenBucketParams) -> bool {
        let key = params.key;
        let capacity = params.capacity_scaled;
        // ... ваша логика Redis здесь
        true
    }
}
```

Затем создайте rate limiter с вашим хранилищем:

```rust
use volga_rate_limiter::TokenBucketRateLimiter;

let limiter = TokenBucketRateLimiter::with_store(10, 5.0, MyRedisStore::new());
```

:::tip
Бэкенды со встроенной поддержкой TTL (как Redis) могут пропустить ручной шаг вытеснения — параметры grace period предусмотрены для in-memory хранилищ, выполняющих ленивую очистку.
:::

## Полный пример

Полный рабочий пример со всеми четырьмя алгоритмами можно посмотреть [здесь](https://github.com/RomanEmreis/volga/blob/main/examples/rate_limiting/src/main.rs).
