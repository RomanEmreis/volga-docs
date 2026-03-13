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
import { ref, computed } from 'vue'

const props = defineProps({
  tabs: {
    type: Array,
    required: true,
  }
})

const activeTab = ref(0)

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Rust highlighter producing PrismJS-compatible token classes
// so the globally loaded one-dark / one-light theme CSS applies.
function highlightRust(code) {
  const lines = code.split('\n')
  return lines.map((line, idx) => {
    let html = escapeHtml(line)

    // Comments
    html = html.replace(/(\/\/.*)/, '<span class="token comment">$1</span>')

    // Strings
    html = html.replace(/(&quot;(?:[^&]|&(?!quot;))*?&quot;)/g, '<span class="token string">$1</span>')

    // Attributes (#[...])
    html = html.replace(/(#\[[^\]]*\])/g, '<span class="token attribute attr-name">$1</span>')

    // Macros (word!)
    html = html.replace(/\b([a-z_]+!)(?=\()/g, '<span class="token macro property">$1</span>')
    html = html.replace(/\b([a-z_]+!)(?=[^<])/g, '<span class="token macro property">$1</span>')

    // Keywords
    const keywords = ['use','fn','let','mut','async','move','await','struct','match','pub','mod','impl','self','Self','return','if','else','for','in','while','loop','break','continue','where','type','trait','enum','const','static','ref','as','crate','super','extern','unsafe']
    const kwPattern = new RegExp('\\b(' + keywords.join('|') + ')\\b', 'g')
    html = html.replace(kwPattern, '<span class="token keyword">$1</span>')

    // Types (PascalCase)
    html = html.replace(/\b([A-Z][A-Za-z0-9]*)\b/g, '<span class="token class-name">$1</span>')

    // Function calls
    html = html.replace(/\b([a-z_][a-z_0-9]*)\s*(?=\()/g, '<span class="token function">$1</span>')

    // Numbers
    html = html.replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="token number">$1</span>')

    // Namespace separators
    html = html.replace(/::/g, '<span class="token punctuation">::</span>')

    return '<span class="line"><span class="line-number">' + (idx + 1) + '</span>' + html + '</span>'
  }).join('\n')
}

const highlighted = computed(() =>
  props.tabs.map(tab => {
    const html = highlightRust(tab.code)
    return '<pre class="language-rust"><code class="language-rust">' + html + '</code></pre>'
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

/* Card — matches feature card style */
.code-showcase__card {
  background: var(--code-c-bg, #ecf4fa);
  border: 1px solid var(--vp-c-border, var(--c-border, #e2e2e3));
  border-radius: 12px;
  box-shadow:
    0 2px 8px rgba(0, 0, 0, 0.04),
    0 4px 16px rgba(0, 0, 0, 0.06);
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

.code-showcase__panel :deep(.line) {
  display: block;
}

.code-showcase__panel :deep(.line-number) {
  display: inline-block;
  width: 2em;
  margin-right: 1.25em;
  text-align: right;
  color: var(--vp-c-text-mute, #aaa);
  user-select: none;
  font-size: 0.9em;
  opacity: 0.5;
}
</style>
