# Handler Generics

A handler is either asynchronous or [synchronous](/volga-docs/en/getting-started/handlers.html#synchronous-handlers). You only need this page if you write the generic parameters of a `map_*` call yourself, or a bound of your own over handlers.

Handler code never names the shape: it is carried by a marker type, [`marker::Async`](https://docs.rs/volga/latest/volga/marker/struct.Async.html) or [`marker::Immediate`](https://docs.rs/volga/latest/volga/marker/struct.Immediate.html), which the compiler infers. It is the last generic parameter of every method registering a handler, so a call site that spells the generics out leaves a `_` for it:

```rust compile-fragment
app.map_get::<_, _, (i32, i32), _>("/sum/{x}/{y}", |x: i32, y: i32| x + y);
```

In a bound of your own, `F: GenericHandler<Args>` means the asynchronous shape, as the marker defaults to `marker::Async`; `F: GenericHandler<Args, M>` with a generic `M` accepts both.

A type that is both a `Future` and `IntoResponse` fits both shapes and does not compile as a handler's return type. Nothing in volga is such a type.
