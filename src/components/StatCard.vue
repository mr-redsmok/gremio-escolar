<script setup>
import Icone from './Icone.vue'

defineProps({
  rotulo: { type: String, default: '' },
  valor: { type: [String, Number], default: '0' },
  detalhe: { type: String, default: '' },
  icone: { type: String, default: 'painel' },
  tom: { type: String, default: 'azul' }
})
</script>

<template>
  <div class="stat-card" :class="`stat-${tom}`">
    <div class="stat-icon">
      <Icone :nome="icone" :tamanho="20" />
    </div>
    <div class="stat-corpo">
      <span class="stat-label">{{ rotulo }}</span>
      <strong class="stat-value">{{ valor }}</strong>
      <small v-if="detalhe" class="stat-detalhe">{{ detalhe }}</small>
    </div>
  </div>
</template>
