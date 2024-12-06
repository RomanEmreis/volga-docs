
  import { defineAsyncComponent } from 'vue'
import { defineClientConfig } from 'vuepress/client'

import { applyClientSetup } from 'C:/Source/Repos/volga/volga-docs-v2/vuepress-starter/node_modules/vuepress-theme-reco/lib/client/clientSetup.js'
import { applyClientEnhance } from 'C:/Source/Repos/volga/volga-docs-v2/vuepress-starter/node_modules/vuepress-theme-reco/lib/client/clientEnhance.js'

import * as layouts from 'C:/Source/Repos/volga/volga-docs-v2/vuepress-starter/node_modules/vuepress-theme-reco/lib/client/layouts/index.js'

  const layoutsFromDir = {}
export default defineClientConfig({
  enhance(...args) {
    applyClientEnhance(...args)
  },
  setup() {
    applyClientSetup()
  },
  // @ts-ignore
  layouts: { ...layouts, ...layoutsFromDir },
})
