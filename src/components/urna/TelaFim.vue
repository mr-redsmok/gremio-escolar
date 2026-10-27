<script setup>
import Icone from '@/components/Icone.vue'

defineProps({
  processando: { type: Boolean, default: false },
  erro: { type: String, default: '' },
  protocolo: { type: String, default: '' },
  finalizado: { type: Boolean, default: false }
})
defineEmits(['tentar', 'sair'])
</script>

<template>
  <div class="tela-fim" :class="{ 'tela-fim-erro': Boolean(erro) }">
    <div class="tela-fim-card">
      <template v-if="erro">
        <div class="fim-icone fim-icone-erro">
          <Icone nome="alerta" :tamanho="42" :traco="2" />
        </div>
        <span class="fim-kicker">Atenção</span>
        <h1>Não foi possível registrar</h1>
        <p class="fim-mensagem">{{ erro }}</p>
        <p class="fim-ajuda">
          Se o problema persistir, chame o responsável pela urna. Não saia sem
          confirmar o registro.
        </p>
        <div class="fim-acoes">
          <button class="btn btn-primary btn-grande" type="button" @click="$emit('tentar')">
            <Icone nome="atualizar" :tamanho="18" />
            Tentar novamente
          </button>
          <button class="btn btn-ghost" type="button" @click="$emit('sair')">
            Voltar ao início
          </button>
        </div>
      </template>

      <template v-else>
        <div class="fim-icone" :class="{ 'fim-icone-processando': !finalizado }">
          <Icone v-if="finalizado" nome="check" :tamanho="48" :traco="2.4" />
          <span v-else class="spinner spinner-grande"></span>
        </div>
        <span class="fim-kicker">{{ finalizado ? 'Voto registrado' : 'Registrando' }}</span>
        <h1 class="fim-titulo">FIM</h1>
        <p class="fim-mensagem">
          {{ finalizado ? 'Obrigado por votar!' : 'Aguarde enquanto seu voto é registrado...' }}
        </p>
        <p v-if="protocolo && finalizado" class="fim-protocolo">
          Protocolo de registro: <strong>{{ protocolo }}</strong>
        </p>
        <p v-if="finalizado" class="fim-ajuda">A urna voltará ao início automaticamente.</p>
        <div v-if="finalizado" class="barra-retorno" aria-hidden="true"></div>
      </template>
    </div>
  </div>
</template>
