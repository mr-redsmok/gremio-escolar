<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useEleicaoStore } from '@/stores/eleicao.js'
import { useToastStore } from '@/stores/toast.js'
import { useConfirmStore } from '@/stores/confirm.js'
import { validarEleicao } from '@/lib/validators.js'
import { STATUS_ELEICAO } from '@/lib/constants.js'
import { formatarNumero } from '@/lib/utils.js'
import PageHeader from '@/components/PageHeader.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import EmptyState from '@/components/EmptyState.vue'
import Icone from '@/components/Icone.vue'
import CargoModal from '@/components/admin/CargoModal.vue'
import CandidatoModal from '@/components/admin/CandidatoModal.vue'

const eleicao = useEleicaoStore()
const toast = useToastStore()
const confirm = useConfirmStore()

const aba = ref('eleicao')
const form = reactive({
  escola_nome: '',
  nome: '',
  descricao: '',
  data_eleicao: '',
  total_eleitores_aptos: '',
  digitos_padrao: 2,
  som_ativo: true,
  tempo_inatividade_segundos: 120,
  presidente_comissao: '',
  secretario_comissao: ''
})
const errosEleicao = ref({})
const erroGeral = ref('')
const salvandoEleicao = ref(false)

const modalCargo = ref(false)
const cargoEditando = ref(null)
const salvandoCargo = ref(false)
const erroCargo = ref('')

const modalCandidato = ref(false)
const candidatoEditando = ref(null)
const salvandoCandidato = ref(false)
const erroCandidato = ref('')
const cargoPadrao = ref('')
const filtroCargo = ref('todos')

const status = computed(() => eleicao.status)
const statusInfo = computed(
  () =>
    STATUS_ELEICAO[status.value] || {
      label: 'Sem eleição',
      descricao: 'Nenhuma eleição configurada.',
      classe: ''
    }
)
const podeEditar = computed(() => eleicao.podeEditar)
const cargos = computed(() => eleicao.cargos)
const proximoOrdem = computed(() => {
  const ordens = eleicao.cargos.map((c) => Number(c.ordem) || 0)
  return (ordens.length ? Math.max(...ordens) : 0) + 1
})
const candidatosFiltrados = computed(() => {
  const lista = [...eleicao.candidatos].sort((a, b) =>
    String(a.numero).localeCompare(String(b.numero))
  )
  if (filtroCargo.value === 'todos') return lista
  return lista.filter((c) => c.cargo_id === filtroCargo.value)
})

function preencherForm() {
  const e = eleicao.eleicao
  if (!e) return
  form.escola_nome = e.escola_nome || ''
  form.nome = e.nome || ''
  form.descricao = e.descricao || ''
  form.data_eleicao = e.data_eleicao || ''
  form.total_eleitores_aptos = e.total_eleitores_aptos ?? ''
  form.digitos_padrao = Number(e.digitos_padrao) || 2
  form.som_ativo = e.som_ativo !== false
  form.tempo_inatividade_segundos = Number(e.tempo_inatividade_segundos) || 120
  form.presidente_comissao = e.presidente_comissao || ''
  form.secretario_comissao = e.secretario_comissao || ''
  errosEleicao.value = {}
  erroGeral.value = ''
}

function descartar() {
  preencherForm()
  toast.info('Alterações não salvas foram descartadas.')
}

async function salvarEleicao() {
  if (!podeEditar.value || salvandoEleicao.value) return
  const resultado = validarEleicao(form)
  errosEleicao.value = resultado.erros
  if (!resultado.ok) return

  salvandoEleicao.value = true
  erroGeral.value = ''
  try {
    await eleicao.salvarEleicao({
      escola_nome: form.escola_nome.trim(),
      nome: form.nome.trim(),
      descricao: form.descricao.trim(),
      data_eleicao: form.data_eleicao || null,
      total_eleitores_aptos:
        form.total_eleitores_aptos === ''
          ? null
          : Number(form.total_eleitores_aptos),
      digitos_padrao: Number(form.digitos_padrao),
      som_ativo: form.som_ativo,
      tempo_inatividade_segundos: Number(form.tempo_inatividade_segundos),
      presidente_comissao: form.presidente_comissao.trim(),
      secretario_comissao: form.secretario_comissao.trim()
    })
    toast.sucesso('Configuração da eleição salva.')
  } catch (erro) {
    erroGeral.value = erro.message
    toast.erro(erro.message)
  } finally {
    salvandoEleicao.value = false
  }
}

