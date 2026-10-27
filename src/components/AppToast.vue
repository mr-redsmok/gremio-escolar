<script setup>
import { useToastStore } from '@/stores/toast.js'
import Icone from './Icone.vue'

const toast = useToastStore()

function icone(tipo) {
  if (tipo === 'sucesso') return 'check'
  if (tipo === 'erro') return 'alerta'
  return 'info'
}
</script>

<template>
  <div class="toast-stack" aria-live="polite" aria-atomic="false">
    <TransitionGroup name="toast">
      <div
        v-for="item in toast.itens"
        :key="item.id"
        class="toast"
        :class="item.tipo ? `toast-${item.tipo}` : 'toast-info'"
        role="status"
      >
        <Icone :nome="icone(item.tipo)" :tamanho="18" />
        <span>{{ item.mensagem }}</span>
        <button
          type="button"
          class="toast-close"
          aria-label="Fechar aviso"
          @click="toast.remove(item.id)"
        >
          <Icone nome="fechar" :tamanho="14" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>
