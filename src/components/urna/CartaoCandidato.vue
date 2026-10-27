<script setup>
import { computed } from 'vue'
import Icone from '@/components/Icone.vue'
import { iniciais } from '@/lib/utils.js'

const props = defineProps({
  cargo: { type: Object, default: null },
  numero: { type: String, default: '' },
  candidato: { type: Object, default: null },
  tipo: { type: String, default: null },
  avisoNulo: { type: Boolean, default: false }
})

const digitos = computed(() => Number(props.cargo?.digitos) || 2)
const completo = computed(() => props.numero.length === digitos.value)
const modo = computed(() => {
  if (props.tipo === 'branco') return 'branco'
  if (props.tipo === 'nulo') return 'nulo'
  if (props.candidato) return 'candidato'
  if (completo.value) return 'inexistente'
  return 'vazio'
})
const nome = computed(
  () => props.candidato?.nome_urna || props.candidato?.nome || ''
)
const nomeCompleto = computed(() => props.candidato?.nome || '')
</script>

<template>
  <div class="cartao-candidato" :class="`cartao-${modo}`">
    <template v-if="modo === 'candidato'">
      <div class="candidato-topo">
        <div class="candidato-avatar">{{ iniciais(nome) }}</div>
        <div class="candidato-numero">{{ candidato.numero }}</div>
        <span v-if="candidato.chapa" class="candidato-chapa">{{ candidato.chapa }}</span>
      </div>
      <div class="candidato-dados">
        <span class="candidato-rotulo">Candidato(a)</span>
        <h3>{{ nome }}</h3>
        <p v-if="nomeCompleto && nomeCompleto !== nome" class="candidato-nome-completo">
          {{ nomeCompleto }}
        </p>
        <dl class="candidato-detalhes">
          <div v-if="candidato.chapa">
            <dt>Chapa</dt>
            <dd>{{ candidato.chapa }}</dd>
          </div>
          <div v-if="candidato.vice">
            <dt>Vice</dt>
            <dd>{{ candidato.vice }}</dd>
          </div>
        </dl>
        <p v-if="candidato.proposta" class="candidato-proposta">
          {{ candidato.proposta }}
        </p>
      </div>
    </template>

    <template v-else-if="modo === 'branco'">
      <div class="cartao-vazio-icone">
        <Icone nome="check" :tamanho="36" :traco="2.2" />
      </div>
      <span class="candidato-rotulo">Voto em branco</span>
      <h3>BRANCO</h3>
      <p>
        Você está votando em branco para <strong>{{ cargo?.nome }}</strong>.
        Pressione <strong>CONFIRMA</strong> para confirmar ou <strong>CORRIGE</strong>
        para digitar um número.
      </p>
    </template>

    <template v-else-if="modo === 'nulo'">
      <div class="cartao-vazio-icone cartao-icone-nulo">
        <Icone nome="alerta" :tamanho="36" :traco="2" />
      </div>
      <span class="candidato-rotulo">Voto nulo</span>
      <h3>NULO</h3>
      <p>
        Seu voto para <strong>{{ cargo?.nome }}</strong> será registrado como
        nulo. Pressione <strong>CONFIRMA</strong> para confirmar.
      </p>
    </template>

    <template v-else-if="modo === 'inexistente'">
      <div class="cartao-vazio-icone cartao-icone-nulo">
        <Icone nome="alerta" :tamanho="36" :traco="2" />
      </div>
      <span class="candidato-rotulo">Número não encontrado</span>
      <h3>NÚMERO INEXISTENTE</h3>
      <p>
        Não há candidato com o número <strong>{{ numero }}</strong> para
        <strong>{{ cargo?.nome }}</strong>. Pressione <strong>CONFIRMA</strong>
        novamente para votar nulo ou <strong>CORRIGE</strong> para digitar outro
        número.
      </p>
    </template>

    <template v-else>
      <div class="cartao-vazio-icone">
        <Icone nome="urna" :tamanho="38" :traco="1.6" />
      </div>
      <span class="candidato-rotulo">Aguardando o número</span>
      <h3>{{ cargo?.nome || 'Cargo' }}</h3>
      <p>
        Digite o número do candidato no teclado ao lado. Para votar em branco,
        pressione <strong>BRANCO</strong>.
      </p>
    </template>
  </div>
</template>
