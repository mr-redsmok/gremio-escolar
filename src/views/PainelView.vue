<script setup>
import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth.js'
import { useEleicaoStore } from '@/stores/eleicao.js'
import { useRelatoriosStore } from '@/stores/relatorios.js'
import { useToastStore } from '@/stores/toast.js'
import { useConfirmStore } from '@/stores/confirm.js'
import { service } from '@/lib/service.js'
import { ROTULOS_AUDITORIA, STATUS_ELEICAO } from '@/lib/constants.js'
import {
  formatarData,
  formatarDataHora,
  formatarNumero,
  formatarPercentual
} from '@/lib/utils.js'
import PageHeader from '@/components/PageHeader.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import StatCard from '@/components/StatCard.vue'
import EmptyState from '@/components/EmptyState.vue'
import Icone from '@/components/Icone.vue'
import EleicaoModal from '@/components/admin/EleicaoModal.vue'

const auth = useAuthStore()
const eleicao = useEleicaoStore()
const relatorios = useRelatoriosStore()
const toast = useToastStore()
const confirm = useConfirmStore()

const apuracao = ref(null)
const erroApuracao = ref('')
const carregandoApuracao = ref(false)
const auditoria = ref([])
const carregandoAuditoria = ref(false)
const modalEleicao = ref(false)
const salvandoEleicao = ref(false)
const erroEleicao = ref('')
const gerando = ref('')

const status = computed(() => eleicao.status)
const statusInfo = computed(
  () =>
    STATUS_ELEICAO[status.value] || {
      label: 'Sem eleição',
      descricao: 'Nenhuma eleição configurada.',
      classe: ''
    }
)
const podeEditar = computed(() => status.value === 'rascunho')
const podeNovaEleicao = computed(() => status.value !== 'aberta')
const totalVotantes = computed(() => apuracao.value?.total_votantes ?? 0)
const totalVotos = computed(
  () => (apuracao.value?.cargos || []).reduce((soma, c) => soma + (c.total_votos || 0), 0)
)
const totalValidos = computed(
  () => (apuracao.value?.cargos || []).reduce((soma, c) => soma + (c.validos || 0), 0)
)
const totalBrancos = computed(
  () => (apuracao.value?.cargos || []).reduce((soma, c) => soma + (c.brancos || 0), 0)
)
const totalNulos = computed(
  () => (apuracao.value?.cargos || []).reduce((soma, c) => soma + (c.nulos || 0), 0)
)
const comparecimento = computed(() =>
  apuracao.value?.comparecimento_percentual == null
    ? '—'
    : formatarPercentual(apuracao.value.comparecimento_percentual)
)
const detalheComparecimento = computed(() => {
  const aptos = eleicao.eleicao?.total_eleitores_aptos
  return aptos ? `de ${formatarNumero(aptos)} aptos` : 'aptos não informados'
})
const dataEleicao = computed(() => formatarData(eleicao.eleicao?.data_eleicao))
const resumoCargos = computed(() => apuracao.value?.cargos || [])
const auditoriaRecente = computed(() => auditoria.value.slice(0, 6))

const podeAbrir = computed(() => {
  const e = eleicao.eleicao
  if (!e) return false
  if (!String(e.escola_nome || '').trim() || !String(e.nome || '').trim()) return false
  if (!eleicao.cargos.length) return false
  return eleicao.cargos.every((cargo) =>
    eleicao.candidatos.some((c) => c.cargo_id === cargo.id && c.ativo !== false)
  )
})

const checklist = computed(() => {
  const e = eleicao.eleicao
  const cargos = eleicao.cargos
  const candidatosPorCargo = cargos.filter((c) =>
    eleicao.candidatos.some((cand) => cand.cargo_id === c.id && cand.ativo !== false)
  ).length

  return [
    {
      rotulo: 'Escola e eleição',
      detalhe: e?.escola_nome ? 'Identificação preenchida' : 'Informe escola e eleição',
      ok: Boolean(e?.escola_nome && e?.nome)
    },
    {
      rotulo: 'Cargos cadastrados',
      detalhe: cargos.length ? `${cargos.length} cargo(s)` : 'Nenhum cargo',
      ok: cargos.length > 0
    },
    {
      rotulo: 'Candidatos por cargo',
      detalhe:
        cargos.length && candidatosPorCargo === cargos.length
          ? 'Todos os cargos possuem candidatos'
          : `${candidatosPorCargo} de ${cargos.length} cargos completos`,
      ok: cargos.length > 0 && candidatosPorCargo === cargos.length
    },
    {
      rotulo: 'Pronta para abrir',
      detalhe: podeAbrir.value
        ? 'A urna pode ser liberada'
        : 'Complete os itens anteriores',
      ok: podeAbrir.value
    }
  ]
})

