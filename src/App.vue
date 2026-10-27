<script setup>
import { isConfigured } from '@/lib/service.js'
import AppToast from '@/components/AppToast.vue'
import ConfirmHost from '@/components/ConfirmHost.vue'
import ConfigPendenteView from '@/views/ConfigPendenteView.vue'
</script>

<template>
  <ConfigPendenteView v-if="!isConfigured" />
  <router-view v-else />
  <AppToast />
  <ConfirmHost />
</template>
