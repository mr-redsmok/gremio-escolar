<script setup>
import { computed } from 'vue'
import { STATUS_ELEICAO } from '@/lib/constants.js'

const props = defineProps({
  status: { type: String, default: '' }
})

const info = computed(
  () =>
    STATUS_ELEICAO[props.status] || {
      label: props.status || '—',
      classe: ''
    }
)
</script>

<template>
  <span class="badge" :class="info.classe">{{ info.label }}</span>
</template>