function vencedorCargo(cargo) {
  if (cargo.empate) return 'Empate'
  const eleitos = (cargo.candidatos || []).filter((c) => c.eleito)
  if (!eleitos.length) return 'Sem votos'
  return eleitos.map((c) => c.nome_urna || c.nome).join(', ')
}

function rotuloAuditoria(acao) {
  return ROTULOS_AUDITORIA[acao] || acao
}

function resumoDetalhes(detalhes) {
  if (!detalhes || !Object.keys(detalhes).length) return '—'
  const texto = JSON.stringify(detalhes)
  return texto.length > 110 ? `${texto.slice(0, 110)}…` : texto
}

async function carregarApuracao() {
  if (!service || !eleicao.eleicao) return
  carregandoApuracao.value = true
  erroApuracao.value = ''
  try {
    apuracao.value = await service.apurar(
      eleicao.eleicao.id,
      eleicao.status !== 'encerrada'
    )
  } catch (erro) {
    apuracao.value = null
    erroApuracao.value = erro.message
  } finally {
    carregandoApuracao.value = false
  }
}

async function carregarAuditoria() {
  if (!service || !eleicao.eleicao) return
  carregandoAuditoria.value = true
  try {
    auditoria.value = await service.listarAuditoria(eleicao.eleicao.id)
  } catch {
    auditoria.value = []
  } finally {
    carregandoAuditoria.value = false
  }
}

async function carregarTudo() {
  await eleicao.carregar(true)
  if (eleicao.eleicao) {
    await Promise.all([carregarApuracao(), carregarAuditoria()])
  }
}

async function atualizar() {
  await carregarTudo()
  toast.info('Dados atualizados.')
}

function abrirNovaEleicao() {
  if (!podeNovaEleicao.value) {
    toast.erro('Encerre a eleição atual antes de criar outra.')
    return
  }
  erroEleicao.value = ''
  modalEleicao.value = true
}

async function criarEleicao(dados) {
  if (salvandoEleicao.value) return
  salvandoEleicao.value = true
  erroEleicao.value = ''
  try {
    await eleicao.nova(dados)
    modalEleicao.value = false
    toast.sucesso('Eleição criada. Configure os cargos e candidatos antes de abrir.')
    await carregarTudo()
  } catch (erro) {
    erroEleicao.value = erro.message
  } finally {
    salvandoEleicao.value = false
  }
}

async function abrirEleicao() {
  const confirmado = await confirm.abrir({
    titulo: 'Abrir a eleição?',
    texto:
      'Depois de aberta, a configuração de escola, cargos e candidatos ficará congelada. A urna começará a aceitar votos.',
    confirmLabel: 'Abrir eleição',
    cancelLabel: 'Voltar'
  })
  if (!confirmado) return

  try {
    await eleicao.abrir()
    toast.sucesso('Eleição aberta. A urna está liberada.')
    await carregarTudo()
  } catch (erro) {
    toast.erro(erro.message)
  }
}

async function encerrarEleicao() {
  const confirmado = await confirm.abrir({
    titulo: 'Encerrar a votação?',
    texto:
      'A urna deixará de aceitar novos votos. Você ainda poderá reabrir a eleição, mas a ação ficará registrada na auditoria.',
    confirmLabel: 'Encerrar votação',
    cancelLabel: 'Continuar aberta',
    perigo: true
  })
  if (!confirmado) return

  try {
    await eleicao.encerrar()
    toast.sucesso('Votação encerrada. Gere a ata e o boletim oficial.')
    await carregarTudo()
  } catch (erro) {
    toast.erro(erro.message)
  }
}

