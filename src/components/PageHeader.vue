<script setup>
defineProps({
  titulo: { type: String, default: '' },
  subtitulo: { type: String, default: '' }
})
</script>

<template>
  <div class="page-header">
    <div>
      <h1>{{ titulo }}</h1>
      <p v-if="subtitulo">{{ subtitulo }}</p>
    </div>
    <div v-if="$slots.default" class="page-header-actions">
      <slot />
    </div>
  </div>
</template>
