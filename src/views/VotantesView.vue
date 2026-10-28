<script setup>
import { computed, onMounted, ref } from 'vue'
import { useEleicaoStore } from '@/stores/eleicao.js'
import { useToastStore } from '@/stores/toast.js'
import { service } from '@/lib/service.js'
import { normalizarNome, normalizarTurma } from '@/lib/normalizar.js'
import { formatarDataHora, formatarNumero } from '@/lib/utils.js'
import PageHeader from '@/components/PageHeader.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import EmptyState from '@/components/EmptyState.vue'
import Icone from '@/components/Icone.vue'

const eleicao = useEleicaoStore()
const toast = useToastStore()

const presencas = ref([])
const busca = ref('')
const carregando = ref(false)
const erro = ref('')

const filtradas = computed(() => {
  const termoNome = normalizarNome(busca.value)
  const termoTurma = normalizarTurma(busca.value)
  if (!termoNome && !termoTurma) return presencas.value

  return presencas.value.filter((presenca) => {
    const nome = normalizarNome(presenca.nome_eleitor)
    const turma = normalizarTurma(presenca.turma)
    return (
      (termoNome && nome.includes(termoNome)) ||
      (termoTurma && turma.includes(termoTurma))
    )
  })
})

async function carregar() {
  if (!service || !eleicao.eleicao) {
    presencas.value = []
    return
  }
  carregando.value = true
  erro.value = ''
  try {
    presencas.value = await service.listarPresencas(eleicao.eleicao.id)
  } catch (falha) {
    erro.value = falha.message
    presencas.value = []
  } finally {
    carregando.value = false
  }
}

async function atualizar() {
  await carregar()
  toast.info('Lista de votantes atualizada.')
}

onMounted(async () => {
  await eleicao.carregar()
  await carregar()
})
</script>

<template>
  <div>
    <PageHeader
      titulo="Votantes"
      subtitulo="Consulta interna de comparecimento. Esta lista é somente leitura."
    >
      <StatusBadge v-if="eleicao.eleicao" :status="eleicao.status" />
      <button class="btn btn-ghost" type="button" @click="atualizar">
        <Icone nome="atualizar" :tamanho="17" />
        Atualizar
      </button>
    </PageHeader>

    <div class="alert alert-info votantes-aviso">
      <Icone nome="cadeado" :tamanho="18" />
      <div>
        <strong>Consulta interna, sem vínculo com o voto.</strong>
        O sistema registra apenas nome, turma e horário do comparecimento. Não é
        possível saber em quem cada eleitor votou. Esta lista não é exportada em
        PDF e deve ser acessada apenas pela comissão eleitoral.
      </div>
    </div>

    <EmptyState
      v-if="!eleicao.eleicao"
      icone="usuarios"
      titulo="Nenhuma eleição configurada"
      texto="Crie e abra uma eleição para acompanhar o comparecimento dos votantes."
    />

    <template v-else>
      <div class="votantes-resumo">
        <div class="votantes-resumo-item">
          <span class="votantes-resumo-icone">
            <Icone nome="usuarios" :tamanho="20" />
          </span>
          <div>
            <strong>{{ formatarNumero(presencas.length) }}</strong>
            <small>comparecimento(s) registrado(s)</small>
          </div>
        </div>
        <div class="votantes-resumo-item">
          <span class="votantes-resumo-icone">
            <Icone nome="buscar" :tamanho="20" />
          </span>
          <div>
            <strong>{{ formatarNumero(filtradas.length) }}</strong>
            <small>resultado(s) no filtro atual</small>
          </div>
        </div>
        <div class="votantes-resumo-item">
          <span class="votantes-resumo-icone">
            <Icone nome="relogio" :tamanho="20" />
          </span>
          <div>
            <strong>{{ eleicao.eleicao.tempo_inatividade_segundos }}s</strong>
            <small>limite de inatividade por sessão</small>
          </div>
        </div>
      </div>

      <section class="painel-card votantes-card">
        <div class="votantes-barra">
          <div class="field field-busca">
            <label for="busca-votante">Buscar por nome ou turma</label>
            <div class="input-com-icone">
              <Icone nome="buscar" :tamanho="17" />
              <input
                id="busca-votante"
                v-model="busca"
                type="search"
                placeholder="Ex.: Maria ou 9º A"
                autocomplete="off"
              />
            </div>
          </div>
          <span class="votantes-contador">
            {{ formatarNumero(filtradas.length) }} de
            {{ formatarNumero(presencas.length) }}
          </span>
        </div>

        <div v-if="erro" class="alert alert-erro">{{ erro }}</div>

        <div v-if="carregando" class="painel-card-carregando">
          <span class="spinner"></span>
          Carregando votantes...
        </div>

        <EmptyState
          v-else-if="!presencas.length"
          icone="usuarios"
          titulo="Nenhum comparecimento registrado"
          :texto="
            eleicao.status === 'rascunho'
              ? 'A votação ainda não foi aberta.'
              : 'A lista será preenchida conforme os eleitores concluírem o voto.'
          "
        />

        <div v-else-if="!filtradas.length" class="painel-card-vazio">
          Nenhum votante encontrado para <strong>{{ busca }}</strong>.
        </div>

        <div v-else class="tabela-scroll">
          <table class="tabela">
            <thead>
              <tr>
                <th class="num">#</th>
                <th>Nome</th>
                <th>Turma</th>
                <th>Comparecimento</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(presenca, indice) in filtradas" :key="presenca.id">
                <td class="num tabela-mudo">{{ indice + 1 }}</td>
                <td><strong>{{ presenca.nome_eleitor }}</strong></td>
                <td>{{ presenca.turma || '—' }}</td>
                <td>{{ formatarDataHora(presenca.votou_em) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="config-nota votantes-nota">
          <Icone nome="info" :tamanho="16" />
          <span>
            Esta consulta é apenas para conferência de comparecimento e solução
            de dúvidas. Não há ação de edição ou exclusão.
          </span>
        </div>
      </section>
    </template>
  </div>
</template>
