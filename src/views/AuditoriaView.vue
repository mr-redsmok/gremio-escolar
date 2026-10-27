<script setup>
import { computed, onMounted, ref } from 'vue'
import { useEleicaoStore } from '@/stores/eleicao.js'
import { useToastStore } from '@/stores/toast.js'
import { service } from '@/lib/service.js'
import { ROTULOS_AUDITORIA } from '@/lib/constants.js'
import { formatarDataHora, formatarNumero } from '@/lib/utils.js'
import { normalizarNome } from '@/lib/normalizar.js'
import PageHeader from '@/components/PageHeader.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import EmptyState from '@/components/EmptyState.vue'
import Icone from '@/components/Icone.vue'

const eleicao = useEleicaoStore()
const toast = useToastStore()

const eventos = ref([])
const busca = ref('')
const carregando = ref(false)
const erro = ref('')

const filtrados = computed(() => {
  const termo = normalizarNome(busca.value)
  if (!termo) return eventos.value
  return eventos.value.filter((evento) => {
    const texto = normalizarNome(
      `${rotulo(evento.acao)} ${JSON.stringify(evento.detalhes || {})} ${
        evento.actor_id || 'sistema'
      }`
    )
    return texto.includes(termo)
  })
})

const ultimoEvento = computed(() => eventos.value[0] || null)

function rotulo(acao) {
  return ROTULOS_AUDITORIA[acao] || acao
}

function detalhesTexto(detalhes) {
  if (!detalhes || !Object.keys(detalhes).length) return '—'
  return JSON.stringify(detalhes)
}

function detalhesCurto(detalhes) {
  const texto = detalhesTexto(detalhes)
  return texto.length > 140 ? `${texto.slice(0, 140)}…` : texto
}

function origem(evento) {
  return evento.actor_id ? 'Administrador' : 'Sistema'
}

async function carregar() {
  if (!service || !eleicao.eleicao) {
    eventos.value = []
    return
  }
  carregando.value = true
  erro.value = ''
  try {
    eventos.value = await service.listarAuditoria(eleicao.eleicao.id)
  } catch (falha) {
    erro.value = falha.message
    eventos.value = []
  } finally {
    carregando.value = false
  }
}

async function atualizar() {
  await carregar()
  toast.info('Auditoria atualizada.')
}

onMounted(async () => {
  await eleicao.carregar()
  await carregar()
})
</script>

<template>
  <div>
    <PageHeader
      titulo="Auditoria"
      subtitulo="Registro das ações administrativas e dos votos, sem identificar o eleitor."
    >
      <StatusBadge v-if="eleicao.eleicao" :status="eleicao.status" />
      <button class="btn btn-ghost" type="button" @click="atualizar">
        <Icone nome="atualizar" :tamanho="17" />
        Atualizar
      </button>
    </PageHeader>

    <div class="alert alert-info">
      <Icone nome="auditoria" :tamanho="18" />
      <div>
        <strong>Trilha de auditoria somente leitura.</strong>
        O evento de voto contém apenas um protocolo aleatório. Não há nome,
        turma, horário individual ou vínculo entre eleitor e candidato.
      </div>
    </div>

    <EmptyState
      v-if="!eleicao.eleicao"
      icone="auditoria"
      titulo="Nenhuma eleição configurada"
      texto="Os eventos aparecerão aqui depois que a eleição for criada."
    />

    <template v-else>
      <div class="votantes-resumo">
        <div class="votantes-resumo-item">
          <span class="votantes-resumo-icone">
            <Icone nome="auditoria" :tamanho="20" />
          </span>
          <div>
            <strong>{{ formatarNumero(eventos.length) }}</strong>
            <small>evento(s) no histórico</small>
          </div>
        </div>
        <div class="votantes-resumo-item">
          <span class="votantes-resumo-icone">
            <Icone nome="relogio" :tamanho="20" />
          </span>
          <div>
            <strong class="votantes-data">
              {{ ultimoEvento ? formatarDataHora(ultimoEvento.criado_em) : '—' }}
            </strong>
            <small>último evento registrado</small>
          </div>
        </div>
        <div class="votantes-resumo-item">
          <span class="votantes-resumo-icone">
            <Icone nome="filtro" :tamanho="20" />
          </span>
          <div>
            <strong>{{ formatarNumero(filtrados.length) }}</strong>
            <small>resultado(s) no filtro atual</small>
          </div>
        </div>
      </div>

      <section class="painel-card">
        <div class="votantes-barra">
          <div class="field field-busca">
            <label for="busca-auditoria">Buscar na auditoria</label>
            <div class="input-com-icone">
              <Icone nome="buscar" :tamanho="17" />
              <input
                id="busca-auditoria"
                v-model="busca"
                type="search"
                placeholder="Ex.: eleição aberta, cargo, protocolo"
                autocomplete="off"
              />
            </div>
          </div>
          <span class="votantes-contador">
            {{ formatarNumero(filtrados.length) }} de
            {{ formatarNumero(eventos.length) }}
          </span>
        </div>

        <div v-if="erro" class="alert alert-erro">{{ erro }}</div>

        <div v-if="carregando" class="painel-card-carregando">
          <span class="spinner"></span>
          Carregando auditoria...
        </div>

        <EmptyState
          v-else-if="!eventos.length"
          icone="auditoria"
          titulo="Nenhum evento registrado"
          texto="As ações da comissão e os votos registrados aparecerão aqui."
        />

        <div v-else-if="!filtrados.length" class="painel-card-vazio">
          Nenhum evento encontrado para <strong>{{ busca }}</strong>.
        </div>

        <div v-else class="tabela-scroll">
          <table class="tabela tabela-auditoria">
            <thead>
              <tr>
                <th>Data e hora</th>
                <th>Ação</th>
                <th>Detalhes</th>
                <th>Origem</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="evento in filtrados" :key="evento.id">
                <td class="auditoria-data">{{ formatarDataHora(evento.criado_em) }}</td>
                <td>
                  <strong>{{ rotulo(evento.acao) }}</strong>
                </td>
                <td>
                  <code
                    class="auditoria-detalhes"
                    :title="detalhesTexto(evento.detalhes)"
                  >
                    {{ detalhesCurto(evento.detalhes) }}
                  </code>
                </td>
                <td>
                  <span class="auditoria-origem" :class="{ sistema: !evento.actor_id }">
                    {{ origem(evento) }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="config-nota">
          <Icone nome="cadeado" :tamanho="16" />
          <span>
            A auditoria é gravada pelo banco de dados e não pode ser editada pelo
            painel. O histórico exibe no máximo os 200 eventos mais recentes.
          </span>
        </div>
      </section>
    </template>
  </div>
</template>
