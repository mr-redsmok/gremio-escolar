<script setup>
import { computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.js'
import { useEleicaoStore } from '@/stores/eleicao.js'
import { DEMO_BANNER } from '@/lib/constants.js'
import { isDemo } from '@/lib/service.js'
import Icone from '@/components/Icone.vue'
import StatusBadge from '@/components/StatusBadge.vue'

const auth = useAuthStore()
const eleicao = useEleicaoStore()
const route = useRoute()
const router = useRouter()

const menu = [
  { name: 'admin-painel', label: 'Painel', icone: 'painel' },
  { name: 'admin-configuracoes', label: 'Configurações', icone: 'config' },
  { name: 'admin-votantes', label: 'Votantes', icone: 'usuarios' },
  { name: 'admin-relatorios', label: 'Relatórios', icone: 'relatorio' },
  { name: 'admin-auditoria', label: 'Auditoria', icone: 'auditoria' }
]

const tituloPagina = computed(
  () =>
    route.meta.titulo ||
    menu.find((item) => item.name === route.name)?.label ||
    'Painel'
)


async function sair() {
  await auth.logout()
  router.replace({ name: 'admin-login' })
}

onMounted(() => {
  eleicao.carregar()
})

watch(
  () => auth.isAdmin,
  (admin) => {
    if (!admin && auth.inicializado) {
      router.replace({ name: 'admin-login' })
    }
  }
)
</script>

<template>
  <div class="admin-shell">
    <aside class="admin-sidebar">
      <div class="admin-marca">
        <span class="admin-marca-icone">
          <Icone nome="urna" :tamanho="24" :traco="1.7" />
        </span>
        <span>
          <strong>Urna Escolar</strong>
          <small>Painel administrativo</small>
        </span>
      </div>

      <div v-if="eleicao.eleicao" class="admin-eleicao-card">
        <StatusBadge :status="eleicao.status" />
        <strong>{{ eleicao.eleicao.nome }}</strong>
        <small>{{ eleicao.eleicao.escola_nome }}</small>
      </div>

      <nav class="admin-nav" aria-label="Menu administrativo">
        <router-link
          v-for="item in menu"
          :key="item.name"
          :to="{ name: item.name }"
          class="admin-nav-item"
          active-class="admin-nav-item-ativo"
        >
          <Icone :nome="item.icone" :tamanho="19" />
          <span>{{ item.label }}</span>
        </router-link>
      </nav>

      <div class="admin-sidebar-rodape">
        <router-link to="/" class="admin-voltar">
          <Icone nome="voltar" :tamanho="16" />
          Voltar para a urna
        </router-link>
        <button class="admin-sair" type="button" @click="sair">
          <Icone nome="sair" :tamanho="16" />
          Sair
        </button>
      </div>
    </aside>

    <div class="admin-principal">
      <header class="admin-topo">
        <div class="admin-topo-titulo">
          <span>{{ tituloPagina }}</span>
          <small v-if="eleicao.eleicao">{{ eleicao.eleicao.nome }}</small>
        </div>
        <div class="admin-topo-acoes">
          <StatusBadge v-if="eleicao.eleicao" :status="eleicao.status" />
          <span class="admin-usuario">{{ auth.nome }}</span>
          <button class="btn btn-ghost btn-pequeno admin-topo-sair" type="button" @click="sair">
            Sair
          </button>
        </div>
      </header>

      <main class="admin-conteudo">
        <div v-if="isDemo" class="demo-banner demo-banner-admin">
          <span class="demo-banner-ponto"></span>
          <span>{{ DEMO_BANNER }}</span>
        </div>
        <router-view />
      </main>
    </div>
  </div>
</template>
