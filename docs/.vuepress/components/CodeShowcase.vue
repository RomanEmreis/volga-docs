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
      <div class="code-showcase__window-dots">
        <span></span><span></span><span></span>
      </div>
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
    // Each tab: { title: string, code: string }
  }
})

const activeTab = ref(0)

// Simple Rust syntax highlighter that produces styled spans
function highlightRust(code) {
  let html = escapeHtml(code)

  // Comments (// ...)
  html = html.replace(/(\/\/.*)/g, '<span class="hl-comment">$1</span>')

  // Strings ("...")
  html = html.replace(/(&quot;(?:[^&]|&(?!quot;))*?&quot;)/g, '<span class="hl-string">$1</span>')

  // Attributes (#[...])
  html = html.replace(/(#\[[\w:,\s()]*\])/g, '<span class="hl-attr">$1</span>')

  // Macros (word!)
  html = html.replace(/\b([a-z_]+!)/g, '<span class="hl-macro">$1</span>')

  // Keywords
  const keywords = ['use','fn','let','mut','async','move','await','struct','match','Some','None','Ok','Err','pub','mod','impl','self','Self','return','if','else','for','in','while','loop','break','continue','where','type','trait','enum','const','static','ref','as','crate','super','extern','unsafe']
  const kwPattern = new RegExp('\\b(' + keywords.join('|') + ')\\b', 'g')
  html = html.replace(kwPattern, (m) => {
    // Don't re-highlight if already inside a span
    return '<span class="hl-keyword">' + m + '</span>'
  })

  // Types (PascalCase words)
  html = html.replace(/\b([A-Z][A-Za-z0-9]*)\b/g, (m) => {
    return '<span class="hl-type">' + m + '</span>'
  })

  // Numbers
  html = html.replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="hl-number">$1</span>')

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
    const lines = highlightRust(tab.code).split('\n')
    return '<pre class="hl-pre"><code>' + lines.join('\n') + '</code></pre>'
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
  border-bottom: none;
  margin-bottom: -1px;
  position: relative;
  z-index: 2;
  padding-left: 8px;
}

.code-showcase__tab {
  padding: 0.6rem 1.25rem;
  border: none;
  background: transparent;
  color: var(--c-text-lighter, #888);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  border-radius: 10px 10px 0 0;
  transition: all 0.25s ease;
  font-family: inherit;
  letter-spacing: 0.01em;
}

.code-showcase__tab:hover {
  color: var(--c-text, #333);
  background: rgba(58, 123, 213, 0.06);
}

.code-showcase__tab.active {
  background: #1e1e2e;
  color: #cdd6f4;
}

/* Card */
.code-showcase__card {
  background: #1e1e2e;
  border-radius: 16px;
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.18),
    0 2px 8px rgba(0, 0, 0, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
  overflow: hidden;
  position: relative;
}

/* Window dots */
.code-showcase__window-dots {
  display: flex;
  gap: 7px;
  padding: 14px 18px 0;
}

.code-showcase__window-dots span {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  display: block;
}

.code-showcase__window-dots span:nth-child(1) {
  background: #f38ba8;
}

.code-showcase__window-dots span:nth-child(2) {
  background: #f9e2af;
}

.code-showcase__window-dots span:nth-child(3) {
  background: #a6e3a1;
}

/* Content */
.code-showcase__content {
  padding: 0.75rem 0;
}

.code-showcase__panel :deep(.hl-pre) {
  margin: 0;
  padding: 0.75rem 1.5rem 1.25rem;
  background: transparent;
  overflow-x: auto;
  font-size: 0.875rem;
  line-height: 1.7;
}

.code-showcase__panel :deep(.hl-pre code) {
  font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace;
  color: #cdd6f4;
  background: none;
  padding: 0;
}

/* Syntax tokens – Catppuccin Mocha inspired */
.code-showcase__panel :deep(.hl-keyword) {
  color: #cba6f7;
  font-weight: 600;
}

.code-showcase__panel :deep(.hl-type) {
  color: #f9e2af;
}

.code-showcase__panel :deep(.hl-string) {
  color: #a6e3a1;
}

.code-showcase__panel :deep(.hl-macro) {
  color: #89b4fa;
  font-weight: 600;
}

.code-showcase__panel :deep(.hl-comment) {
  color: #6c7086;
  font-style: italic;
}

.code-showcase__panel :deep(.hl-number) {
  color: #fab387;
}

.code-showcase__panel :deep(.hl-attr) {
  color: #f38ba8;
}

/* Subtle glow effect */
.code-showcase__card::after {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: 16px;
  padding: 1px;
  background: linear-gradient(135deg, rgba(58, 123, 213, 0.2), rgba(0, 210, 255, 0.1), transparent 60%);
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
}
</style>
