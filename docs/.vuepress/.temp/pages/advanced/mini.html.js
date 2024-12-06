import comp from "C:/Source/Repos/volga/volga-docs-v2/vuepress-starter/docs/.vuepress/.temp/pages/advanced/mini.html.vue"
const data = JSON.parse("{\"path\":\"/advanced/mini.html\",\"title\":\"Minimal API\",\"lang\":\"en-US\",\"frontmatter\":{},\"headers\":[],\"git\":{},\"filePathRelative\":\"advanced/mini.md\"}")
export { comp, data }

if (import.meta.webpackHot) {
  import.meta.webpackHot.accept()
  if (__VUE_HMR_RUNTIME__.updatePageData) {
    __VUE_HMR_RUNTIME__.updatePageData(data)
  }
}

if (import.meta.hot) {
  import.meta.hot.accept(({ data }) => {
    __VUE_HMR_RUNTIME__.updatePageData(data)
  })
}
