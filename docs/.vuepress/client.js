import { defineClientConfig } from 'vuepress/client'
import CodeShowcase from './components/CodeShowcase.vue'

export default defineClientConfig({
  enhance({ app }) {
    app.component('CodeShowcase', CodeShowcase)
  },
})
