import comp from "C:/Source/Repos/volga/volga-docs-v2/vuepress-starter/docs/.vuepress/.temp/pages/getting-started/quick-start.html.vue"
const data = JSON.parse("{\"path\":\"/getting-started/quick-start.html\",\"title\":\"Quick Start\",\"lang\":\"en-US\",\"frontmatter\":{},\"headers\":[{\"level\":2,\"title\":\"Prerequisites\",\"slug\":\"prerequisites\",\"link\":\"#prerequisites\",\"children\":[]},{\"level\":2,\"title\":\"Setup\",\"slug\":\"setup\",\"link\":\"#setup\",\"children\":[]},{\"level\":2,\"title\":\"Detailed Walkthrough\",\"slug\":\"detailed-walkthrough\",\"link\":\"#detailed-walkthrough\",\"children\":[]},{\"level\":2,\"title\":\"Testing the API\",\"slug\":\"testing-the-api\",\"link\":\"#testing-the-api\",\"children\":[]}],\"git\":{},\"filePathRelative\":\"getting-started/quick-start.md\"}")
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
