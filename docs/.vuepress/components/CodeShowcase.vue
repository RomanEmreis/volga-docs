<template>
  <div class="code-showcase">
    <div class="code-showcase__tabs">
      <button
        v-for="(tab, i) in tabs"
        :key="i"
        :class="['code-showcase__tab', { active: activeTab === i }]"
        @click="activeTab = i"
      >
        {{ tab.title }}
      </button>
    </div>
    <div class="code-showcase__card">
      <div class="code-showcase__content">
        <div
          v-for="(tab, i) in tabs"
          :key="i"
          v-show="activeTab === i"
          class="code-showcase__panel"
          v-html="highlighted[i]"
        ></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

const props = defineProps({
  tabs: {
    type: Array,
    required: true,
  }
})

const activeTab = ref(0)
const usePrism = ref(false)

onMounted(() => {
  // Use PrismJS if available (loaded by VuePress plugin)
  if (typeof window !== 'undefined' && window.Prism && window.Prism.languages.rust) {
    usePrism.value = true
  }
})

function highlightWithPrism(code) {
  if (typeof window !== 'undefined' && window.Prism && window.Prism.languages.rust) {
    return window.Prism.highlight(code, window.Prism.languages.rust, 'rust')
  }
  return escapeHtml(code)
}

// Fallback simple Rust highlighter for SSR
function highlightRust(code) {
  let html = escapeHtml(code)
  html = html.replace(/(\/\/.*)/g, '<span class="token comment">$1</span>')
  html = html.replace(/(&quot;(?:[^&]|&(?!quot;))*?&quot;)/g, '<span class="token string">$1</span>')
  html = html.replace(/(#\[[\w:,\s()]*\])/g, '<span class="token attribute">$1</span>')
  html = html.replace(/\b([a-z_]+!)/g, '<span class="token macro">$1</span>')
  const keywords = ['use','fn','let','mut','async','move','await','struct','match','Some','None','Ok','Err','pub','mod','impl','self','Self','return','if','else','for','in','while','loop','break','continue','where','type','trait','enum','const','static','ref','as','crate','super','extern','unsafe']
  const kwPattern = new RegExp('\\b(' + keywords.join('|') + ')\\b', 'g')
  html = html.replace(kwPattern, '<span class="token keyword">$1</span>')
  html = html.replace(/\b([A-Z][A-Za-z0-9]*)\b/g, '<span class="token class-name">$1</span>')
  html = html.replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="token number">$1</span>')
  return html
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const highlighted = computed(() =>
  props.tabs.map(tab => {
    const html = usePrism.value ? highlightWithPrism(tab.code) : highlightRust(tab.code)
    return '<pre class="language-rust"><code>' + html + '</code></pre>'
  })
)
</script>

<style scoped>
.code-showcase {
  margin: 1.5rem auto 2.5rem;
  max-width: 780px;
}

/* Tabs */
.code-showcase__tabs {
  display: flex;
  gap: 0;
  margin-bottom: 0;
  position: relative;
  z-index: 2;
  padding-left: 4px;
}

.code-showcase__tab {
  padding: 0.5rem 1.15rem;
  border: none;
  background: transparent;
  color: var(--vp-c-text-mute, #888);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  border-radius: 6px 6px 0 0;
  transition: all 0.2s ease;
  font-family: inherit;
}

.code-showcase__tab:hover {
  color: var(--vp-c-text, #333);
}

.code-showcase__tab.active {
  background: var(--code-c-bg, #ecf4fa);
  color: var(--vp-c-text, #383a42);
}

/* Card — matches native VuePress code blocks */
.code-showcase__card {
  background: var(--code-c-bg, #ecf4fa);
  border-radius: var(--code-border-radius, 6px);
  box-shadow:
    0 4px 16px rgba(0, 0, 0, 0.08),
    0 1px 4px rgba(0, 0, 0, 0.05);
  overflow: hidden;
}

/* Content */
.code-showcase__content {
  padding: 0;
}

.code-showcase__panel :deep(pre) {
  margin: 0;
  padding: var(--code-padding-y, 1rem) var(--code-padding-x, 1.25rem);
  background: transparent;
  overflow-x: auto;
  font-size: var(--code-font-size, 0.875em);
  line-height: var(--code-line-height, 1.6);
}

.code-showcase__panel :deep(pre code) {
  font-family: var(--code-font-family, consolas, monaco, "Andale Mono", "Ubuntu Mono", monospace);
  color: var(--code-c-text, #383a42);
  background: none;
  padding: 0;
}
</style>
