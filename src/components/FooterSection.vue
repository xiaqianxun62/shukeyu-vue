<script setup lang="ts">
const year = new Date().getFullYear()
</script>

<template>
  <footer class="footer">
    <div class="container">
      <p class="footer-brand">数科羽 shukeyu </p>
      <p class="footer-copy">© {{ year }} ·  千巽</p>
      <p class="footer-note">所有数据为演示示意，非真实在线数据</p>
    </div>
  </footer>
</template>
