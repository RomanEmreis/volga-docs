import { defineClientConfig } from 'vuepress/client'
import CodeShowcase from './components/CodeShowcase.vue'
import SkillDownload from './components/SkillDownload.vue'

export default defineClientConfig({
  enhance({ app }) {
    app.component('CodeShowcase', CodeShowcase)
    app.component('SkillDownload', SkillDownload)
  },
})
