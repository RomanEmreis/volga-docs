import comp from "C:/Source/Repos/volga/volga-docs-v2/vuepress-starter/docs/.vuepress/.temp/pages/getting-started/files.html.vue"
const data = JSON.parse("{\"path\":\"/getting-started/files.html\",\"title\":\"Working with Files in Volga\",\"lang\":\"en-US\",\"frontmatter\":{},\"headers\":[{\"level\":2,\"title\":\"Downloading Files\",\"slug\":\"downloading-files\",\"link\":\"#downloading-files\",\"children\":[{\"level\":3,\"title\":\"Using Results::file()\",\"slug\":\"using-results-file\",\"link\":\"#using-results-file\",\"children\":[]},{\"level\":3,\"title\":\"Simplifying with the file! macro\",\"slug\":\"simplifying-with-the-file-macro\",\"link\":\"#simplifying-with-the-file-macro\",\"children\":[]}]},{\"level\":2,\"title\":\"Uploading Files\",\"slug\":\"uploading-files\",\"link\":\"#uploading-files\",\"children\":[{\"level\":3,\"title\":\"Example of File Upload\",\"slug\":\"example-of-file-upload\",\"link\":\"#example-of-file-upload\",\"children\":[]}]}],\"git\":{},\"filePathRelative\":\"getting-started/files.md\"}")
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
