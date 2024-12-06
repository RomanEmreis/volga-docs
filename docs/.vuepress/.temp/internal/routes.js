export const redirects = JSON.parse("{}")

export const routes = Object.fromEntries([
  ["/", { loader: () => import(/* webpackChunkName: "index.html" */"C:/Source/Repos/volga/volga-docs-v2/vuepress-starter/docs/.vuepress/.temp/pages/index.html.js"), meta: {"title":"Volga"} }],
  ["/advanced/cancellation.html", { loader: () => import(/* webpackChunkName: "advanced_cancellation.html" */"C:/Source/Repos/volga/volga-docs-v2/vuepress-starter/docs/.vuepress/.temp/pages/advanced/cancellation.html.js"), meta: {"title":"Request cancellation"} }],
  ["/advanced/http.html", { loader: () => import(/* webpackChunkName: "advanced_http.html" */"C:/Source/Repos/volga/volga-docs-v2/vuepress-starter/docs/.vuepress/.temp/pages/advanced/http.html.js"), meta: {"title":"HTTP/1 and HTTP/2"} }],
  ["/advanced/mini.html", { loader: () => import(/* webpackChunkName: "advanced_mini.html" */"C:/Source/Repos/volga/volga-docs-v2/vuepress-starter/docs/.vuepress/.temp/pages/advanced/mini.html.js"), meta: {"title":"Minimal API"} }],
  ["/getting-started/files.html", { loader: () => import(/* webpackChunkName: "getting-started_files.html" */"C:/Source/Repos/volga/volga-docs-v2/vuepress-starter/docs/.vuepress/.temp/pages/getting-started/files.html.js"), meta: {"title":"Working with Files in Volga"} }],
  ["/getting-started/headers.html", { loader: () => import(/* webpackChunkName: "getting-started_headers.html" */"C:/Source/Repos/volga/volga-docs-v2/vuepress-starter/docs/.vuepress/.temp/pages/getting-started/headers.html.js"), meta: {"title":"Headers"} }],
  ["/getting-started/json-payload.html", { loader: () => import(/* webpackChunkName: "getting-started_json-payload.html" */"C:/Source/Repos/volga/volga-docs-v2/vuepress-starter/docs/.vuepress/.temp/pages/getting-started/json-payload.html.js"), meta: {"title":"Handling JSON"} }],
  ["/getting-started/middlewares.html", { loader: () => import(/* webpackChunkName: "getting-started_middlewares.html" */"C:/Source/Repos/volga/volga-docs-v2/vuepress-starter/docs/.vuepress/.temp/pages/getting-started/middlewares.html.js"), meta: {"title":"Custom Middleware"} }],
  ["/getting-started/query-params.html", { loader: () => import(/* webpackChunkName: "getting-started_query-params.html" */"C:/Source/Repos/volga/volga-docs-v2/vuepress-starter/docs/.vuepress/.temp/pages/getting-started/query-params.html.js"), meta: {"title":"Query Parameters"} }],
  ["/getting-started/quick-start.html", { loader: () => import(/* webpackChunkName: "getting-started_quick-start.html" */"C:/Source/Repos/volga/volga-docs-v2/vuepress-starter/docs/.vuepress/.temp/pages/getting-started/quick-start.html.js"), meta: {"title":"Quick Start"} }],
  ["/getting-started/route-params.html", { loader: () => import(/* webpackChunkName: "getting-started_route-params.html" */"C:/Source/Repos/volga/volga-docs-v2/vuepress-starter/docs/.vuepress/.temp/pages/getting-started/route-params.html.js"), meta: {"title":"Route Parameters"} }],
  ["/404.html", { loader: () => import(/* webpackChunkName: "404.html" */"C:/Source/Repos/volga/volga-docs-v2/vuepress-starter/docs/.vuepress/.temp/pages/404.html.js"), meta: {"title":""} }],
]);

if (import.meta.webpackHot) {
  import.meta.webpackHot.accept()
  if (__VUE_HMR_RUNTIME__.updateRoutes) {
    __VUE_HMR_RUNTIME__.updateRoutes(routes)
  }
  if (__VUE_HMR_RUNTIME__.updateRedirects) {
    __VUE_HMR_RUNTIME__.updateRedirects(redirects)
  }
}

if (import.meta.hot) {
  import.meta.hot.accept(({ routes, redirects }) => {
    __VUE_HMR_RUNTIME__.updateRoutes(routes)
    __VUE_HMR_RUNTIME__.updateRedirects(redirects)
  })
}
