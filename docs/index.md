---
home: false
title: Redirecting...
---

<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

onMounted(() => {
  router.replace('/en/')
})
</script>

# Redirecting to English docs...

If you are not redirected automatically, open [English docs](/en/).