function totalCandidatosCargo(cargoId) {
  return eleicao.candidatos.filter((c) => c.cargo_id === cargoId).length
}

function cargoNome(cargoId) {
  return eleicao.cargos.find((c) => c.id === cargoId)?.nome || '—'
}

function abrirNovoCargo() {
  if (!podeEditar.value) return
  cargoEditando.value = null
  erroCargo.value = ''
  modalCargo.value = true
}

function abrirEditarCargo(cargo) {
  if (!podeEditar.value) return
  cargoEditando.value = { ...cargo }
  erroCargo.value = ''
  modalCargo.value = true
}

async function salvarCargo(payload) {
  if (salvandoCargo.value) return
  salvandoCargo.value = true
  erroCargo.value = ''
  try {
    if (cargoEditando.value) {
      await eleicao.atualizarCargo(cargoEditando.value.id, payload)
      toast.sucesso('Cargo atualizado.')
    } else {
      await eleicao.criarCargo(payload)
      toast.sucesso('Cargo criado.')
    }
    modalCargo.value = false
  } catch (erro) {
    erroCargo.value = erro.message
  } finally {
    salvandoCargo.value = false
  }
}

async function removerCargo(cargo) {
  if (!podeEditar.value) return
  const confirmado = await confirm.abrir({
    titulo: `Remover o cargo ${cargo.nome}?`,
    texto:
      'Os candidatos vinculados a este cargo também serão removidos. Esta ação não pode ser desfeita.',
    confirmLabel: 'Remover cargo',
    cancelLabel: 'Cancelar',
    perigo: true
  })
  if (!confirmado) return

  try {
    await eleicao.removerCargo(cargo.id)
    if (filtroCargo.value === cargo.id) filtroCargo.value = 'todos'
    toast.sucesso('Cargo removido.')
  } catch (erro) {
    toast.erro(erro.message)
  }
}

async function moverCargo(cargo, direcao) {
  if (!podeEditar.value) return
  const ordenados = [...eleicao.cargos].sort(
    (a, b) => Number(a.ordem) - Number(b.ordem) || a.nome.localeCompare(b.nome)
  )
  const indice = ordenados.findIndex((c) => c.id === cargo.id)
  const alvo = indice + direcao
  if (indice < 0 || alvo < 0 || alvo >= ordenados.length) return

  const trocados = [...ordenados]
  ;[trocados[indice], trocados[alvo]] = [trocados[alvo], trocados[indice]]

  try {
    await eleicao.reordenarCargos(trocados.map((c) => c.id))
  } catch (erro) {
    toast.erro(erro.message)
  }
}

function abrirNovoCandidato(cargoId = null) {
  if (!podeEditar.value) return
  if (!eleicao.cargos.length) {
    toast.erro('Cadastre pelo menos um cargo antes de incluir candidatos.')
    return
  }
  candidatoEditando.value = null
  cargoPadrao.value = cargoId || eleicao.cargos[0]?.id || ''
  erroCandidato.value = ''
  modalCandidato.value = true
}

function abrirEditarCandidato(candidato) {
  if (!podeEditar.value) return
  candidatoEditando.value = { ...candidato }
  cargoPadrao.value = candidato.cargo_id
  erroCandidato.value = ''
  modalCandidato.value = true
}

async function salvarCandidato(payload) {
  if (salvandoCandidato.value) return
  salvandoCandidato.value = true
  erroCandidato.value = ''
  try {
    if (candidatoEditando.value) {
      await eleicao.atualizarCandidato(candidatoEditando.value.id, payload)
      toast.sucesso('Candidato atualizado.')
    } else {
      await eleicao.criarCandidato(payload)
      toast.sucesso('Candidato criado.')
    }
    modalCandidato.value = false
  } catch (erro) {
    erroCandidato.value = erro.message
  } finally {
    salvandoCandidato.value = false
  }
}

