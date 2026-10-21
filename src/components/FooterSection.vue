<script setup lang="ts">
const year = new Date().getFullYear()
</script>

<template>
  <footer class="footer">
    <div class="container">
      <p class="footer-brand">shukeyu </p>
      <p class="footer-copy">© {{ year }} ·  千巽</p>
      <!--<p class="footer-note"></p>-->
    </div>
  </footer>
</template>
