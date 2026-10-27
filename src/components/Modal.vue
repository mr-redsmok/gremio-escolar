<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Icone from './Icone.vue'

const props = defineProps({
  aberto: { type: Boolean, default: false },
  titulo: { type: String, default: '' },
  largo: { type: Boolean, default: false }
})
const emit = defineEmits(['fechar'])
const painel = ref(null)

function onKey(event) {
  if (event.key === 'Escape' && props.aberto) emit('fechar')
}

watch(
  () => props.aberto,
  async (aberto) => {
    document.body.style.overflow = aberto ? 'hidden' : ''
    if (aberto) {
      await nextTick()
      painel.value?.focus()
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
      <div v-if="aberto" class="modal-backdrop" @click.self="emit('fechar')">
        <div
          ref="painel"
          class="modal"
          :class="{ 'modal-largo': largo }"
          role="dialog"
          aria-modal="true"
          :aria-label="titulo"
          tabindex="-1"
        >
          <header class="modal-header">
            <h2>{{ titulo }}</h2>
            <button
              class="btn-icon"
              type="button"
              aria-label="Fechar"
              @click="emit('fechar')"
            >
              <Icone nome="fechar" :tamanho="18" />
            </button>
          </header>
          <div class="modal-body">
            <slot />
          </div>
          <footer v-if="$slots.footer" class="modal-footer">
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
