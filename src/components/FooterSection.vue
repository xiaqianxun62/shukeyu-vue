<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { getFooter } from '../api/settings'

const year = new Date().getFullYear()
/** 后端配置的页脚文案，拉取失败时用默认兜底 */
const footerText = ref('© ' + year + ' ·  千巽')

onMounted(async () => {
  try {
    const data = await getFooter()
    if (data && data.text) footerText.value = data.text.trim()
  } catch {
    /* 拉不动就用默认兜底文案 */
  }
})
</script>

<template>
  <footer class="footer">
    <div class="container">
      <p class="footer-brand">shukeyu </p>
      <p class="footer-copy">{{ footerText }}</p>
    </div>
  </footer>
</template>
