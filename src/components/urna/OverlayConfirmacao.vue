<script setup>
import { computed } from 'vue'
import Icone from '@/components/Icone.vue'

const props = defineProps({
  aberto: { type: Boolean, default: false },
  voto: { type: Object, default: null }
})

const titulo = computed(() => {
  if (props.voto?.tipo === 'branco') return 'VOTO EM BRANCO'
  if (props.voto?.tipo === 'nulo') return 'VOTO NULO'
  return 'VOTO CONFIRMADO'
})

const nome = computed(
  () => props.voto?.candidato?.nome_urna || props.voto?.candidato?.nome || ''
)
</script>

<template>
  <Teleport to="body">
    <Transition name="overlay">
      <div
        v-if="aberto"
        class="overlay-confirmacao"
        role="status"
        aria-live="assertive"
      >
        <div class="overlay-card">
          <div class="overlay-check">
            <Icone nome="check" :tamanho="44" :traco="2.6" />
          </div>
          <span class="overlay-kicker">{{ titulo }}</span>
          <h2 v-if="nome">{{ nome }}</h2>
          <p v-if="voto?.cargo">Cargo: {{ voto.cargo.nome }}</p>
          <small>Aguarde...</small>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
