# Группировка маршрутов

Волга предоставляет удобный механизм для группировки маршрутов с использованием префиксов. Это помогает более эффективно организовывать и управлять связанными конечными точками. Этого можно добиться с помощью метода [`map_group`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_group). 

После определения группы можно применять те же методы сопоставления (например, [`map_get`](https://docs.rs/volga/latest/volga/app/router/struct.RouteGroup.html#method.map_get) или [`map_post`](https://docs.rs/volga/latest/volga/app/router/struct.RouteGroup.html#method.map_post)), что и в основном приложении.

### Пример использования

Пример, демонстрирующий использование групп маршрутов в приложении:

```rust
use volga::{App, HttpResult, ok};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let mut app = App::new();

    // Группирует маршруты по префиксу "/user"
    app.map_group("/user")
        .map_get("/{id}", get_user)               // GET /user/{id}
        .map_post("/create/{name}", create_user); // POST /user/create/{name}

    app.run().await
}

async fn get_user(_id: i32) -> HttpResult {
    // Получаем пользователя
    ok!("John")
}

async fn create_user(name: String) -> HttpResult {
    // Создаем пользователя
    ok!("User {name} created!")
}
```

### Пояснения

- **Группировка**:  
  Метод [`map_group`](https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_group) создает [`RouteGroup`](https://docs.rs/volga/latest/volga/app/router/struct.RouteGroup.html), с префиксом `/user`.  
- **Сопоставление методов**:  
  Внутри группы маршруты определяются с помощью таких методов, как [`map_get`](https://docs.rs/volga/latest/volga/app/router/struct.RouteGroup.html#method.map_get) и [`map_post`](https://docs.rs/volga/latest/volga/app/router/struct.RouteGroup.html#method.map_post). Они работают так же, как и в основном объекте приложения, но наследуют префикс, определенный для группы.

Больше примеров можно найти [здесь](https://github.com/RomanEmreis/volga/blob/main/examples/route_groups.rs).
