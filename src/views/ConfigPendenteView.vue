<script setup>
import Icone from '@/components/Icone.vue'

function recarregar() {
  window.location.reload()
}
</script>

<template>
  <div class="setup-page">
    <div class="setup-card">
      <div class="setup-marca">
        <span class="setup-marca-icone">
          <Icone nome="urna" :tamanho="28" :traco="1.7" />
        </span>
        <span>
          <strong>Urna Escolar</strong>
          <small>Votação do grêmio estudantil</small>
        </span>
      </div>

      <h1>Configuração pendente</h1>
      <p class="setup-texto">
        O aplicativo ainda não está conectado a um banco de dados. Preencha as
        variáveis do Supabase no arquivo <code>.env</code> (ou nas variáveis de
        ambiente da Vercel) e recarregue a página.
      </p>

      <div class="setup-codigo">
        <span># .env</span>
        <code>VITE_SUPABASE_URL=https://seu-projeto.supabase.co</code>
        <code>VITE_SUPABASE_ANON_KEY=sua-chave-anon</code>
        <code>VITE_DEMO=false</code>
      </div>

      <div class="alert alert-info">
        Use somente a chave <strong>anon</strong> no frontend. Nunca coloque a
        chave <strong>service_role</strong> aqui.
      </div>

      <p class="setup-texto">
        Para testar sem banco de dados, defina <code>VITE_DEMO=true</code> no
        <code>.env</code>. O modo demonstração grava os dados apenas neste
        navegador.
      </p>

      <div class="setup-acoes">
        <button class="btn btn-primary" type="button" @click="recarregar">
          <Icone nome="atualizar" :tamanho="17" />
          Recarregar página
        </button>
      </div>

      <p class="setup-rodape">
        Siga o <code>README.md</code> e execute os arquivos SQL na ordem
        <code>001</code> a <code>005</code>.
      </p>
    </div>
  </div>
</template>
