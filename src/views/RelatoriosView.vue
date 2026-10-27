<script setup>
import { computed, onMounted, ref } from 'vue'
import { useEleicaoStore } from '@/stores/eleicao.js'
import { useRelatoriosStore } from '@/stores/relatorios.js'
import { useToastStore } from '@/stores/toast.js'
import { service } from '@/lib/service.js'
import { TIPOS_RELATORIO } from '@/lib/constants.js'
import { formatarDataHora, formatarNumero } from '@/lib/utils.js'
import PageHeader from '@/components/PageHeader.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import EmptyState from '@/components/EmptyState.vue'
import Icone from '@/components/Icone.vue'

const eleicao = useEleicaoStore()
const relatorios = useRelatoriosStore()
const toast = useToastStore()

const cargoSelecionado = ref('todos')
const parcial = ref(false)
const gerandoTipo = ref('')
const resumo = ref(null)
const carregandoResumo = ref(false)

const status = computed(() => eleicao.status)
const cargos = computed(() => eleicao.cargos)
const totalVotantes = computed(() => resumo.value?.total_votantes ?? 0)
const zeresimaDisponivel = computed(
  () =>
    ['rascunho', 'aberta'].includes(status.value) &&
    totalVotantes.value === 0 &&
    !carregandoResumo.value
)
const boletimDisponivel = computed(() =>
  ['aberta', 'encerrada'].includes(status.value)
)
const ataDisponivel = computed(() => status.value === 'encerrada')
const historico = computed(() => relatorios.lista)

function tipoLabel(tipo) {
  return TIPOS_RELATORIO[tipo] || tipo
}

function nomeCargo(cargoId) {
  return eleicao.cargos.find((c) => c.id === cargoId)?.nome || '—'
}