async function removerCandidato(candidato) {
  if (!podeEditar.value) return
  const confirmado = await confirm.abrir({
    titulo: `Remover ${candidato.nome_urna || candidato.nome}?`,
    texto: 'O candidato será removido da urna. Esta ação não pode ser desfeita.',
    confirmLabel: 'Remover candidato',
    cancelLabel: 'Cancelar',
    perigo: true
  })
  if (!confirmado) return

  try {
    await eleicao.removerCandidato(candidato.id)
    toast.sucesso('Candidato removido.')
  } catch (erro) {
    toast.erro(erro.message)
  }
}

watch(
  () => eleicao.eleicao,
  () => preencherForm(),
  { immediate: true }
)

onMounted(async () => {
  await eleicao.carregar()
  preencherForm()
})
</script>

<template>
  <div>
    <PageHeader
      titulo="Configurações"
      subtitulo="Defina a eleição, a ordem dos cargos e os candidatos da urna."
    >
      <StatusBadge v-if="eleicao.eleicao" :status="status" />
    </PageHeader>

    <div v-if="eleicao.carregando && !eleicao.eleicao" class="painel-carregando">
      <span class="spinner spinner-grande"></span>
      <p>Carregando configuração...</p>
    </div>

    <EmptyState
      v-else-if="!eleicao.eleicao"
      icone="config"
      titulo="Nenhuma eleição configurada"
      texto="Crie a eleição no Painel para liberar as configurações de cargos e candidatos."
    >
      <router-link class="btn btn-primary" :to="{ name: 'admin-painel' }">
        Ir para o Painel
      </router-link>
    </EmptyState>

    <template v-else>
      <div v-if="!podeEditar" class="alert alert-aviso config-congelada">
        <Icone nome="cadeado" :tamanho="18" />
        <div>
          <strong>Configuração congelada.</strong>
          A eleição está <strong>{{ statusInfo.label.toLowerCase() }}</strong>. Para
          alterar escola, cargos ou candidatos, será necessário criar uma nova
          eleição.
        </div>
      </div>

      <nav class="config-tabs" aria-label="Seções de configuração">
        <button
          type="button"
          class="config-tab"
          :class="{ ativo: aba === 'eleicao' }"
          @click="aba = 'eleicao'"
        >
          <Icone nome="config" :tamanho="17" />
          Eleição
        </button>
        <button
          type="button"
          class="config-tab"
          :class="{ ativo: aba === 'cargos' }"
          @click="aba = 'cargos'"
        >
          <Icone nome="painel" :tamanho="17" />
          Cargos
          <span class="config-tab-contador">{{ eleicao.cargos.length }}</span>
        </button>
        <button
          type="button"
          class="config-tab"
          :class="{ ativo: aba === 'candidatos' }"
          @click="aba = 'candidatos'"
        >
          <Icone nome="usuarios" :tamanho="17" />
          Candidatos
          <span class="config-tab-contador">{{ eleicao.candidatos.length }}</span>
        </button>
      </nav>

      <section v-if="aba === 'eleicao'" class="config-painel">
        <form class="config-form" @submit.prevent="salvarEleicao">
          <fieldset class="config-fieldset" :disabled="!podeEditar">
            <div class="config-secao">
              <div class="config-secao-topo">
                <h2>Identificação</h2>
                <p>Dados que aparecem na urna e nos relatórios.</p>
              </div>

              <div class="form-grid">
                <div class="field field-full">
                  <label for="cfg-escola">Nome da escola *</label>
                  <input
                    id="cfg-escola"
                    v-model="form.escola_nome"
                    type="text"
                    maxlength="120"
                    placeholder="Ex.: Escola Estadual Professora Maria Silva"
                  />
                  <small v-if="errosEleicao.escola_nome" class="field-error">
                    {{ errosEleicao.escola_nome }}
                  </small>
                </div>

                <div class="field field-full">
                  <label for="cfg-nome">Nome da eleição *</label>
                  <input
                    id="cfg-nome"
                    v-model="form.nome"
                    type="text"
                    maxlength="120"
                    placeholder="Ex.: Eleição do Grêmio Estudantil 2026"
                  />
                  <small v-if="errosEleicao.nome" class="field-error">
                    {{ errosEleicao.nome }}
                  </small>
                </div>

                <div class="field field-full">
                  <label for="cfg-descricao">Descrição</label>
                  <textarea
                    id="cfg-descricao"
                    v-model="form.descricao"
                    rows="2"
                    maxlength="300"
                    placeholder="Texto curto exibido na tela inicial (opcional)"
                  ></textarea>
                </div>

                <div class="field">
                  <label for="cfg-data">Data da eleição</label>
                  <input id="cfg-data" v-model="form.data_eleicao" type="date" />
                </div>

                <div class="field">
                  <label for="cfg-aptos">Eleitores aptos</label>
                  <input
                    id="cfg-aptos"
                    v-model="form.total_eleitores_aptos"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="Opcional"
                  />
                  <small v-if="errosEleicao.total_eleitores_aptos" class="field-error">
                    {{ errosEleicao.total_eleitores_aptos }}
                  </small>
                  <small v-else class="field-hint">
                    Usado para calcular o percentual de comparecimento.
                  </small>
                </div>
              </div>
            </div>

            <div class="config-secao">
              <div class="config-secao-topo">
                <h2>Comportamento da urna</h2>
                <p>Padrões aplicados aos cargos e à sessão de votação.</p>
              </div>

              <div class="form-grid">
                <div class="field">
                  <label for="cfg-digitos">Dígitos padrão</label>
                  <select id="cfg-digitos" v-model.number="form.digitos_padrao">
                    <option :value="2">2 dígitos</option>
                    <option :value="3">3 dígitos</option>
                    <option :value="4">4 dígitos</option>
                  </select>
                  <small class="field-hint">
                    Usado ao criar novos cargos. Pode ser ajustado por cargo.
                  </small>
                </div>

                <div class="field">
                  <label for="cfg-inatividade">Inatividade (segundos)</label>
                  <input
                    id="cfg-inatividade"
                    v-model.number="form.tempo_inatividade_segundos"
                    type="number"
                    min="30"
                    max="600"
                    step="10"
                  />
                  <small v-if="errosEleicao.tempo_inatividade_segundos" class="field-error">
                    {{ errosEleicao.tempo_inatividade_segundos }}
                  </small>
                  <small v-else class="field-hint">
                    Entre 30 e 600 segundos. Após esse tempo, a sessão é cancelada.
                  </small>
                </div>

                <label class="check field-full">
                  <input v-model="form.som_ativo" type="checkbox" />
                  <span>Ativar sons de tecla e confirmação na urna</span>
                </label>
              </div>
            </div>

            <div class="config-secao">
              <div class="config-secao-topo">
                <h2>Comissão eleitoral</h2>
                <p>Nomes que constam na ata e nos relatórios oficiais.</p>
              </div>

              <div class="form-grid">
                <div class="field">
                  <label for="cfg-presidente">Presidente(a) da comissão</label>
                  <input
                    id="cfg-presidente"
                    v-model="form.presidente_comissao"
                    type="text"
                    maxlength="120"
                    placeholder="Nome completo"
                  />
                </div>

                <div class="field">
                  <label for="cfg-secretario">Secretário(a) da comissão</label>
                  <input
                    id="cfg-secretario"
                    v-model="form.secretario_comissao"
                    type="text"
                    maxlength="120"
                    placeholder="Nome completo"
                  />
                </div>
              </div>
            </div>
          </fieldset>

          <div v-if="erroGeral" class="alert alert-erro" role="alert">
            {{ erroGeral }}
          </div>

          <div class="config-form-acoes">
            <span class="config-form-hint">
              <Icone nome="info" :tamanho="15" />
              {{ podeEditar ? 'As alterações são registradas na auditoria.' : 'A configuração não pode ser alterada após a abertura.' }}
            </span>
            <div class="config-form-botoes">
              <button
                class="btn btn-ghost"
                type="button"
                :disabled="!podeEditar || salvandoEleicao"
                @click="descartar"
              >
                Descartar
              </button>
              <button
                class="btn btn-primary"
                type="submit"
                :disabled="!podeEditar || salvandoEleicao"
              >
                <span v-if="salvandoEleicao" class="spinner spinner-pequeno"></span>
                <Icone v-else nome="check" :tamanho="17" />
                {{ salvandoEleicao ? 'Salvando...' : 'Salvar alterações' }}
              </button>
            </div>
          </div>
        </form>
      </section>

      <section v-else-if="aba === 'cargos'" class="config-painel">
        <div class="config-lista-topo">
          <div>
            <h2>Cargos da eleição</h2>
            <p>
              A ordem abaixo define a sequência de votação. Cada cargo tem seu
              próprio conjunto de candidatos.
            </p>
          </div>
          <button
            class="btn btn-primary"
            type="button"
            :disabled="!podeEditar"
            @click="abrirNovoCargo"
          >
            <Icone nome="mais" :tamanho="17" />
            Novo cargo
          </button>
        </div>

        <EmptyState
          v-if="!cargos.length"
          icone="config"
          titulo="Nenhum cargo cadastrado"
          texto="Cadastre pelo menos um cargo para que a urna possa exibir a votação."
        >
          <button
            class="btn btn-primary"
            type="button"
            :disabled="!podeEditar"
            @click="abrirNovoCargo"
          >
            <Icone nome="mais" :tamanho="17" />
            Cadastrar cargo
          </button>
        </EmptyState>

        <div v-else class="tabela-scroll">
          <table class="tabela tabela-config">
            <thead>
              <tr>
                <th class="ordem">Ordem</th>
                <th>Cargo</th>
                <th class="num">Dígitos</th>
                <th>Branco</th>
                <th class="num">Candidatos</th>
                <th>Status</th>
                <th class="acoes">Ações</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(cargo, indice) in cargos" :key="cargo.id">
                <td class="ordem">
                  <div class="ordem-controle">
                    <button
                      class="btn-icon btn-icon-mini"
                      type="button"
                      title="Mover para cima"
                      :disabled="!podeEditar || indice === 0"
                      @click="moverCargo(cargo, -1)"
                    >
                      <Icone nome="seta-cima" :tamanho="14" />
                    </button>
                    <span>{{ cargo.ordem }}</span>
                    <button
                      class="btn-icon btn-icon-mini"
                      type="button"
                      title="Mover para baixo"
                      :disabled="!podeEditar || indice === cargos.length - 1"
                      @click="moverCargo(cargo, 1)"
                    >
                      <Icone nome="seta-baixo" :tamanho="14" />
                    </button>
                  </div>
                </td>
                <td>
                  <strong>{{ cargo.nome }}</strong>
                  <small v-if="cargo.descricao" class="tabela-sub">
                    {{ cargo.descricao }}
                  </small>
                </td>
                <td class="num">{{ cargo.digitos }}</td>
                <td>{{ cargo.permite_branco ? 'Permitido' : 'Não' }}</td>
                <td class="num">{{ totalCandidatosCargo(cargo.id) }}</td>
                <td>
                  <span class="badge" :class="cargo.ativo ? 'status-aberta' : 'status-arquivada'">
                    {{ cargo.ativo ? 'Ativo' : 'Inativo' }}
                  </span>
                </td>
                <td class="acoes">
                  <div class="tabela-acoes">
                    <button
                      class="btn-icon"
                      type="button"
                      title="Editar cargo"
                      :disabled="!podeEditar"
                      @click="abrirEditarCargo(cargo)"
                    >
                      <Icone nome="editar" :tamanho="16" />
                    </button>
                    <button
                      class="btn-icon btn-icon-perigo"
                      type="button"
                      title="Remover cargo"
                      :disabled="!podeEditar"
                      @click="removerCargo(cargo)"
                    >
                      <Icone nome="lixo" :tamanho="16" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section v-else class="config-painel">
        <div class="config-lista-topo">
          <div>
            <h2>Candidatos</h2>
            <p>
              O número é único dentro de cada cargo. O nome de urna é o que
              aparece em destaque na urna.
            </p>
          </div>
          <div class="config-lista-acoes">
            <div class="field field-inline">
              <label for="filtro-cargo">Filtrar por cargo</label>
              <select id="filtro-cargo" v-model="filtroCargo">
                <option value="todos">Todos os cargos</option>
                <option v-for="cargo in cargos" :key="cargo.id" :value="cargo.id">
                  {{ cargo.nome }}
                </option>
              </select>
            </div>
            <button
              class="btn btn-primary"
              type="button"
              :disabled="!podeEditar"
              @click="abrirNovoCandidato()"
            >
              <Icone nome="mais" :tamanho="17" />
              Novo candidato
            </button>
          </div>
        </div>

        <EmptyState
          v-if="!eleicao.candidatos.length"
          icone="usuarios"
          titulo="Nenhum candidato cadastrado"
          texto="Cadastre os candidatos de cada cargo com número, nome de urna e chapa."
        >
          <button
            class="btn btn-primary"
            type="button"
            :disabled="!podeEditar"
            @click="abrirNovoCandidato()"
          >
            <Icone nome="mais" :tamanho="17" />
            Cadastrar candidato
          </button>
        </EmptyState>

        <div v-else class="tabela-scroll">
          <table class="tabela tabela-config">
            <thead>
              <tr>
                <th class="num">Número</th>
                <th>Candidato</th>
                <th>Cargo</th>
                <th>Chapa</th>
                <th>Vice</th>
                <th>Status</th>
                <th class="acoes">Ações</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="candidato in candidatosFiltrados" :key="candidato.id">
                <td class="num">
                  <span class="numero-candidato">{{ candidato.numero }}</span>
                </td>
                <td>
                  <strong>{{ candidato.nome_urna || candidato.nome }}</strong>
                  <small class="tabela-sub">{{ candidato.nome }}</small>
                </td>
                <td>{{ cargoNome(candidato.cargo_id) }}</td>
                <td>{{ candidato.chapa || '—' }}</td>
                <td>{{ candidato.vice || '—' }}</td>
                <td>
                  <span
                    class="badge"
                    :class="candidato.ativo ? 'status-aberta' : 'status-arquivada'"
                  >
                    {{ candidato.ativo ? 'Ativo' : 'Inativo' }}
                  </span>
                </td>
                <td class="acoes">
                  <div class="tabela-acoes">
                    <button
                      class="btn-icon"
                      type="button"
                      title="Editar candidato"
                      :disabled="!podeEditar"
                      @click="abrirEditarCandidato(candidato)"
                    >
                      <Icone nome="editar" :tamanho="16" />
                    </button>
                    <button
                      class="btn-icon btn-icon-perigo"
                      type="button"
                      title="Remover candidato"
                      :disabled="!podeEditar"
                      @click="removerCandidato(candidato)"
                    >
                      <Icone nome="lixo" :tamanho="16" />
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="!candidatosFiltrados.length">
                <td colspan="7" class="tabela-vazia">
                  Nenhum candidato neste cargo.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="config-nota">
          <Icone nome="info" :tamanho="16" />
          <span>
            Total de {{ formatarNumero(eleicao.candidatos.length) }} candidato(s)
            em {{ formatarNumero(eleicao.cargos.length) }} cargo(s).
          </span>
        </div>
      </section>
    </template>

    <CargoModal
      :aberto="modalCargo"
      :cargo="cargoEditando"
      :cargos="eleicao.cargos"
      :candidatos="eleicao.candidatos"
      :proximo-ordem="proximoOrdem"
      :digitos-padrao="eleicao.eleicao?.digitos_padrao || 2"
      :salvando="salvandoCargo"
      :erro-servidor="erroCargo"
      @fechar="modalCargo = false"
      @salvar="salvarCargo"
    />

    <CandidatoModal
      :aberto="modalCandidato"
      :candidato="candidatoEditando"
      :cargos="eleicao.cargos"
      :candidatos="eleicao.candidatos"
      :cargo-padrao="cargoPadrao"
      :salvando="salvandoCandidato"
      :erro-servidor="erroCandidato"
      @fechar="modalCandidato = false"
      @salvar="salvarCandidato"
    />
  </div>
</template>
