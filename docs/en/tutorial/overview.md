# Tutorial: a Bookmarks Service

This tutorial builds a small but complete JSON API: a service that stores bookmarks. Each chapter adds one layer to the same program, and each ends with the whole `src/main.rs` as it stands, so you can stop after any chapter with a server that runs.

It is written for developers who have built an HTTP service before, in C#, Java, Go or anything else, and are new to Volga. It does not teach Rust itself: where the code needs a Rust feature, the text names it and links to the [Rust Book](https://doc.rust-lang.org/book/). If a Volga term is new, [Coming from ASP.NET Core, Spring or Go](/volga-docs/en/getting-started/coming-from.html) maps it to the one you know.

## What You Will Build

| Method and path | What it does | Who may call it |
|---|---|---|
| `POST /login` | Exchanges a user name and password for a token | anyone |
| `GET /bookmarks` | Lists bookmarks, `?tag=rust` filters them | anyone |
| `GET /bookmarks/{id}` | Answers one bookmark | anyone |
| `POST /bookmarks` | Stores a bookmark for the caller | a signed-in user |
| `DELETE /bookmarks/{id}` | Removes a bookmark | its owner or an admin |

Along the way the service picks up the parts a real API needs:

1. **[Project and First Routes](/volga-docs/en/tutorial/first-routes.html):** a project, the routes, JSON in and out, and a store shared through dependency injection.
2. **[Validation and Errors](/volga-docs/en/tutorial/validation-errors.html):** rules for incoming bookmarks, an error type of your own, and every error answered as [Problem Details](https://www.rfc-editor.org/rfc/rfc9457).
3. **[Authentication](/volga-docs/en/tutorial/authentication.html):** JWT tokens, routes only a signed-in user may call, and a check that a user deletes only their own bookmarks.
4. **[Testing](/volga-docs/en/tutorial/testing.html):** integration tests that start the service and send it real requests.

## Before You Start

* **Rust 1.90 or newer.** Install it with [rustup](https://rustup.rs/), or run `rustup update` on an existing installation.
* **curl**, or any HTTP client you like, to call the service by hand.

The store keeps bookmarks in memory, so they are gone when the server stops. That keeps the tutorial about Volga rather than about a database; the last chapter says where a real one would go.

Start with [Project and First Routes](/volga-docs/en/tutorial/first-routes.html).
