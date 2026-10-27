<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUrnaStore } from '@/stores/urna.js'
import { useAuthStore } from '@/stores/auth.js'
import { DEMO_BANNER } from '@/lib/constants.js'
import { isDemo } from '@/lib/service.js'
import { formatarHora } from '@/lib/utils.js'
import Icone from '@/components/Icone.vue'

const urn = useUrnaStore()
const auth = useAuthStore()
const router = useRouter()

const agora = ref(new Date())
const online = ref(typeof navigator === 'undefined' ? true : navigator.onLine)
const toques = ref(0)
const ultimoToque = ref(0)
let relogioTimer = null

const escolaNome = computed(() => urn.eleicao?.escola_nome || 'Urna Escolar')
const eleicaoNome = computed(
  () => urn.eleicao?.nome || 'Eleição do Grêmio Estudantil'
)
const hora = computed(() => formatarHora(agora.value))
const ano = new Date().getFullYear()

function abrirAdmin() {
  if (auth.isAdmin) {
    router.push({ name: 'admin-painel' })
  } else {
    router.push({ name: 'admin-login' })
  }
}

function toqueMarca() {
  const instante = Date.now()
  if (instante - ultimoToque.value > 3000) {
    toques.value = 1
  } else {
    toques.value += 1
  }
  ultimoToque.value = instante

  if (toques.value >= 5) {
    toques.value = 0
    ultimoToque.value = 0
    abrirAdmin()
  }
}

function atalhoAdmin(event) {
  if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'a') {
    event.preventDefault()
    abrirAdmin()
  }
}

function atualizarConexao() {
  online.value = navigator.onLine
}

onMounted(() => {
  urn.carregar()
  relogioTimer = window.setInterval(() => {
    agora.value = new Date()
  }, 1000)
  window.addEventListener('keydown', atalhoAdmin)
  window.addEventListener('online', atualizarConexao)
  window.addEventListener('offline', atualizarConexao)
})

onUnmounted(() => {
  if (relogioTimer) window.clearInterval(relogioTimer)
  window.removeEventListener('keydown', atalhoAdmin)
  window.removeEventListener('online', atualizarConexao)
  window.removeEventListener('offline', atualizarConexao)
})
</script>

<template>
  <div class="urna-shell">
    <div v-if="isDemo" class="demo-banner">
      <span class="demo-banner-ponto"></span>
      <span>{{ DEMO_BANNER }}</span>
      <span class="demo-banner-extra">Acesso admin: 5 toques no título ou Ctrl+Shift+A</span>
    </div>

    <header class="urna-topo">
      <button
        class="urna-marca"
        type="button"
        aria-label="Urna Escolar"
        @click="toqueMarca"
      >
        <span class="urna-marca-icone">
          <Icone nome="urna" :tamanho="26" :traco="1.7" />
        </span>
        <span class="urna-marca-texto">
          <strong>URNA ESCOLAR</strong>
          <small>Votação do grêmio estudantil</small>
        </span>
      </button>

      <div class="urna-identidade">
        <strong>{{ escolaNome }}</strong>
        <span>{{ eleicaoNome }}</span>
      </div>

      <div class="urna-conexao">
        <span class="status-conexao" :class="{ online }">
          <span class="status-ponto"></span>
          {{ online ? 'Conectado' : 'Sem conexão' }}
        </span>
        <span class="urna-relogio">
          <Icone nome="relogio" :tamanho="16" />
          {{ hora }}
        </span>
      </div>
    </header>

    <main class="urna-conteudo">
      <router-view />
    </main>

    <footer class="urna-rodape">
      <span>Voto secreto · Sistema de urna escolar</span>
      <span>{{ ano }}</span>
    </footer>
  </div>
</template>
