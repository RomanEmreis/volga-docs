# Валидация запросов

Волга разбирает полезную нагрузку, но не проверяет её содержимое. Всё, что выходит за рамки `serde` — непустой ключ,
ограниченный размер страницы, диапазон, который должен иметь смысл — раньше приходилось переписывать в начале каждого
обработчика.

Начиная с **v0.9.9** эти правила живут в одном месте: типаж [`Validate`](https://docs.rs/volga/latest/volga/validation/trait.Validate.html)
описывает, что тип считает валидным, а экстрактор [`Valid<E>`](https://docs.rs/volga/latest/volga/validation/valid/struct.Valid.html)
его запускает. `Valid<E>` оборачивает другой экстрактор, вызывает `validate()` на том, что тот извлёк, и либо передаёт
данные обработчику, либо превращает ошибку в ответ **ещё до входа в обработчик**.

Волга не знает ни одного из правил — она знает только, что вызвала функцию.

## Быстрый старт

Типаж `Validate` и экстрактор `Valid<E>` доступны всегда. Макрос вывода включается фичей `validation-derive`,
которая входит в `full`:
```toml
[dependencies]
volga = { version = "0.9.9", features = ["validation-derive"] }
```

```rust compile
use volga::{App, ValidJson, ok};
use volga::validation::Validate;
use serde::Deserialize;

#[derive(Deserialize, Validate)]
struct KeyValue {
    #[validate(length(min = 1, message = "key is required"))]
    key: String,

    #[validate(length(max = 4096))]
    value: String,
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    app.map_post("/put", async |val: ValidJson<KeyValue>| {
        ok!("{}={}", val.key, val.value)
    });

    app.run().await
}
```
Невалидные данные до обработчика не доходят:
```bash
> curl -X POST "http://127.0.0.1:7878/put" -H "Content-Type: application/json" -d "{\"key\":\"\",\"value\":\"1\"}"
key: key is required
```
По умолчанию отдаётся `400 Bad Request` — см. [Выбор статуса](#выбор-статуса), если нужен `422`.

## Экстрактор `Valid<E>`

[`Valid<E>`](https://docs.rs/volga/latest/volga/validation/valid/struct.Valid.html) оборачивает экстрактор, а не тип
данных. Поскольку `Json`, `Query`, `Form` и `NamedPath` разыменовываются в свою полезную нагрузку, одна обобщённая
реализация покрывает их все, и у каждого есть короткий псевдоним:

| Псевдоним | Разворачивается в | Что проверяет |
|---|---|---|
| [`ValidJson<T>`](https://docs.rs/volga/latest/volga/validation/valid/type.ValidJson.html) | `Valid<Json<T>>` | тело запроса в формате JSON |
| [`ValidQuery<T>`](https://docs.rs/volga/latest/volga/validation/valid/type.ValidQuery.html) | `Valid<Query<T>>` | параметры строки запроса |
| [`ValidForm<T>`](https://docs.rs/volga/latest/volga/validation/valid/type.ValidForm.html) | `Valid<Form<T>>` | URL-encoded форму |
| [`ValidPath<T>`](https://docs.rs/volga/latest/volga/validation/valid/type.ValidPath.html) | `Valid<NamedPath<T>>` | именованные параметры маршрута |

Все четыре реэкспортированы из корня крейта, поэтому `use volga::ValidJson;` и `use volga::validation::ValidJson;` —
это один и тот же импорт.

::: tip
`ValidPath<T>` — это **именованный** экстрактор пути, а не позиционный: `Path<T>` читает кортеж, а для кортежа ваш крейт
не может реализовать `Validate`. Используйте структуру с `Deserialize`, как описано в разделе
[Параметры маршрута](/volga-docs/ru/getting-started/route-params.html).
:::

Обёртка передаёт дальше источник данных внутреннего экстрактора, поэтому проверяемое тело по-прежнему читается из тела
запроса, а проверяемый query — из его частей. Оба могут проверяться в одном обработчике и прерываются на **первой ошибке
в порядке аргументов**:
```rust
app.map_post("/items", async |filter: ValidQuery<Filter>, val: ValidJson<KeyValue>| {
    ok!("{}:{}", filter.per_page, val.key)
});
```

`Valid<E>` разыменовывается во внутренний экстрактор, а `into_inner()` его разворачивает.

## Правила, которые понимает макрос

[`#[derive(Validate)]`](https://docs.rs/volga/latest/volga/validation/derive.Validate.html) генерирует ровно тот же
`validate()`, что написали бы вручную, исходя из ограничений, объявленных на полях. Это не второй способ валидации:
точкой расширения остаётся типаж, поэтому выведенная и написанная вручную реализации для `Valid<E>` неразличимы.

| Правило | К чему применяется | Пример |
|---|---|---|
| `length(min, max, equal)` | строки и коллекции | `#[validate(length(min = 1, max = 64))]` |
| `range(min, max)` | всё, что упорядочено | `#[validate(range(min = 1, max = 100))]` |
| `nested` | поле, которое проверяет себя само | `#[validate(nested)]` |
| `custom = "path::to::fn"` | что угодно | `#[validate(custom = "is_supported_sort")]` |
| `rename = ".."` | имя, под которым сообщается об ошибке | `#[validate(rename = "explicit")]` |

`length` и `range` дополнительно принимают необязательный `message = ".."`, который заменяет текст по умолчанию.
Строки измеряются в символах (Unicode scalar values) — именно так считают `minLength` / `maxLength` в OpenAPI;
коллекции измеряются в элементах.

Все ошибки собираются, а не прерываются на первой, и каждое ограничение и сообщение отрисовывается на этапе раскрытия
макроса, поэтому неудачная проверка кладёт `&'static str` и ничего не аллоцирует.

### Пользовательские и межполевые правила

Функция `custom` принимает ссылку на поле и возвращает `Result<(), ValidationError>`. Она вызывается напрямую, поэтому
проверка, написанная для `&str`, примет и поле типа `&String` за счёт deref-приведения:
```rust compile
use volga::validation::ValidationError;

fn is_supported_sort(value: &str) -> Result<(), ValidationError> {
    match value {
        "asc" | "desc" => Ok(()),
        other => Err(ValidationError::message(format!("`{other}` is not a sort order"))),
    }
}
```

Правило, связывающее два поля, не может жить ни на одном из них, поэтому для таких случаев **контейнер** принимает
`#[validate(schema = "path::to::fn")]` — именно поэтому макрос является синтаксическим сахаром над типажом, а не его
заменой:
```rust compile
use serde::Deserialize;
use volga::validation::{Validate, ValidationError};

#[derive(Deserialize, Validate)]
#[validate(schema = "from_is_before_to")]
struct Filter {
    #[validate(range(min = 1, max = 100))]
    per_page: u32,

    from: Option<u32>,
    to: Option<u32>,
}

fn from_is_before_to(filter: &Filter) -> Result<(), ValidationError> {
    if let (Some(from), Some(to)) = (filter.from, filter.to)
        && from > to
    {
        return Err(ValidationError::field("from", "must not be after `to`"));
    }
    Ok(())
}
```
Сначала выполняются правила полей, затем функции `schema` контейнера.

### Вложенные типы

`nested` объединяет ошибки дочернего типа под именем `parent.child`, а вложенную коллекцию — под `parent[0].child`.
Обёртки `Option<T>` и `Vec<T>` раскрываются:
```rust compile
use serde::Deserialize;
use volga::validation::Validate;

#[derive(Deserialize, Validate)]
struct Item {
    #[validate(length(min = 1))]
    name: String,
}

#[derive(Deserialize, Validate)]
struct Order {
    #[validate(nested)]
    head: Item,

    #[validate(nested)]
    items: Vec<Item>,

    #[validate(nested)]
    note: Option<Item>,
}
```
Для `Order` с пустым `items[1].name` будет сообщён именно этот путь.

### Что макрос отвергает

Атрибут, который макрос смог бы выполнить лишь наполовину, отвергается на этапе компиляции, а не применяется частично:

* `equal` рядом с `min` или `max` — `equal` задаёт проверку сам по себе, поэтому соседнее ограничение никто бы не прочитал.
* Ограничение `range`, которое не является ни литералом, ни константой. Ограничение читается один раз при описании
  маршрута и ещё раз на каждом запросе; всё, что могло бы ответить по-разному в этих двух случаях, опубликовало бы
  контракт, который сервер не соблюдает.
* Нелитеральное ограничение `range` без `message = ".."` — нет текста, который можно подставить в сообщение по
  умолчанию, а имя константы вместо её значения ничего не скажет клиенту.

Правило, которое действительно меняется, — это `custom`.

## Реализация `Validate` вручную

Макрос необязателен. Прямая реализация типажа делает то же самое, и именно её стоит выбрать для типа с правилами,
которые макрос не покрывает:
```rust compile
use volga::validation::{Validate, ValidationError};
use serde::Deserialize;

#[derive(Deserialize)]
struct KeyValue {
    key: String,
    value: String,
}

impl Validate for KeyValue {
    type Error = ValidationError;

    fn validate(&self) -> Result<(), Self::Error> {
        let mut err = ValidationError::new();
        if self.key.is_empty() {
            err.push("key", "key is required");
        }
        if self.value.len() > 4096 {
            err.push("value", "value is too long");
        }
        err.into_result()
    }
}
```

## `ValidationError`

[`ValidationError`](https://docs.rs/volga/latest/volga/validation/struct.ValidationError.html) — это то, во что
реализации `Validate` накапливают ошибки.

| Метод | Что делает |
|---|---|
| `new()` | пустая ошибка для накопления |
| `push(field, message)` / `push_message(message)` | добавляет ошибку с полем или без него |
| `into_result()` | `Ok(())`, если ничего не накопилось, иначе `Err(self)` |
| `field(name, message)` / `message(text)` | одна ошибка, для варианта «падать сразу» |
| `entries()` | перебор накопленных пар `(Option<&str>, &str)` |
| `merge(other)` / `merge_at(prefix, other)` | вливает одну ошибку в другую, при необходимости под префиксом |
| `with_status(status)` | переопределяет статус, которым отвечает ошибка |
| `is_empty()` / `len()` / `status()` | чтение накопленного состояния |

### Выбор статуса

`ValidationError` отвечает `400 Bad Request`. Ошибки разбора уже отвечают `400`, поэтому такое значение по умолчанию
делает некорректно сформированные и невалидные данные неразличимыми по статусу. Сервис, которому нужен `422`, говорит
об этом явно:
```rust
ValidationError::field("key", "key is required")
    .with_status(StatusCode::UNPROCESSABLE_ENTITY)
```
Статус, запрошенный влитой ошибкой, сохраняется, поэтому `with_status` работает из функции `schema` или `custom` ровно
так же, как из написанной вручную реализации.

### Имена в сообщениях об ошибках

Ошибки сообщаются под тем именем, **которое прислал клиент**, а не под именем поля в Rust. `#[serde(rename = "..")]` и
`#[serde(rename_all = "..")]` читаются с типа, а `#[validate(rename = "..")]` перекрывает оба:
```rust compile
use serde::Deserialize;
use volga::validation::Validate;

#[derive(Deserialize, Validate)]
#[serde(rename_all = "camelCase")]
struct Renamed {
    #[validate(length(min = 1))]
    page_size: String,          // сообщается как `pageSize`

    #[serde(rename = "sortOrder")]
    #[validate(length(min = 1))]
    sort: String,               // сообщается как `sortOrder`
}
```
`#[validate(rename)]` переименовывает **только сообщение об ошибке** — ограничение обязано остаться привязанным к имени,
под которым свойство известно схеме, иначе правило молча выпало бы из спецификации OpenAPI. Поле с `#[serde(flatten)]`
сообщается на том уровне, на котором его прислал клиент, без имени, которое оно носит в Rust.

## Композиция с `Option` и `Result`

`Option<Valid<..>>` и `Result<Valid<..>, Error>` компонуются так же, как вокруг любого другого экстрактора. Первый
проглатывает ошибку, второй — способ обработать её самому:
```rust
use volga::{App, ValidJson, error::Error, ok, status};

// `None`, если данные отсутствуют или невалидны
app.map_post("/put", async |val: Option<ValidJson<KeyValue>>| match val {
    Some(val) => ok!("{}", val.key),
    None => ok!("none"),
});

// Ошибка в руках обработчика
app.map_post("/items", async |val: Result<ValidJson<KeyValue>, Error>| match val {
    Ok(val) => ok!("{}", val.key),
    Err(err) => status!(422, "{err}"),
});
```

## Problem Details

С фичей `problem-details` `ValidationError` отрисовывается по [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457) с
расширением `errors`, которое сопоставляет каждому полю собранные для него сообщения.
[`use_problem_details()`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.use_problem_details) подхватывает
это без дополнительной настройки:
```rust
let mut app = App::new();

app.use_problem_details();

app.map_post("/put", async |val: ValidJson<KeyValue>| {
    ok!("{}={}", val.key, val.value)
});
```
```bash
> curl -X POST "http://127.0.0.1:7878/put" -H "Content-Type: application/json" -d "{\"key\":\"\",\"value\":\"...\"}"
```
```json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.1",
  "title": "Bad Request",
  "status": 400,
  "detail": "key: key is required; value: value is too long",
  "errors": {
    "key": ["key is required"],
    "value": ["value is too long"]
  }
}
```
Ошибки, не привязанные к полю, группируются под пустым ключом. Об остальной поддержке Problem Details см.
[Глобальная обработка ошибок](/volga-docs/ru/reliability-observability/errors.html).

## Сторонние библиотеки валидации

Собственный тип ошибки библиотеки валидации и `volga::error::Error` оба являются внешними для вашего крейта, поэтому
реализацию `From` там написать нельзя. [`Invalid<E>`](https://docs.rs/volga/latest/volga/validation/struct.Invalid.html) —
это newtype, который решает задачу одним словом:
```rust
use volga::validation::{Invalid, Validate};

impl Validate for KeyValue {
    type Error = Invalid<TheirError>;

    fn validate(&self) -> Result<(), Self::Error> {
        self.check().map_err(Invalid)
    }
}
```
Этим отношения Волги с такими библиотеками и исчерпываются: ни зависимости, ни фичи, ни обобщённой реализации поверх
чужого типажа — ровно столько места, чтобы поместить её за написанной вручную реализацией `Validate`. `Invalid`
отвечает `400 Bad Request`, а `into_inner()` возвращает исходную ошибку.

## OpenAPI

Объявленные правила не только применяются, но и публикуются.
[`Validate::constraints()`](https://docs.rs/volga/latest/volga/validation/trait.Validate.html#method.constraints)
сообщает, что объявлено на полях, а `Valid<E>` передаёт это в описание OpenAPI — на свойство схемы тела запроса или на
параметр, добавленный тем же экстрактором, и никогда на параметр, принадлежащий другому аргументу обработчика. Поэтому
обёртывание экстрактора не выбрасывает молча тело запроса или параметры запроса из спецификации.

Какое ключевое слово получит правило размера, решается по схеме, а не по написанию поля, поэтому `minLength`, `minItems`
и `minProperties` описывают именно то, что должны, даже когда тип достигается через псевдоним. Ограничение, объявленное
дважды, публикуется как пересечение, из-за чего порядок написания правил не имеет значения.

То, что нельзя опубликовать точно, не публикуется вовсе, а не округляется: числовое ограничение сохраняет разрядность и
знаковость, ограничение с плавающей точкой читается на той разрядности, на которой сравнивается, а то, что не помещается
ни в одно число JSON — 128-битное ограничение больше `u64::MAX` — не публикуется. Задокументированное и применяемое
ограничения не могут разойтись.

У `constraints()` есть реализация по умолчанию, возвращающая пустой список, поэтому написанной вручную реализации
`Validate` это не касается.

::: tip
Валидация выполняется **после** извлечения данных. Чтобы отклонить запрос раньше — по пути, методу или заголовку —
используйте [фильтр маршрута](/volga-docs/ru/middleware-infrastructure/middleware.html).
:::

Полный [пример](https://github.com/RomanEmreis/volga/blob/main/examples/payload_validation/src/main.rs)