async function reabrirEleicao() {
  const confirmado = await confirm.abrir({
    titulo: 'Reabrir a eleição?',
    texto:
      'A urna voltará a aceitar votos. A reabertura será registrada na auditoria com data e hora.',
    confirmLabel: 'Reabrir eleição',
    cancelLabel: 'Manter encerrada',
    perigo: true
  })
  if (!confirmado) return

  try {
    await eleicao.reabrir('Reabertura registrada pelo painel administrativo.')
    toast.sucesso('Eleição reaberta.')
    await carregarTudo()
  } catch (erro) {
    toast.erro(erro.message)
  }
}

async function gerarBoletim(parcial) {
  if (!eleicao.eleicao || gerando.value) return
  gerando.value = 'boletim'
  try {
    await relatorios.gerar({
      eleicaoId: eleicao.eleicao.id,
      tipo: 'boletim_cargo',
      parcial: Boolean(parcial)
    })
    toast.sucesso(
      parcial ? 'Boletim parcial gerado e baixado.' : 'Boletim oficial gerado e baixado.'
    )
  } catch (erro) {
    toast.erro(erro.message)
  } finally {
    gerando.value = ''
  }
}

async function pausarVotacao() {
  if (!eleicao.eleicao || status.value !== 'aberta') return
  const confirmado = await confirm.abrir({
    titulo: 'Pausar a votação?',
    texto:
      'Ninguém poderá iniciar uma nova votação até a retomada. Quem já começou a votar poderá concluir o voto.',
    confirmLabel: 'Pausar votação',
    cancelLabel: 'Voltar',
    perigo: true
  })
  if (!confirmado) return

  try {
    await eleicao.pausar()
    toast.sucesso('Votação pausada.')
    await carregarTudo()
  } catch (erro) {
    toast.erro(erro.message)
  }
}

async function retomarVotacao() {
  try {
    await eleicao.retomar()
    toast.sucesso('Votação retomada.')
    await carregarTudo()
  } catch (erro) {
    toast.erro(erro.message)
  }
}

async function apagarEleicao() {
  if (!eleicao.eleicao || status.value === 'aberta') return
  const confirmado = await confirm.abrir({
    titulo: 'Apagar esta eleição?',
    texto:
      'Os cargos, candidatos, votos, presenças, relatórios e registros de auditoria desta eleição serão apagados. Esta ação não pode ser desfeita.',
    confirmLabel: 'Apagar eleição',
    cancelLabel: 'Cancelar',
    perigo: true
  })
  if (!confirmado) return

  try {
    await eleicao.excluir()
    toast.sucesso('Eleição apagada.')
    await carregarTudo()
  } catch (erro) {
    toast.erro(erro.message)
  }
}

async function gerarAta() {
  if (!eleicao.eleicao || gerando.value) return
  gerando.value = 'ata'
  try {
    await relatorios.gerar({
      eleicaoId: eleicao.eleicao.id,
      tipo: 'ata_encerramento'
    })
    toast.sucesso('Ata de encerramento gerada e baixada.')
  } catch (erro) {
    toast.erro(erro.message)
  } finally {
    gerando.value = ''
  }
}

onMounted(carregarTudo)
</script>

