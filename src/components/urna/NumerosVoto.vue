<script setup>
import { computed } from 'vue'

const props = defineProps({
  digitos: { type: [Number, String], default: 2 },
  numero: { type: String, default: '' },
  tipo: { type: String, default: null },
  avisoNulo: { type: Boolean, default: false }
})

const quantidade = computed(() => Math.max(2, Math.min(4, Number(props.digitos) || 2)))
const caixas = computed(() =>
  Array.from({ length: quantidade.value }, (_, indice) => props.numero[indice] || '')
)
const especial = computed(() => {
  if (props.tipo === 'branco') return 'BRANCO'
  if (props.tipo === 'nulo') return 'NULO'
  return ''
})
const legenda = computed(() => {
  if (props.tipo === 'branco') return 'Voto em branco'
  if (props.tipo === 'nulo') return 'Voto nulo'
  if (props.avisoNulo) return 'Número inexistente — confirme novamente para anular'
  return `Digite os ${quantidade.value} dígitos do candidato`
})
</script>

<template>
  <div
    class="numeros-voto"
    :class="{
      'numeros-especial': Boolean(especial),
      'numeros-aviso': avisoNulo
    }"
  >
    <div v-if="especial" class="voto-especial">{{ especial }}</div>
    <div v-else class="numeros-caixas">
      <span
        v-for="(digito, indice) in caixas"
        :key="indice"
        class="numero-caixa"
        :class="{ preenchido: Boolean(digito) }"
      >
        {{ digito }}
      </span>
    </div>
    <span class="numeros-legenda">{{ legenda }}</span>
  </div>
</template>
