<script setup lang="ts">
import SvgIcon from './SvgIcon.vue'
import { PLATFORMS } from '../data/mock'
</script>

<template>
  <section id="platforms" class="section">
    <div class="container">
      <div class="section-header">
        <h2 class="section-title">三端覆盖</h2>
        <p class="section-desc">小程序 · PC 官网 · APP，随时随地开启球局</p>
      </div> 
      <div class="platforms-grid">
        <div v-for="item in PLATFORMS" :key="item.name" class="platform-card">
          <div class="platform-icon">
            <SvgIcon :type="item.iconType" :size="26" />
          </div>
          <h3 class="platform-name">{{ item.name }}</h3>
          <p class="platform-desc">{{ item.desc }}</p>
        </div>
      </div>
      <p class="platforms-note">报名信息多端同步，官网报名后由机器人自动同步进群</p>
    </div>
  </section>
</template>
