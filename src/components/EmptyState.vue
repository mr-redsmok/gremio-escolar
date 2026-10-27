<script setup>
import Icone from './Icone.vue'

defineProps({
  icone: { type: String, default: 'info' },
  titulo: { type: String, default: 'Nada por aqui' },
  texto: { type: String, default: '' }
})
</script>

<template>
  <div class="empty-state">
    <div class="empty-icon">
      <Icone :nome="icone" :tamanho="28" />
    </div>
    <h3>{{ titulo }}</h3>
    <p v-if="texto">{{ texto }}</p>
    <slot />
  </div>
</template>
