# Статические файлы

Волга поддерживает работу со статическими файлами с возможностью просмотра каталогов, настраиваемым именем индексного файла, префиксами путей, корневой папкой контента и специальным файлом для обработки неизвестных маршрутов.

## Подготовка

### Зависимости

Если вы не используете полный набор возможностей (`full`), вам необходимо включить `static-files` в `Cargo.toml`:

```toml
[dependencies]
volga = { version = "...", features = ["static-files"] }
```

Возможность `static-files` теперь подразумевает `middleware`: именно middleware раздаёт файлы.

### Структура папок

Предположим, у нас есть следующая структура проекта:

```
project/
│── static/
│   ├── index.html
│   ├── style.css
│   ├── script.js
│── src/
│   ├── main.rs
│── Cargo.toml
```

## Базовый сервер статических файлов

После создания файлов HTML, CSS и JS можно настроить минимальный сервер в `main.rs`:

```rust compile
use volga::App;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new()
        .with_host_env(|env| env.with_content_root("/static"));

    // Включает раздачу статических файлов
    app.use_static_assets();

    app.run().await
}
```

[`with_content_root()`](https://docs.rs/volga/latest/volga/app/struct.HostEnv.html#method.with_content_root) задаёт папку, из которой раздаются файлы. Путь используется ровно так, как написан, поэтому **относительный** — `with_content_root("static")` — разрешается относительно рабочего каталога процесса, что и нужно проекту с раскладкой как выше. Значение по умолчанию — буквально `/static`.

::: tip
Ведущий слеш делает путь абсолютным на Unix, поэтому `"/static"` означает `/static` в корне файловой системы, а не `project/static`. Убирайте его, если имелось в виду не это. О корневой папке контента `/` сообщается при старте.
:::

Далее [`use_static_assets()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.use_static_assets) отвечает на запросы `GET` и `HEAD` из корневой папки контента:

- `/` → индексный файл (по умолчанию `index.html`)
- `/{любой путь}` → файл с таким именем внутри корневой папки, на любой глубине

::: tip
В **0.9.x** этот вызов пишется как `map_static_assets()`. Он не регистрирует маршрутов — см. [Middleware вместо маршрутизации](#middleware-вместо-маршрутизации) ниже, — поэтому потерял префикс `map_`, который в этом крейте означает, что был зарегистрирован маршрут. Всё остальное не отличается.
:::

## Middleware вместо маршрутизации

Сервер статических файлов — это middleware, а не набор маршрутов. Он читает целевой путь запроса, отвечает файлом из корневой папки контента, если он там есть, и отказывается в противном случае. Роутер о статике ничего не знает.

Что из этого следует:

* **Нет обхода дерева при старте и нет ограничения по глубине.** Корневая папка читается тогда, когда запрос о чём-то просит, а не при запуске сервера, поэтому каталог, созданный во время работы сервера, раздаётся как любой другой.
* **В роутере ничего не регистрируется.** Статика не перекрывает маршруты, не попадает в список маршрутов, печатаемый при старте, и её не нужно описывать в спецификации OpenAPI. Статические файлы и динамический маршрут уживаются: `app.map_get("/{id}", ..)` работает рядом с `use_static_assets()`.
* **Файл отвечает раньше маршрута.** Mount — первое, до чего доходит `GET` или `HEAD` под его префиксом, поэтому существующий на диске файл будет отдан даже там, где на тот же путь был замаплен маршрут. Любой другой метод и любой путь, за которым ничего нет, доходят до маршрутизации.
* **Положение в конвейере имеет значение** — см. ниже.

Запрос, на который ничего под корневой папкой не отвечает, идёт дальше в маршрутизацию, поэтому [`map_fallback_to_file()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_fallback_to_file) по-прежнему его обрабатывает, и SPA-оболочка работает как обычно.

### Где размещать вызов

Так как mount — это middleware, он стоит в конвейере там, где вы его зарегистрировали:

```rust compile
use volga::App;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new()
        .with_cors(|cors| cors.with_any_origin().with_any_header().with_any_method());

    app.use_compression(); // файлы будут сжаты
    app.use_cors();        // на файлах будут заголовки CORS

    app.use_static_assets();

    // Всё, что зарегистрировано ниже, выполняется только для запросов,
    // на которые не ответили с диска
    app.with(|next| async move { next.await });

    app.run().await
}
```

Регистрируйте mount **после** [`use_compression()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.use_compression), чтобы файлы сжимались, **после** [`use_cors()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.use_cors), чтобы на них были заголовки, и **до** всего, что не должно выполняться для запроса, отвеченного с диска.

### Разбор пути

Целевой путь запроса разбирается только по обычным компонентам пути. Сегмент `.`, `..`, закодированный разделитель (`%2F`) или встроенный NUL отклоняются, а не отбрасываются и не ищутся на диске, поэтому выход за пределы каталога невозможен по построению. Символическая ссылка внутри корневой папки, указывающая наружу — единственный случай, который целевым путём не описывается, — по-прежнему отлавливается и отвечает `403`.

Escape-последовательность `%XX` декодируется; некорректная или не декодируемая в UTF-8 отвечает `400`. Символ `+` в целевом пути — это буквальный символ, а не пробел: целевой путь запроса не является телом формы.

## Файл по умолчанию

Чтобы раздавать специальный файл (например, `404.html`) на `GET` или `HEAD`, на который не ответили ни файл на диске, ни маршрут, используйте [`map_fallback_to_file()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_fallback_to_file):

```rust compile
use volga::App;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new()
        .with_host_env(|env| env
            .with_content_root("/static")
            .with_fallback_file("404.html"));

    // Включает раздачу статических файлов
    app.use_static_assets();

    // Включает перенаправление на 404.html
    app.map_fallback_to_file();

    app.run().await
}
```

Поскольку такие специальные резервные файлы отключены по умолчанию, мы явно задаем файл `404.html` с помощью метода [`with_fallback_file("404.html")`](https://docs.rs/volga/latest/volga/app/struct.HostEnv.html#method.with_fallback_file).

Для упрощения можно использовать [`use_static_files()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.use_static_files), который объединяет [`use_static_assets()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.use_static_assets) и [`map_fallback_to_file()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_fallback_to_file), Однако, последний метод будет задействован, только если указан специальный резервный файл:

```rust compile
use volga::App;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new()
        .with_host_env(|env| env
            .with_content_root("/static")
            .with_fallback_file("404.html"));

    // Включает раздачу статических файлов
    // и перенаправление на 404.html
    app.use_static_files();

    app.run().await
}
```

::: tip
Укажите в [`with_fallback_file()`](https://docs.rs/volga/latest/volga/app/struct.HostEnv.html#method.with_fallback_file) файл `index.html`, чтобы каждый клиентский URL отрисовывался из одной оболочки — обычная схема для одностраничного приложения.
:::

### Как раздаётся этот файл

Резервный файл раздаётся `GET`-маршрутом, покрывающим префикс mount'а и `{*path}` под ним: начиная с **0.11.1** это обычный маршрут в роутере, и из этого следуют три вещи, которые полезно знать:

* **Он отвечает только на `GET` и `HEAD`.** Оболочка — это то, как клиентский URL отрисовывает приложение, а браузер переходит по ссылкам методом `GET`. Всё остальное — `POST` на опечатанный путь API, `OPTIONS`, `PUT` на путь файла — получает `405` с `Allow: GET,HEAD`, ровно как любой маршрут отвечает на метод, которого у него нет. Именно это не даёт ошибочной записи получить HTML-страницу с кодом `200` и упасть в клиенте на `res.json()` вместо того места, где она была сделана.
* **Ваш маршрут отвечает раньше оболочки.** Литеральный сегмент и параметр читаются раньше catch-all в любой позиции, поэтому `map_get("/health", ..)` продолжает отвечать и при mount'е в корне, в любом порядке регистрации. `GET`-маршрут, вручную замапленный на одну из позиций самой оболочки — `map_get("/{*rest}", ..)` рядом с корневым mount'ом, — просто занимает эту позицию.
* **Это не слот fallback'а приложения.** [`map_fallback()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_fallback) и `map_fallback_to_file()` больше не вытесняют друг друга: оболочка отвечает под префиксом mount'а, а `map_fallback` — на всё, что лежит за его пределами.

Как и сами файлы, маршрут оболочки не попадает ни в список маршрутов, печатаемый при старте, ни в документ OpenAPI.

::: tip API на том же сервере
При **корневом** mount'е оболочка покрывает все `GET`-пути, поэтому `map_fallback` отвечать уже не на что — оболочка оказывается первой, а другие методы получают `405`. Чтобы промахи API отвечали в формате самого API, дайте его группе [собственный fallback](/volga-docs/ru/getting-started/route-groups.html#fallback-группы): роутер предпочтёт его как более глубокий.

```rust compile
use volga::{App, http::Uri, not_found, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new()
        .with_host_env(|env| env
            .with_content_root("static")
            .with_fallback_file("index.html"));

    app.group("/api", |api| {
        api.map_get("/users", || async { ok!("users") });

        // GET /api/uesrs -> 404 в JSON, а не оболочка SPA
        api.map_fallback(|uri: Uri| async move {
            not_found!("no endpoint at {}", uri.path())
        });
    });

    // Любой другой неизвестный путь отрисовывает приложение
    app.use_static_files();

    app.run().await
}
```
:::

## Раздача под префиксом

[Группа маршрутов](/volga-docs/ru/getting-started/route-groups.html) ограничивает mount одной частью адресного пространства:

```rust compile
use volga::App;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // Файлы раздаются только под /static/*
    app.group("/static", |g| {
        g.use_static_assets();
    });

    // Работает как обычно: mount отклоняет всё за пределами своего префикса
    app.map_get("/{id}", |id: i32| async move { id });

    app.run().await
}
```

Middleware группы — `wrap`, `with`, `filter`, `map_ok`, `authorize`, ограничитель частоты — оборачивает файлы, которые раздаёт этот mount, ровно так же, как оборачивает зарегистрированные группой маршруты, включая вложенные группы.

[`RouteGroup::use_static_files()`](https://docs.rs/volga/latest/volga/app/router/struct.RouteGroup.html#method.use_static_files) монтирует под этим префиксом и файлы, **и** резервный файл: начиная с **0.11.1** оболочка отвечает именно там и больше нигде — один сервер может держать фронтенд под `/app` и оставить остальное адресное пространство себе:

```rust compile
use volga::{App, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new()
        .with_host_env(|env| env
            .with_content_root("static")
            .with_fallback_file("index.html"));

    // GET /app/assets/app.js -> файл
    // GET /app/settings      -> index.html
    app.group("/app", |g| {
        g.use_static_files();
    });

    // GET /health -> маршрут; GET /elsewhere -> 404, а не оболочка
    app.map_get("/health", || async { ok!("healthy") });

    app.run().await
}
```

Middleware группы выполняется вокруг оболочки так же, как вокруг файлов.

:::warning Два ограничения mount'а в группе
* **Префикс должен быть литеральным.** `app.group("/{tenant}", |g| g.use_static_files())` не раздаёт статические файлы и сообщает об этом при старте: mount сопоставляется с целевым путём запроса как он написан, а параметр сопоставляет роутер, который о mount'е ничего не знает.
* **Политика CORS группы до файлов не доходит**, включая резервный файл. Политика выбирается по сработавшему маршруту, а файл раздаётся без маршрута, поэтому применяется политика приложения — заданная через [`with_cors()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.with_cors). По той же причине preflight, нацеленный на путь файла, обрабатывается как запрос к несуществующему пути.
:::

## Просмотр каталогов

По умолчанию просмотр каталогов отключен. Его можно включить с помощью [`with_files_listing()`](https://docs.rs/volga/latest/volga/app/struct.HostEnv.html#method.with_files_listing), однако это не рекомендуется для продакшн-сред — приложение, оставившее его включённым в release-сборке, сообщает об этом при старте.

```rust compile
use volga::App;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new()
        .with_host_env(|env| env
            .with_content_root("/static")
            .with_fallback_file("404.html")
            .with_files_listing());

    // Включает раздачу статических файлов
    // и перенаправление на 404.html
    app.use_static_files();

    app.run().await
}
```

## Кеширование

Каждый статический файл раздаётся с `ETag`, `Last-Modified` и `Cache-Control`, а условный запрос, который всё ещё совпадает, получает `304`.

Какую политику получит файл, решает **роль**, которую ему даёт имя, по которому к нему обращаются, а не сам файл:

| Роль | Что это | `Cache-Control` |
|---|---|---|
| **asset** | любой файл с именем, содержащим хеш содержимого — `assets/index-a1b2c3.js` | `max-age=86400, public, immutable` |
| **shell** | индексный и резервный файлы, с постоянным именем | `no-cache` |

Asset никогда не меняется под тем же URL, поэтому ему верят на слово и не перепроверяют. Shell под тем же URL меняется, поэтому он перепроверяется при каждой навигации — что стоит `304` без тела, пока он не изменился, и позволяет подхватить деплой со следующего запроса, а не спустя сутки.

Условные запросы обрабатываются по RFC 9110: при наличии обоих заголовков `If-None-Match` важнее `If-Modified-Since`, `Last-Modified` сравнивается с точностью до секунды, поэтому возвращённое клиентом значение по-прежнему совпадает, валидаторы читаются только для `GET` и `HEAD`, а в ответе `304` тот же `Cache-Control`, что и в полном ответе.

### Настройка политик

Обе роли настраиваются на [`HostEnv`](https://docs.rs/volga/latest/volga/app/struct.HostEnv.html). Билдеры получают текущую политику, поэтому чтобы сузить одну директиву, не нужно перечислять остальные:

```rust compile
use volga::App;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new()
        .with_host_env(|env| env
            .with_content_root("/static")
            // Ассеты считаются свежими час, а не сутки
            .with_asset_cache_control(|cc| cc.with_max_age(60 * 60))
            // Shell не сохраняется вообще
            .with_shell_cache_control(|cc| cc.with_no_store()));

    app.use_static_files();

    app.run().await
}
```

[`with_asset_cache_control()`](https://docs.rs/volga/latest/volga/app/struct.HostEnv.html#method.with_asset_cache_control) и [`with_shell_cache_control()`](https://docs.rs/volga/latest/volga/app/struct.HostEnv.html#method.with_shell_cache_control) требуют **0.9.11** или новее и читаются обратно через `asset_cache_control()` / `shell_cache_control()`. Обе политики по умолчанию названы константами [`CacheControl::ASSET`](https://docs.rs/volga/latest/volga/headers/cache_control/struct.CacheControl.html#associatedconstant.ASSET) и `CacheControl::SHELL` — на случай, если политику собирают с нуля; `CacheControl::EMPTY` — это `const`-эквивалент `CacheControl::default()`.

Чтобы всё же раздавать shell по политике ассетов — для деплоя, который никогда не переиспользует URL оболочки:

```rust compile
use volga::App;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new()
        .with_host_env(|env| env
            .with_shell_cache_control(|cc| cc
                .with_max_age(86400)
                .with_public()
                .with_immutable()));

    app.use_static_files();

    app.run().await
}
```

### Откуда берётся `ETag`

Тег выводится либо из того, что о файле говорит файловая система, либо из его байтов, и выбирает между ними роль — тег, который никто не читает, не должен стоить чтения файла:

| Роль | По умолчанию | Почему |
|---|---|---|
| **asset** | [`ETagSource::Metadata`](https://docs.rs/volga/latest/volga/headers/etag/enum.ETagSource.html) | раздаётся с `immutable`, поэтому клиент его никогда не перепроверяет и до тега дело не доходит |
| **shell** | [`ETagSource::Content`](https://docs.rs/volga/latest/volga/headers/etag/enum.ETagSource.html) | раздаётся с `no-cache`, поэтому именно тег решает между `304` и полным телом при каждой навигации |

`Metadata` хеширует длину файла в байтах и целую секунду его `mtime` — то же, чем тегируют nginx, Apache и ASP.NET Core, и это бесплатно: `stat` сервер уже сделал. `Content` хеширует сами байты: одинаково везде, куда выложена одна сборка, и по-разному, как только отличается хотя бы один байт.

Именно из-за этой разницы shell по умолчанию тегируется по содержимому. Две версии одного файла получают одинаковый тег `Metadata` всякий раз, когда у них одна длина и `mtime` в пределах одной секунды, — а для `index.html` сборки с хешами в именах это обычный случай: его `<script src="/assets/index-a1b2c3.js">` сохраняет длину от деплоя к деплою, а деплой с фиксированными временными метками (`SOURCE_DATE_EPOCH`, `tar -p`, `rsync -t`) сохраняет и секунду. Клиент со старым тегом получил бы `304` на изменившееся содержимое.

Оба источника настраиваются, на том же `HostEnv`:

```rust compile
use volga::{App, headers::ETagSource};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new()
        .with_host_env(|env| env
            // Ассеты, которые перепроверяются, а не принимаются на веру,
            // поэтому их теги должны быть надёжными
            .with_asset_cache_control(|cc| cc.with_max_age(60))
            .with_asset_etag(ETagSource::Content)
            // Обратно к более дешёвому тегу — для деплоя, который
            // никогда не перезаписывает shell на месте
            .with_shell_etag(ETagSource::Metadata));

    app.use_static_files();

    app.run().await
}
```

[`with_asset_etag()`](https://docs.rs/volga/latest/volga/app/struct.HostEnv.html#method.with_asset_etag) и [`with_shell_etag()`](https://docs.rs/volga/latest/volga/app/struct.HostEnv.html#method.with_shell_etag) требуют **0.10.1** или новее и читаются обратно через `asset_etag()` / `shell_etag()`. Держать в голове стоит их связку с `Cache-Control`: стоит сузить [`CacheControl::ASSET`](https://docs.rs/volga/latest/volga/headers/cache_control/struct.CacheControl.html#associatedconstant.ASSET), и ассеты начнут перепроверяться — а надёжными их ответы делает как раз `ETagSource::Content`.

Тег по содержимому стоит **одного чтения на версию файла**, а не на запрос: он запоминается по длине файла и его `mtime` в полной точности плюс всему, что платформа может сказать о самом файле, а не о его содержимом — inode и времени изменения на Unix, времени создания на Windows. После перезапуска кеш пуст, а сам он ограничен по размеру, так что корень контента с файлом на пользователя не обрастает записью на каждый файл навсегда.

::: tip
`ETag` — **слабый**, из чего бы он ни выводился. RFC 9110 §8.8.1 оставляет строгую валидацию для побайтового равенства того представления, которое действительно отправляется, а middleware сжатия может перекодировать тело уже после того, как сервер статических файлов проставил заголовок.
:::

Если политику нужно проставить в ответе обработчика, а не настроить на сервере, [`CacheControl::asset()`](https://docs.rs/volga/latest/volga/headers/cache_control/struct.CacheControl.html#method.asset) и `CacheControl::shell()` — те же две политики в виде готовых пресетов `Header<CacheControl>`, рядом с `no_cache()`, `public()` и остальными.

## Хост-среда

Для более сложных сценариев можно использовать [`HostEnv`](https://docs.rs/volga/latest/volga/app/struct.HostEnv.html), который представляет хост-среду приложения.
Использование его напрямую упрощает управление и переключение между средами.

Вот как можно добиться той же конфигурации с помощью `HostEnv`:

```rust compile
use volga::{App, File, app::HostEnv};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let env = HostEnv::new("/static")
        .with_fallback_file("404.html")
        .with_files_listing();

    let mut app = App::new()
        .set_host_env(env);

    // Включает раздачу статических файлов
    // и перенаправление на 404.html
    app.use_static_files();

    // Загружает новые статические файлы
    app.map_post("/upload", |file: File, env: HostEnv| async move {
        let root = env.content_root();
        file.save(root).await
    });

    app.run().await
}
```

Кроме того, [`HostEnv`](https://docs.rs/volga/latest/volga/app/struct.HostEnv.html) можно извлекать в middleware и обработчики запросов.

Полный пример можно найти в [этом репозитории](https://github.com/RomanEmreis/volga/blob/main/examples/static_files/src/main.rs).
