<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useConfirmStore } from '@/stores/confirm.js'
import Icone from './Icone.vue'

const confirm = useConfirmStore()
const botao = ref(null)

function onKey(event) {
  if (event.key === 'Escape' && confirm.aberto) {
    confirm.responder(false)
  }
}

watch(
  () => confirm.aberto,
  async (aberto) => {
    document.body.style.overflow = aberto ? 'hidden' : ''
    if (aberto) {
      await nextTick()
      botao.value?.focus()
    }
  }
)

onMounted(() => document.addEventListener('keydown', onKey))
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKey)
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="confirm.aberto"
        class="modal-backdrop"
        @click.self="confirm.responder(false)"
      >
        <div class="modal modal-confirm" role="alertdialog" aria-modal="true">
          <div class="confirm-icone" :class="{ perigo: confirm.perigo }">
            <Icone :nome="confirm.perigo ? 'alerta' : 'info'" :tamanho="24" />
          </div>
          <h2>{{ confirm.titulo }}</h2>
          <p>{{ confirm.texto }}</p>
          <div class="confirm-acoes">
            <button class="btn btn-ghost" type="button" @click="confirm.responder(false)">
              {{ confirm.cancelLabel }}
            </button>
            <button
              ref="botao"
              class="btn"
              :class="confirm.perigo ? 'btn-danger' : 'btn-primary'"
              type="button"
              @click="confirm.responder(true)"
            >
              {{ confirm.confirmLabel }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
