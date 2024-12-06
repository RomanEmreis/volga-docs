import comp from "C:/Source/Repos/volga/volga-docs-v2/vuepress-starter/docs/.vuepress/.temp/pages/getting-started/json-payload.html.vue"
const data = JSON.parse("{\"path\":\"/getting-started/json-payload.html\",\"title\":\"Handling JSON\",\"lang\":\"en-US\",\"frontmatter\":{},\"headers\":[{\"level\":2,\"title\":\"Receiving JSON Data\",\"slug\":\"receiving-json-data\",\"link\":\"#receiving-json-data\",\"children\":[]},{\"level\":2,\"title\":\"Sending JSON Responses\",\"slug\":\"sending-json-responses\",\"link\":\"#sending-json-responses\",\"children\":[{\"level\":3,\"title\":\"Using Results::from()\",\"slug\":\"using-results-from\",\"link\":\"#using-results-from\",\"children\":[]},{\"level\":3,\"title\":\"Using Results::json()\",\"slug\":\"using-results-json\",\"link\":\"#using-results-json\",\"children\":[]},{\"level\":3,\"title\":\"Simplified Version with ok! Macro\",\"slug\":\"simplified-version-with-ok-macro\",\"link\":\"#simplified-version-with-ok-macro\",\"children\":[]},{\"level\":3,\"title\":\"Using Status with JSON\",\"slug\":\"using-status-with-json\",\"link\":\"#using-status-with-json\",\"children\":[]}]}],\"git\":{},\"filePathRelative\":\"getting-started/json-payload.md\"}")
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