function hashCurto(hash) {
  if (!hash) return '—'
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`
}

async function carregarResumo() {
  if (!service || !eleicao.eleicao) return
  carregandoResumo.value = true
  try {
    resumo.value = await service.apurar(eleicao.eleicao.id, true)
  } catch {
    resumo.value = null
  } finally {
    carregandoResumo.value = false
  }
}

async function carregarTudo() {
  await eleicao.carregar()
  if (eleicao.eleicao) {
    await Promise.all([
      relatorios.carregar(eleicao.eleicao.id),
      carregarResumo()
    ])
  }
}

async function gerar(tipo) {
  if (!eleicao.eleicao || gerandoTipo.value) return
  if (tipo === 'zeresima' && !zeresimaDisponivel.value) return
  if (tipo === 'boletim_cargo' && !boletimDisponivel.value) return
  if (tipo === 'ata_encerramento' && !ataDisponivel.value) return

  gerandoTipo.value = tipo
  try {
    const cargoId =
      tipo === 'boletim_cargo' && cargoSelecionado.value !== 'todos'
        ? cargoSelecionado.value
        : null
    const parcialRelatorio =
      tipo === 'boletim_cargo' && status.value === 'aberta' ? parcial.value : false

    await relatorios.gerar({
      eleicaoId: eleicao.eleicao.id,
      tipo,
      cargoId,
      parcial: parcialRelatorio
    })

    toast.sucesso(`${tipoLabel(tipo)} gerado e baixado.`)
    await carregarResumo()
  } catch (erro) {
    toast.erro(erro.message)
  } finally {
    gerandoTipo.value = ''
  }
}

async function baixar(relatorio) {
  try {
    await relatorios.baixar(relatorio, {
      eleicao: eleicao.eleicao,
      cargos: eleicao.cargos
    })
  } catch (erro) {
    toast.erro(erro.message)
  }
}

onMounted(carregarTudo)
</script>

<template>
  <div>
    <PageHeader
      titulo="Relatórios"
      subtitulo="Gere a zerésima, os boletins e a ata de encerramento em PDF."
    >
      <StatusBadge v-if="eleicao.eleicao" :status="status" />
      <button class="btn btn-ghost" type="button" @click="carregarTudo">
        <Icone nome="atualizar" :tamanho="17" />
        Atualizar
      </button>
    </PageHeader>

    <EmptyState
      v-if="!eleicao.eleicao"
      icone="relatorio"
      titulo="Nenhuma eleição configurada"
      texto="Crie e configure a eleição para gerar os documentos oficiais."
    />

    <template v-else>
      <div class="alert alert-info">
        <Icone nome="cadeado" :tamanho="18" />
        <div>
          Os PDFs são gerados no navegador e armazenados em bucket privado no
          Supabase. O download usa link assinado e temporário. No modo
          demonstração, os arquivos ficam apenas neste navegador.
        </div>
      </div>

      <div class="relatorios-grid">
        <section class="relatorio-card">
          <div class="relatorio-card-topo">
            <span class="relatorio-card-icone">
              <Icone nome="documento" :tamanho="24" />
            </span>
            <div>
              <h2>Zerésima</h2>
              <p>Comprova que a urna começou sem votos.</p>
            </div>
          </div>
          <div class="relatorio-card-corpo">
            <p>
              Lista todos os cargos e candidatos com zero votos. Deve ser gerada
              antes do primeiro voto e assinada pela comissão.
            </p>
            <div class="relatorio-card-meta">
              <span>
                <Icone nome="urna" :tamanho="15" />
                Votos registrados: {{ formatarNumero(totalVotantes) }}
              </span>
            </div>
            <button
              class="btn btn-primary btn-bloco"
              type="button"
              :disabled="!zeresimaDisponivel || Boolean(gerandoTipo)"
              @click="gerar('zeresima')"
            >
              <span v-if="gerandoTipo === 'zeresima'" class="spinner spinner-pequeno"></span>
              <Icone v-else nome="download" :tamanho="17" />
              {{ gerandoTipo === 'zeresima' ? 'Gerando...' : 'Gerar zerésima' }}
            </button>
            <small v-if="!zeresimaDisponivel" class="relatorio-indisponivel">
              {{
                totalVotantes > 0
                  ? 'Já existem votos registrados; a zerésima não pode mais ser emitida.'
                  : 'Disponível antes do primeiro voto, com a eleição em rascunho ou aberta.'
              }}
            </small>
          </div>
        </section>

        <section class="relatorio-card">
          <div class="relatorio-card-topo">
            <span class="relatorio-card-icone relatorio-icone-azul">
              <Icone nome="relatorio" :tamanho="24" />
            </span>
            <div>
              <h2>Boletim</h2>
              <p>Resultado por cargo, com ranking e totais.</p>
            </div>
          </div>
          <div class="relatorio-card-corpo">
            <div class="field">
              <label for="relatorio-cargo">Cargo</label>
              <select
                id="relatorio-cargo"
                v-model="cargoSelecionado"
                :disabled="!boletimDisponivel"
              >
                <option value="todos">Todos os cargos</option>
                <option v-for="cargo in cargos" :key="cargo.id" :value="cargo.id">
                  {{ cargo.nome }}
                </option>
              </select>
            </div>

            <label v-if="status === 'aberta'" class="check">
              <input v-model="parcial" type="checkbox" />
              <span>Gerar via parcial (marca d'água e aviso)</span>
            </label>
            <p v-else-if="status === 'encerrada'" class="relatorio-nota">
              A eleição está encerrada. O boletim será emitido como via oficial.
            </p>

            <button
              class="btn btn-primary btn-bloco"
              type="button"
              :disabled="!boletimDisponivel || Boolean(gerandoTipo)"
              @click="gerar('boletim_cargo')"
            >
              <span
                v-if="gerandoTipo === 'boletim_cargo'"
                class="spinner spinner-pequeno"
              ></span>
              <Icone v-else nome="download" :tamanho="17" />
              {{
                gerandoTipo === 'boletim_cargo'
                  ? 'Gerando...'
                  : 'Gerar boletim'
              }}
            </button>
            <small v-if="!boletimDisponivel" class="relatorio-indisponivel">
              Abra a eleição para gerar boletins.
            </small>
          </div>
        </section>

        <section class="relatorio-card">
          <div class="relatorio-card-topo">
            <span class="relatorio-card-icone relatorio-icone-verde">
              <Icone nome="auditoria" :tamanho="24" />
            </span>
            <div>
              <h2>Ata de encerramento</h2>
              <p>Documento final da comissão eleitoral.</p>
            </div>
          </div>
          <div class="relatorio-card-corpo">
            <p>
              Reúne comparecimento, resultado por cargo, declaração de
              encerramento e campos de assinatura da comissão.
            </p>
            <div class="relatorio-card-meta">
              <span>
                <Icone nome="usuarios" :tamanho="15" />
                {{ formatarNumero(totalVotantes) }} comparecimento(s)
              </span>
            </div>
            <button
              class="btn btn-primary btn-bloco"
              type="button"
              :disabled="!ataDisponivel || Boolean(gerandoTipo)"
              @click="gerar('ata_encerramento')"
            >
              <span
                v-if="gerandoTipo === 'ata_encerramento'"
                class="spinner spinner-pequeno"
              ></span>
              <Icone v-else nome="download" :tamanho="17" />
              {{
                gerandoTipo === 'ata_encerramento'
                  ? 'Gerando...'
                  : 'Gerar ata'
              }}
            </button>
            <small v-if="!ataDisponivel" class="relatorio-indisponivel">
              Disponível após o encerramento da eleição.
            </small>
          </div>
        </section>
      </div>

      <section class="painel-card relatorios-historico">
        <div class="painel-card-topo">
          <div>
            <h3>Histórico de relatórios</h3>
            <p>Arquivos emitidos nesta eleição, com hash de integridade.</p>
          </div>
          <button class="btn btn-ghost btn-pequeno" type="button" @click="carregarTudo">
            <Icone nome="atualizar" :tamanho="15" />
            Atualizar
          </button>
        </div>

        <div v-if="relatorios.erro" class="alert alert-erro">
          {{ relatorios.erro }}
        </div>

        <div v-if="relatorios.carregando" class="painel-card-carregando">
          <span class="spinner"></span>
          Carregando histórico...
        </div>

        <EmptyState
          v-else-if="!historico.length"
          icone="relatorio"
          titulo="Nenhum relatório emitido"
          texto="Os PDFs gerados aparecerão aqui com data, tipo, situação e hash."
        />

        <div v-else class="tabela-scroll">
          <table class="tabela">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Cargo</th>
                <th>Emissão</th>
                <th>Situação</th>
                <th>Hash</th>
                <th class="acoes">Ações</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="relatorio in historico" :key="relatorio.id">
                <td>
                  <strong>{{ tipoLabel(relatorio.tipo) }}</strong>
                </td>
                <td>{{ nomeCargo(relatorio.cargo_id) }}</td>
                <td>{{ formatarDataHora(relatorio.criado_em) }}</td>
                <td>
                  <span
                    class="badge"
                    :class="relatorio.parcial ? 'status-rascunho' : 'status-aberta'"
                  >
                    {{ relatorio.parcial ? 'Parcial' : 'Oficial' }}
                  </span>
                </td>
                <td>
                  <code
                    class="hash"
                    :title="relatorio.hash_arquivo || relatorio.hash_dados || ''"
                  >
                    {{ hashCurto(relatorio.hash_arquivo || relatorio.hash_dados) }}
                  </code>
                </td>
                <td class="acoes">
                  <button
                    class="btn btn-ghost btn-pequeno"
                    type="button"
                    @click="baixar(relatorio)"
                  >
                    <Icone nome="download" :tamanho="15" />
                    Baixar PDF
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="config-nota">
          <Icone nome="info" :tamanho="16" />
          <span>
            O hash SHA-256 permite conferir se o arquivo foi alterado. Guarde os
            PDFs oficiais junto à documentação da eleição.
          </span>
        </div>
      </section>
    </template>
  </div>
</template>
