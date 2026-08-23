<script setup>
import { withBase } from 'vuepress/client'

defineProps({
  href: { type: String, required: true },
  label: { type: String, required: true },
  note: { type: String, default: '' },
})
</script>

<template>
  <div class="skill-download">
    <a :href="withBase(href)" download class="skill-download-button">
      <svg
        class="skill-download-icon"
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      <span>{{ label }}</span>
    </a>
    <span v-if="note" class="skill-download-note">{{ note }}</span>
  </div>
</template>

<style scoped lang="scss">
.skill-download {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem 1rem;
  margin: 1.75rem 0 2rem;
}

.skill-download-button {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.7rem 1.4rem;
  border-radius: 8px;
  font-weight: 600;
  font-size: 1rem;
  line-height: 1.2;
  text-decoration: none !important;
  color: #fff !important;
  background: var(--vp-c-accent, #299764);
  border: 1px solid var(--vp-c-accent, #299764);
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(62, 175, 124, 0.35);
  }
}

.skill-download-icon {
  flex: none;
}

.skill-download-note {
  font-size: 0.9rem;
  color: var(--vp-c-text-mute, #8e8e8e);
}
</style>