<template>
  <div>
    <PageHeader
      titulo="Painel"
      :subtitulo="`Olá, ${auth.nome}. Acompanhe a eleição e os principais indicadores.`"
    >
      <button class="btn btn-ghost" type="button" @click="atualizar">
        <Icone nome="atualizar" :tamanho="17" />
        Atualizar
      </button>
      <button
        v-if="status === 'aberta' && !eleicao.eleicao?.pausada"
        class="btn btn-ghost"
        type="button"
        @click="pausarVotacao"
      >
        <Icone nome="relogio" :tamanho="17" />
        Pausar votação
      </button>
      <button
        v-if="status === 'aberta' && eleicao.eleicao?.pausada"
        class="btn btn-primary"
        type="button"
        @click="retomarVotacao"
      >
        <Icone nome="play" :tamanho="17" />
        Retomar votação
      </button>
      <button
        v-if="eleicao.eleicao && status !== 'aberta'"
        class="btn btn-danger"
        type="button"
        @click="apagarEleicao"
      >
        <Icone nome="lixo" :tamanho="17" />
        Apagar eleição
      </button>
      <button
        v-if="eleicao.eleicao"
        class="btn btn-primary"
        type="button"
        :disabled="!podeNovaEleicao"
        @click="abrirNovaEleicao"
      >
        <Icone nome="mais" :tamanho="17" />
        Nova eleição
      </button>
    </PageHeader>

    <div v-if="eleicao.carregando && !eleicao.eleicao" class="painel-carregando">
      <span class="spinner spinner-grande"></span>
      <p>Carregando a eleição...</p>
    </div>

    <template v-else-if="!eleicao.eleicao">
      <div class="painel-vazio">
        <EmptyState
          icone="urna"
          titulo="Comece configurando a eleição"
          texto="Crie a primeira eleição, cadastre os cargos e os candidatos. A urna só é liberada depois da abertura."
        >
          <button class="btn btn-primary" type="button" @click="abrirNovaEleicao">
            <Icone nome="mais" :tamanho="17" />
            Criar eleição
          </button>
        </EmptyState>

        <div class="painel-passos">
          <div class="painel-passo">
            <span>1</span>
            <div>
              <strong>Cadastre a eleição</strong>
              <p>Informe escola, nome, data e comissão eleitoral.</p>
            </div>
          </div>
          <div class="painel-passo">
            <span>2</span>
            <div>
              <strong>Configure cargos e candidatos</strong>
              <p>Defina a ordem dos cargos e os números de cada candidato.</p>
            </div>
          </div>
          <div class="painel-passo">
            <span>3</span>
            <div>
              <strong>Abra a urna</strong>
              <p>A configuração é congelada e a votação começa.</p>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template v-else>
      <section class="painel-hero">
        <div class="painel-hero-conteudo">
          <div class="painel-hero-topo">
            <StatusBadge :status="status" />
            <span v-if="eleicao.eleicao?.pausada" class="badge status-rascunho">
              Votação pausada
            </span>
            <span class="painel-hero-data">
              <Icone nome="relogio" :tamanho="15" />
              {{ dataEleicao }}
            </span>
          </div>
          <h2>{{ eleicao.eleicao.nome }}</h2>
          <p class="painel-hero-escola">{{ eleicao.eleicao.escola_nome }}</p>
          <p class="painel-hero-descricao">{{ statusInfo.descricao }}</p>
          <div class="painel-hero-meta">
            <span v-if="eleicao.eleicao.presidente_comissao">
              <Icone nome="usuarios" :tamanho="15" />
              Presidência: {{ eleicao.eleicao.presidente_comissao }}
            </span>
            <span v-if="eleicao.eleicao.total_eleitores_aptos">
              <Icone nome="usuarios" :tamanho="15" />
              {{ formatarNumero(eleicao.eleicao.total_eleitores_aptos) }} aptos
            </span>
          </div>
        </div>

        <div class="painel-hero-acoes">
          <template v-if="status === 'rascunho'">
            <button
              class="btn btn-primary btn-grande"
              type="button"
              :disabled="!podeAbrir"
              :title="podeAbrir ? 'Abrir a eleição' : 'Complete a configuração antes de abrir'"
              @click="abrirEleicao"
            >
              <Icone nome="play" :tamanho="18" />
              Abrir eleição
            </button>
            <router-link class="btn btn-ghost" :to="{ name: 'admin-configuracoes' }">
              <Icone nome="config" :tamanho="17" />
              Configurar
            </router-link>
          </template>

          <template v-else-if="status === 'aberta'">
            <button
              class="btn btn-danger btn-grande"
              type="button"
              @click="encerrarEleicao"
            >
              <Icone nome="stop" :tamanho="17" />
              Encerrar eleição
            </button>
            <button
              class="btn btn-ghost"
              type="button"
              :disabled="Boolean(gerando)"
              @click="gerarBoletim(true)"
            >
              <span v-if="gerando === 'boletim'" class="spinner spinner-pequeno"></span>
              <Icone v-else nome="relatorio" :tamanho="17" />
              Boletim parcial
            </button>
          </template>

          <template v-else-if="status === 'encerrada'">
            <button
              class="btn btn-primary btn-grande"
              type="button"
              :disabled="Boolean(gerando)"
              @click="gerarAta"
            >
              <span v-if="gerando === 'ata'" class="spinner spinner-pequeno"></span>
              <Icone v-else nome="documento" :tamanho="18" />
              Gerar ata
            </button>
            <button
              class="btn btn-ghost"
              type="button"
              :disabled="Boolean(gerando)"
              @click="gerarBoletim(false)"
            >
              <Icone nome="relatorio" :tamanho="17" />
              Boletim oficial
            </button>
            <button class="btn btn-ghost" type="button" @click="reabrirEleicao">
              <Icone nome="atualizar" :tamanho="17" />
              Reabrir
            </button>
          </template>
        </div>
      </section>

      <div class="stats-grid">
        <StatCard
          rotulo="Votantes"
          :valor="formatarNumero(totalVotantes)"
          :detalhe="`${comparecimento} ${detalheComparecimento}`"
          icone="usuarios"
          tom="azul"
        />
        <StatCard
          rotulo="Votos registrados"
          :valor="formatarNumero(totalVotos)"
          detalhe="Somatório por cargo"
          icone="urna"
          tom="roxo"
        />
        <StatCard
          rotulo="Votos válidos"
          :valor="formatarNumero(totalValidos)"
          :detalhe="`${formatarNumero(totalBrancos)} branco(s) · ${formatarNumero(totalNulos)} nulo(s)`"
          icone="check"
          tom="verde"
        />
        <StatCard
          rotulo="Cargos"
          :valor="eleicao.cargos.length"
          :detalhe="`${eleicao.candidatos.length} candidato(s) cadastrado(s)`"
          icone="config"
          tom="ambar"
        />
      </div>

      <div class="painel-grid">
        <section class="painel-card">
          <div class="painel-card-topo">
            <div>
              <h3>Resultado por cargo</h3>
              <p>Apuração em tempo real, sem vínculo com a identidade do eleitor.</p>
            </div>
            <router-link class="btn btn-ghost btn-pequeno" :to="{ name: 'admin-relatorios' }">
              Relatórios
              <Icone nome="seta-direita" :tamanho="15" />
            </router-link>
          </div>

          <div v-if="carregandoApuracao" class="painel-card-carregando">
            <span class="spinner"></span>
            Calculando...
          </div>
          <div v-else-if="erroApuracao" class="alert alert-erro">
            {{ erroApuracao }}
          </div>
          <div v-else class="tabela-scroll">
            <table class="tabela">
              <thead>
                <tr>
                  <th>Cargo</th>
                  <th class="num">Total</th>
                  <th class="num">Válidos</th>
                  <th class="num">Brancos</th>
                  <th class="num">Nulos</th>
                  <th>Eleito / situação</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="cargo in resumoCargos" :key="cargo.id">
                  <td>
                    <strong>{{ cargo.nome }}</strong>
                    <small class="tabela-sub">{{ cargo.digitos }} dígitos</small>
                  </td>
                  <td class="num">{{ formatarNumero(cargo.total_votos) }}</td>
                  <td class="num">{{ formatarNumero(cargo.validos) }}</td>
                  <td class="num">{{ formatarNumero(cargo.brancos) }}</td>
                  <td class="num">{{ formatarNumero(cargo.nulos) }}</td>
                  <td>
                    <span
                      class="resultado-cargo"
                      :class="{ empate: cargo.empate, vazio: !cargo.total_votos }"
                    >
                      {{ vencedorCargo(cargo) }}
                    </span>
                  </td>
                </tr>
                <tr v-if="!resumoCargos.length">
                  <td colspan="6" class="tabela-vazia">
                    Nenhum cargo cadastrado.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="painel-card">
          <div class="painel-card-topo">
            <div>
              <h3>{{ podeEditar ? 'Checklist de abertura' : 'Situação da urna' }}</h3>
              <p>
                {{ podeEditar ? 'Complete os itens antes de liberar a votação.' : 'Resumo operacional da eleição.' }}
              </p>
            </div>
          </div>

          <div v-if="podeEditar" class="checklist">
            <div v-for="item in checklist" :key="item.rotulo" class="checklist-item">
              <span class="checklist-icone" :class="{ ok: item.ok }">
                <Icone :nome="item.ok ? 'check' : 'fechar'" :tamanho="14" />
              </span>
              <div>
                <strong>{{ item.rotulo }}</strong>
                <small>{{ item.detalhe }}</small>
              </div>
            </div>
            <router-link
              class="btn btn-ghost btn-bloco"
              :to="{ name: 'admin-configuracoes' }"
            >
              <Icone nome="config" :tamanho="17" />
              Revisar configuração
            </router-link>
          </div>

          <div v-else class="painel-operacao">
            <div class="painel-operacao-linha">
              <span>Status</span>
              <StatusBadge :status="status" />
            </div>
            <div class="painel-operacao-linha">
              <span>Comparecimento</span>
              <strong>{{ comparecimento }}</strong>
            </div>
            <div class="painel-operacao-linha">
              <span>Configuração</span>
              <strong>{{ status === 'aberta' ? 'Congelada' : 'Histórico' }}</strong>
            </div>
            <div class="painel-operacao-linha">
              <span>Votos anônimos</span>
              <strong>Sim</strong>
            </div>
            <div class="alert alert-info">
              A lista de votantes é separada dos votos. O sistema não permite
              identificar em quem cada pessoa votou.
            </div>
            <router-link class="btn btn-ghost btn-bloco" :to="{ name: 'admin-votantes' }">
              <Icone nome="usuarios" :tamanho="17" />
              Consultar votantes
            </router-link>
          </div>
        </section>
      </div>

      <div class="painel-grid painel-grid-baixo">
        <section class="painel-card">
          <div class="painel-card-topo">
            <div>
              <h3>Auditoria recente</h3>
              <p>Últimos eventos registrados nesta eleição.</p>
            </div>
            <router-link class="btn btn-ghost btn-pequeno" :to="{ name: 'admin-auditoria' }">
              Ver tudo
              <Icone nome="seta-direita" :tamanho="15" />
            </router-link>
          </div>

          <div v-if="carregandoAuditoria" class="painel-card-carregando">
            <span class="spinner"></span>
            Carregando...
          </div>
          <div v-else-if="!auditoriaRecente.length" class="painel-card-vazio">
            Nenhum evento registrado ainda.
          </div>
          <ul v-else class="auditoria-lista">
            <li v-for="evento in auditoriaRecente" :key="evento.id">
              <span class="auditoria-ponto"></span>
              <div>
                <strong>{{ rotuloAuditoria(evento.acao) }}</strong>
                <small>{{ formatarDataHora(evento.criado_em) }}</small>
                <p>{{ resumoDetalhes(evento.detalhes) }}</p>
              </div>
            </li>
          </ul>
        </section>

        <section class="painel-card">
          <div class="painel-card-topo">
            <div>
              <h3>Comissão e urna</h3>
              <p>Dados operacionais da eleição.</p>
            </div>
          </div>

          <dl class="painel-dados">
            <div>
              <dt>Data da eleição</dt>
              <dd>{{ dataEleicao }}</dd>
            </div>
            <div>
              <dt>Presidência da comissão</dt>
              <dd>{{ eleicao.eleicao.presidente_comissao || 'Não informada' }}</dd>
            </div>
            <div>
              <dt>Secretaria da comissão</dt>
              <dd>{{ eleicao.eleicao.secretario_comissao || 'Não informada' }}</dd>
            </div>
            <div>
              <dt>Dígitos padrão</dt>
              <dd>{{ eleicao.eleicao.digitos_padrao }} dígitos</dd>
            </div>
            <div>
              <dt>Inatividade</dt>
              <dd>{{ eleicao.eleicao.tempo_inatividade_segundos }} segundos</dd>
            </div>
            <div>
              <dt>Som da urna</dt>
              <dd>{{ eleicao.eleicao.som_ativo ? 'Ativado' : 'Desativado' }}</dd>
            </div>
          </dl>

          <div class="painel-dados-acoes">
            <router-link class="btn btn-ghost btn-bloco" :to="{ name: 'admin-configuracoes' }">
              <Icone nome="config" :tamanho="17" />
              {{ podeEditar ? 'Editar configuração' : 'Ver configuração' }}
            </router-link>
          </div>
        </section>
      </div>
    </template>

    <EleicaoModal
      :aberto="modalEleicao"
      :escola-padrao="eleicao.eleicao?.escola_nome || ''"
      :salvando="salvandoEleicao"
      :erro-servidor="erroEleicao"
      @fechar="modalEleicao = false"
      @salvar="criarEleicao"
    />
  </div>
</template>
