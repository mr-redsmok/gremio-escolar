<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.js'
import { useToastStore } from '@/stores/toast.js'
import { DEMO_ADMIN } from '@/lib/constants.js'
import Icone from '@/components/Icone.vue'

const auth = useAuthStore()
const toast = useToastStore()
const route = useRoute()
const router = useRouter()

const email = ref('')
const senha = ref('')
const mostrarSenha = ref(false)
const enviando = ref(false)
const erro = ref('')

const destino = computed(() => {
  const redirect = route.query.redirect
  if (typeof redirect === 'string' && redirect.startsWith('/admin')) {
    return redirect
  }
  return '/admin/painel'
})

function preencherDemo() {
  email.value = DEMO_ADMIN.email
  senha.value = DEMO_ADMIN.senha
  erro.value = ''
}

async function entrar() {
  if (enviando.value) return
  erro.value = ''

  if (!email.value.trim() || !senha.value) {
    erro.value = 'Informe e-mail e senha.'
    return
  }

  enviando.value = true
  try {
    await auth.login(email.value, senha.value)
    toast.sucesso('Acesso liberado.')
    router.replace(destino.value)
  } catch (falha) {
    erro.value = falha.message
  } finally {
    enviando.value = false
  }
}

onMounted(() => {
  if (auth.isAdmin) {
    router.replace(destino.value)
  } else if (auth.semPermissao) {
    erro.value = 'Sua conta não tem permissão de administrador.'
  }
})
</script>

<template>
  <div class="login-page">
    <div class="login-brilho login-brilho-1"></div>
    <div class="login-brilho login-brilho-2"></div>

    <div class="login-card">
      <div class="login-marca">
        <span class="login-marca-icone">
          <Icone nome="urna" :tamanho="26" :traco="1.7" />
        </span>
        <span>
          <strong>Urna Escolar</strong>
          <small>Painel administrativo</small>
        </span>
      </div>

      <h1>Acesso restrito</h1>
      <p class="login-subtitulo">
        Entre com a conta da comissão eleitoral para configurar a urna e gerar
        os relatórios.
      </p>

      <div v-if="auth.semPermissao" class="alert alert-erro">
        Sua conta não tem permissão de administrador. Peça à pessoa responsável
        para incluir seu usuário na tabela <code>urna_admins</code>.
      </div>

      <form class="login-form" @submit.prevent="entrar">
        <div class="field">
          <label for="login-email">E-mail</label>
          <input
            id="login-email"
            v-model="email"
            type="email"
            autocomplete="username"
            placeholder="admin@escola.com"
          />
        </div>

        <div class="field">
          <label for="login-senha">Senha</label>
          <div class="input-com-acao">
            <input
              id="login-senha"
              v-model="senha"
              :type="mostrarSenha ? 'text' : 'password'"
              autocomplete="current-password"
              placeholder="••••••••"
            />
            <button
              type="button"
              class="input-acao"
              :aria-label="mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'"
              @click="mostrarSenha = !mostrarSenha"
            >
              <Icone nome="olho" :tamanho="18" />
            </button>
          </div>
        </div>

        <div v-if="erro" class="alert alert-erro" role="alert">{{ erro }}</div>

        <button class="btn btn-primary btn-bloco btn-grande" type="submit" :disabled="enviando">
          <span v-if="enviando" class="spinner spinner-pequeno"></span>
          <span>{{ enviando ? 'Entrando...' : 'Entrar no painel' }}</span>
          <Icone v-if="!enviando" nome="seta-direita" :tamanho="18" />
        </button>
      </form>

      <div v-if="auth.demo" class="login-demo">
        <div class="login-demo-titulo">
          <Icone nome="info" :tamanho="16" />
          Modo demonstração
        </div>
        <p>
          Use <code>{{ DEMO_ADMIN.email }}</code> e a senha
          <code>{{ DEMO_ADMIN.senha }}</code>.
        </p>
        <button class="btn btn-ghost btn-pequeno" type="button" @click="preencherDemo">
          Preencher credenciais
        </button>
      </div>

      <div class="login-rodape">
        <router-link to="/">
          <Icone nome="voltar" :tamanho="15" />
          Voltar para a urna
        </router-link>
        <span>Voto secreto · Urna Escolar</span>
      </div>
    </div>
  </div>
</template>
