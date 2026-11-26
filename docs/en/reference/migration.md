# Migration

The guides describe the current release, **0.15**. This page lists what changes when you upgrade, newest release first. Each release separates two kinds of change:

* **Does not compile**: the compiler finds every place for you, and the message usually names the fix.
* **Compiles, answers differently**: nothing flags these, so search your code, tests and clients for them.

To upgrade across several releases, read every section between your version and the current one. Releases before 0.10 are in the [CHANGELOG](https://github.com/RomanEmreis/volga/blob/main/CHANGELOG.md). The [agent skill](/volga-docs/en/agent-skill.html) carries the same notes, so a coding agent can do the upgrade for you.

## 0.15.1

A security release. Upgrade if file names or request bodies come from untrusted clients.

**Compiles, answers differently:**

* `File::save`, `Field::save` and `save_all` keep only the part of the client's file name after the last `/` or `\`, and answer `400` when nothing usable is left. Before, they joined the folder with the name as sent, so `filename="../../x"` wrote outside the folder and an absolute name replaced it. `save_as` is unchanged.
* `file!` escapes the file name in `Content-Disposition`. Before, it wrote the name as is, so a name such as `a"; filename="evil.exe` chose what the browser saved the file as. `file!` also takes a `String` name now, and [`ContentDisposition::attachment()`](/volga-docs/en/requests-responses/files.html) builds the same header for other responses.
* A compressed request body that is not a valid stream answers `400` instead of `500`. A Brotli stream with a window over 16 MiB, or a zstd frame with a window over 8 MiB, answers `400` too: before, a body of a few bytes could make the server allocate a gigabyte.
* An empty HMAC secret panics in `DecodingKey::from_secret`, as it already did in `from_env` and `from_file`. Use `try_from_secret` to get an error instead.
* A JWT whose header lists a critical extension (`crit`) that Volga does not know answers `401`.

**New:** [`with_header_read_timeout()`](/volga-docs/en/protocols-realtime/http.html#header-read-timeout) and `header_read_timeout_secs` in the config file. The timeout is off by default.

## 0.15.0

Custom extractors get one trait, and Volga's own rejections become errors.

**Does not compile:**

* A custom extractor implements [`FromRequestHead`](/volga-docs/en/advanced-patterns/custom-extractors.html). `FromRequest` and `FromRequestRef` are sealed, and `FromRequestParts` and `FromContainer` are removed. An impl of `FromRequestRef` becomes `impl FromRequestHead`, and its `dependencies` move with it.
* A handler cannot take two body extractors, an argument after `HttpRequest`, or positional parameters next to `Path<T>`. These used to fail on every request. The error appears in `cargo build`, not in `cargo check`.
* A custom `FromPathArg` type is read through `Path<T>`: `|Path(id): Path<OrderId>|` instead of `|id: OrderId|`. Built-in types such as `u64`, `String` and `Uuid` are still taken bare.
* `ClientIp`, `Path<T>`, `NamedPath<T>`, `ShutdownHandle` and other extractors no longer implement `TryFrom<&Extensions>`. Read them with `req.extract::<ClientIp>()`.
* `HttpRequestMut::into_parts()` and `from_parts()` are deprecated, which is an error under `-D warnings`. Replace the body with [`map_body()`](/volga-docs/en/middleware-infrastructure/middleware.html#replacing-the-body) or `try_map_body()`.

**Compiles, answers differently:**

* The router's `404` and `405`, the `400`/`401`/`403` of `authorize`, the `429` of rate limiting, the `403`/`404` of static files and the `406` of compression are errors now. They reach [`map_err` and `map_problem`](/volga-docs/en/reliability-observability/errors.html#errors-volga-produces-itself), and `map_ok` no longer sees them.
* A scoped `map_err` or `map_problem` covers its whole route or group, whatever order it was registered in. Before, `.filter(..).map_problem()` left the filter's rejection to the application's handler.
* A request without a required `Header<T>` answers `400` instead of `404`.
* CORS headers are added to error responses as well, not only to successful ones.

**New:** `tap_req` takes extractors after `HttpRequestMut`, with or without the `di` feature. Before, it took only `Dc<T>`, and only with `di`. `Error::with_header()` adds a header that survives any error handler.

## 0.14.1

Renames to one naming rule. The old names still compile, with a deprecation warning, and behave the same.

* `Route::cache_control()` and `RouteGroup::cache_control()` → `with_cache_control()`.
* `App::use_problem_details()` → `App::map_problem()`.
* `ValidPath<T>` → `ValidNamedPath<T>`, because it validates a `NamedPath<T>`, not a `Path<T>`.

**New:** a `set_X(config)` method next to every `with_X(closure)` that builds a config: `set_bearer_auth`, `set_oauth`, `set_cache_control`, `set_http2_limits`, `set_decompression_limits`. It takes a config built elsewhere, for example in a helper shared by the application and its tests.

## 0.14.0

**Does not compile:**

* `Dc<T>` no longer implements `DerefMut`. A write through it, such as `counter.hits += 1`, changed a private copy that no other request saw, and now fails with `E0594` or `E0596`. Move the state behind a `Mutex`, an `RwLock` or an atomic inside the service, or take `Dc::cloned()` where a private copy is what the handler meant.

**Compiles, answers differently:**

* `App::run()` does not start when a handler or middleware takes `Dc<T>` of a type nobody registered, and names the type. Before, the app started and that route answered `500` on every request.
* `map_*` panics when a handler reads more path parameters than its route declares. Before, the route answered `500` on every request.
* A filter that returns `false` answers with the message `Request rejected by filter`. Before, it said `Validation: One or more request parameters are incorrect`, also for requests to paths that do not exist.
* A body over the limit answers with the message `request body is larger than the limit` through every reader. `Json<T>` and `Form<T>` no longer put `JSON parsing error` or `Form Data parsing error` in front of it.

**New:** `map_ws` and `map_msg` hand their handler the parameters of its route, and a handler taking `HttpRequest` sees them too.

## 0.13.x

**0.13.3, compiles, answers differently.** All of it is bearer authentication:

* The first `with_alg()` replaces the default `HS256`, and later calls add to the list. `.with_alg(Algorithm::HS512)` alone no longer accepts `HS256` tokens: name both while clients move over.
* `BearerTokenService::encode` signs with the first algorithm from `with_alg`, not always with `HS256`.
* A key that does not fit the configured algorithms stops `App::run()` with an error that names the key and the algorithms.
* `with_iss()` makes the `iss` claim required, so a token without it answers `401`.

**0.13.2, new:** [`OAuthConfig::with_jwks_uri()`](/volga-docs/en/security-access/oauth.html) and `DecodingKey::from_jwk()`.

**0.13.1, compiles, answers differently:**

* A body over the limit answers `413 Content Too Large` instead of `400`.
* A `Content-Length` over the limit fails the first read, before any of the body arrives.
* New: [body limits per group and per route](/volga-docs/en/requests-responses/body.html#per-route-group-and-per-route).

**0.13.0, compiles, answers differently:**

* The router decodes the path once, and every extractor reads the decoded value: `John%20Doe` arrives as `John Doe`. Remove any decoding of your own, or a value with a literal `%` gets decoded twice.
* A malformed escape answers `400` before routing.
* A literal segment or group prefix written with a percent-escape panics at registration. Write its text instead: `"/docs v1"`, not `"/docs%20v1"`.

**0.13.0, does not compile:** a custom type is a path parameter only through [`FromPathArg`](/volga-docs/en/getting-started/route-params.html#parameters-of-your-own-types). Implementing `FromStr` is not enough.

## 0.12.0

A handler's `Err` is an error, not a second kind of response.

**Compiles, answers differently:**

* `Err(String)` and other strings answer `500` instead of `200`. Nothing flags it, so search for such handlers and give each error a status: `Err((StatusCode::NOT_FOUND, "not found"))`.
* `Err(StatusCode)` and `Err(Problem)` keep their status but reach `map_err`. `Err(StatusCode)` answers with its canonical reason instead of an empty body.

**Does not compile:**

* `Err(HttpResponse)`, `Err(Json<T>)` and other response types. Return the response as `Ok`, or return an error and attach the body with `Error::with_response()`.
* A type with its own `From<T> for Error` cannot be a handler's `Err` until that `From` becomes an [`IntoError`](/volga-docs/en/reliability-observability/errors.html#error-types-of-your-own) impl. If both exist, the compiler reports `E0119`: delete the `From`.
* A filter's `Err` must be `Error` or implement `IntoError`; a plain `std::error::Error` is not enough.

All of it applies to `map_err`, `map_fallback`, `with`, `map_ok` and filters as well.

## 0.11.x

**0.11.0, does not compile:** only calls that spell out handler generics with a turbofish. Every handler trait gained a marker parameter, so add a trailing `_`. See [Handler generics](/volga-docs/en/reference/handler-generics.html).

**0.11.0, compiles, answers differently:** connections still open when the shutdown timeout expires are closed, and their `CancellationToken` is cancelled. `Json<T>` goes out over a WebSocket as a text frame instead of a binary one.

**0.11.1:** the static-files fallback is a `GET` route, so another method answers `405`, and it no longer takes the application's `map_fallback` slot.

## 0.10.x

**0.10.1, compiles, answers differently:**

* A rejected bearer token answers `401` instead of `403`, and a malformed one `401` instead of `400`. Anything that reads `403` as "this token cannot be refreshed", such as a test, a client's refresh trigger or an alert, has to read `401` instead.
* `App::run()` checks the DI container and refuses to start on a cycle or a missing registration.

**0.10.0, does not compile:** `map_static_assets()` is renamed to `use_static_assets()`, because it registers no route. `App::without_implicit_head()` and `FromRawRequest` are removed.

**0.10.0, compiles, answers differently:**

* A group's middleware reaches every route of the group, wherever the route is registered. A route mapped above its group's `authorize` or `token_bucket` used to escape it, and now answers `401`, `403` or `429` where it answered `200`.
* Global middleware, rate limiting included, runs for requests that match no route.
* `HEAD` goes through the `GET` route and its middleware, so a health check over `HEAD` on an authorized route answers `401`.
* A static file answers before a route with the same path.
