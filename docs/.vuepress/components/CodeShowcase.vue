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
    <div v-if="tabs[activeTab].description" class="code-showcase__desc">
      {{ tabs[activeTab].description }}
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
  const highlighted = lines.map(line => {
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

    return '<span class="line">' + html + '</span>'
  })

  const lineNumberDivs = lines.map(() => '<div class="line-number"></div>').join('')

  return (
    '<div class="language-rust line-numbers-mode" data-highlighter="prismjs" data-ext="rs">' +
    '<pre><code class="language-rust">' + highlighted.join('\n') + '\n</code></pre>' +
    '<div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;">' +
    lineNumberDivs +
    '</div>' +
    '</div>'
  )
}

const highlighted = computed(() =>
  props.tabs.map(tab => highlightRust(tab.code))
)
</script>

<style scoped>
.code-showcase {
  margin: 1.5rem auto 2.5rem;
  max-width: 960px;
}

/* Tabs */
.code-showcase__tabs {
  display: flex;
  gap: 0.4rem;
  margin-bottom: 0.5rem;
  padding-left: 2px;
}

.code-showcase__tab {
  padding: 0.4rem 1.1rem;
  border: 1px solid transparent;
  background: transparent;
  color: var(--vp-c-text-mute, #888);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.2s ease;
  font-family: inherit;
}

.code-showcase__tab:hover {
  color: var(--vp-c-text, #333);
}

.code-showcase__tab.active {
  background: var(--vp-c-bg, #fff);
  color: var(--vp-c-accent, #299764);
  border-color: var(--vp-c-border, #e2e2e3);
  box-shadow:
    0 2px 8px rgba(0, 0, 0, 0.04),
    0 4px 16px rgba(0, 0, 0, 0.06);
}

/* Description box */
.code-showcase__desc {
  border: 1px solid var(--vp-c-border, #e2e2e3);
  border-radius: 10px;
  padding: 0.65rem 1rem;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
  line-height: 1.6;
  color: var(--vp-c-text-mute, #666);
  box-shadow:
    0 2px 8px rgba(0, 0, 0, 0.04),
    0 4px 16px rgba(0, 0, 0, 0.06);
}

/* Card — matches feature card style */
.code-showcase__card {
  border: 1px solid var(--vp-c-border, var(--c-border, #e2e2e3));
  border-radius: 12px;
  box-shadow:
    0 2px 8px rgba(0, 0, 0, 0.04),
    0 4px 16px rgba(0, 0, 0, 0.06);
  overflow: hidden;
}

/* Neutralize global border/shadow on the inner language div */
.code-showcase__card :deep(div[class*='language-']) {
  border: none !important;
  box-shadow: none !important;
  border-radius: 0 !important;
  margin: 0 !important;
}

</style>
