<script setup>
const props = defineProps({
  desabilitado: { type: Boolean, default: false },
  permiteBranco: { type: Boolean, default: true }
})
const emit = defineEmits(['digito', 'branco', 'corrige', 'confirma'])

function digitar(valor) {
  if (props.desabilitado) return
  emit('digito', String(valor))
}
</script>

<template>
  <div class="teclado-urna" :class="{ 'teclado-desabilitado': desabilitado }">
    <div class="teclado-grid">
      <button
        v-for="numero in 9"
        :key="numero"
        type="button"
        class="tecla tecla-numero"
        :disabled="desabilitado"
        @click="digitar(numero)"
      >
        {{ numero }}
      </button>
      <span class="teclado-vazio" aria-hidden="true"></span>
      <button
        type="button"
        class="tecla tecla-numero"
        :disabled="desabilitado"
        @click="digitar(0)"
      >
        0
      </button>
      <span class="teclado-vazio" aria-hidden="true"></span>
    </div>

    <div class="teclado-acoes">
      <button
        type="button"
        class="tecla tecla-branco"
        :disabled="desabilitado || !permiteBranco"
        :title="permiteBranco ? 'Votar em branco' : 'Este cargo não permite voto em branco'"
        @click="emit('branco')"
      >
        BRANCO
      </button>
      <button
        type="button"
        class="tecla tecla-corrige"
        :disabled="desabilitado"
        @click="emit('corrige')"
      >
        CORRIGE
      </button>
      <button
        type="button"
        class="tecla tecla-confirma"
        :disabled="desabilitado"
        @click="emit('confirma')"
      >
        CONFIRMA
      </button>
    </div>

    <p class="teclado-dica">
      Teclado físico: números · Enter confirma · B branco · C corrige
    </p>
  </div>
</template>
