<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUrnaStore } from '@/stores/urna.js'
import { useToastStore } from '@/stores/toast.js'
import { useConfirmStore } from '@/stores/confirm.js'
import { STATUS_ELEICAO } from '@/lib/constants.js'
import { formatarData } from '@/lib/utils.js'
import Icone from '@/components/Icone.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import EmptyState from '@/components/EmptyState.vue'

const urn = useUrnaStore()
const toast = useToastStore()
const confirm = useConfirmStore()
const router = useRouter()

const etapa = ref('form')
const erro = ref('')
const carregando = ref(false)
let atualizacaoTimer = null

const eleicao = computed(() => urn.eleicao)
const status = computed(() => eleicao.value?.status || null)
const statusInfo = computed(
  () =>
    STATUS_ELEICAO[status.value] || {
      label: 'Sem eleição',
      descricao: 'Nenhuma eleição foi configurada.',
      classe: ''
    }
)
const dataEleicao = computed(() => formatarData(eleicao.value?.data_eleicao))
const tempoMinutos = computed(() =>
  Math.max(1, Math.round((Number(eleicao.value?.tempo_inatividade_segundos) || 120) / 60))
)
async function atualizar() {
  await urn.carregar()
}

async function confirmar() {
  if (carregando.value) return
  carregando.value = true
  erro.value = ''
  try {
    await urn.iniciar()
    router.push({ name: 'votar' })
  } catch (falha) {
    erro.value = falha.message
    toast.erro(falha.message)
  } finally {
    carregando.value = false
  }
}

function continuarSessao() {
  router.push({ name: 'votar' })
}

async function cancelarSessao() {
  const confirmado = await confirm.abrir({
    titulo: 'Cancelar votação em andamento?',
    texto:
      'A sessão atual será encerrada e o eleitor precisará se identificar novamente. Nenhum voto parcial é gravado.',
    confirmLabel: 'Cancelar sessão',
    cancelLabel: 'Manter sessão',
    perigo: true
  })
  if (!confirmado) return
  await urn.cancelar()
  etapa.value = 'form'
  erro.value = ''
}

onMounted(async () => {
  await urn.carregar()
  if (urn.restaurarSessao()) {
    etapa.value = 'retomar'
  }
  atualizacaoTimer = window.setInterval(atualizar, 30000)
  window.addEventListener('focus', atualizar)
})

onUnmounted(() => {
  if (atualizacaoTimer) window.clearInterval(atualizacaoTimer)
  window.removeEventListener('focus', atualizar)
})
</script>

<template>
  <div class="standby">
    <div class="standby-grid">
      <section class="standby-info">
        <div class="standby-selo">
          <Icone nome="cadeado" :tamanho="15" />
          Voto secreto
        </div>
        <h1>Sua voz constrói a escola.</h1>
        <p class="standby-intro">
          Escolha seus representantes com calma. A urna mostra um cargo por vez
          e, ao final, exibe o FIM. Seu voto não é vinculado a você.
        </p>

        <div v-if="eleicao" class="standby-eleicao">
          <StatusBadge :status="status" />
          <h2>{{ eleicao.nome }}</h2>
          <p>{{ eleicao.escola_nome }}</p>
          <span v-if="eleicao.data_eleicao" class="standby-data">
            <Icone nome="relogio" :tamanho="14" />
            {{ dataEleicao }}
          </span>
        </div>

        <ul class="standby-passos">
          <li>
            <span>1</span>
            <div>
              <strong>Inicie a votação</strong>
              <small>Toque no botão quando estiver pronto.</small>
            </div>
          </li>
          <li>
            <span>2</span>
            <div>
              <strong>Vote em cada cargo</strong>
              <small>Digite o número e confirme, ou vote em branco.</small>
            </div>
          </li>
          <li>
            <span>3</span>
            <div>
              <strong>Aguarde o FIM</strong>
              <small>O voto só é registrado no final do percurso.</small>
            </div>
          </li>
        </ul>

        <div class="standby-nota">
          <Icone nome="info" :tamanho="16" />
          <span>
            O comparecimento é registrado separadamente. Não é possível saber em
            quem você votou.
          </span>
        </div>
      </section>

      <section class="standby-card">
        <div v-if="urn.carregando && !eleicao" class="standby-carregando">
          <span class="spinner spinner-grande"></span>
          <p>Carregando a urna...</p>
        </div>

        <div v-else-if="urn.erro && !eleicao" class="standby-status">
          <div class="standby-status-icone erro">
            <Icone nome="alerta" :tamanho="28" />
          </div>
          <h2>Não foi possível conectar</h2>
          <p>{{ urn.erro }}</p>
          <button class="btn btn-primary" type="button" @click="atualizar">
            <Icone nome="atualizar" :tamanho="17" />
            Tentar novamente
          </button>
        </div>

        <EmptyState
          v-else-if="!eleicao"
          icone="urna"
          titulo="Nenhuma eleição disponível"
          texto="A comissão eleitoral ainda não configurou a urna. Aguarde orientações."
        />

        <div v-else-if="status !== 'aberta'" class="standby-status">
          <div class="standby-status-icone" :class="status === 'encerrada' ? 'ok' : 'neutro'">
            <Icone :nome="status === 'encerrada' ? 'check' : 'relogio'" :tamanho="28" />
          </div>
          <StatusBadge :status="status" />
          <h2>{{ statusInfo.label }}</h2>
          <p>{{ statusInfo.descricao }}</p>
          <p v-if="status === 'rascunho'" class="standby-status-ajuda">
            A urna será liberada pela comissão eleitoral.
          </p>
          <p v-else-if="status === 'encerrada'" class="standby-status-ajuda">
            Obrigado pela participação.
          </p>
          <button class="btn btn-ghost" type="button" @click="atualizar">
            <Icone nome="atualizar" :tamanho="16" />
            Atualizar
          </button>
        </div>

        <EmptyState
          v-else-if="!urn.cargos.length"
          icone="config"
          titulo="Urna sem cargos configurados"
          texto="A eleição está aberta, mas ainda não há cargos ativos. Chame o responsável."
        />

        <div v-else-if="etapa === 'retomar'" class="standby-status">
          <div class="standby-status-icone neutro">
            <Icone nome="relogio" :tamanho="28" />
          </div>
          <h2>Votação em andamento</h2>
          <p>Há uma votação iniciada neste aparelho e ainda não concluída.</p>
          <p class="standby-status-ajuda">
            Continue a votação ou cancele a sessão para recomeçar.
          </p>
          <div class="standby-acoes">
            <button class="btn btn-ghost" type="button" @click="cancelarSessao">
              Cancelar sessão
            </button>
            <button class="btn btn-primary" type="button" @click="continuarSessao">
              Continuar votação
              <Icone nome="seta-direita" :tamanho="17" />
            </button>
          </div>
        </div>

        <div v-else-if="urn.eleicaoPausada" class="standby-status">
          <div class="standby-status-icone neutro">
            <Icone nome="relogio" :tamanho="28" />
          </div>
          <h2>Votação pausada</h2>
          <p>A votação foi pausada temporariamente pelo responsável. Aguarde a retomada.</p>
          <p class="standby-status-ajuda">
            Quem já iniciou a votação poderá concluí-la quando a urna for liberada.
          </p>
          <button class="btn btn-ghost" type="button" @click="atualizar">
            <Icone nome="atualizar" :tamanho="16" />
            Atualizar
          </button>
        </div>

        <div v-else class="standby-form-wrap">
          <div class="standby-form-topo">
            <span class="standby-form-kicker">Votação</span>
            <h2>Pronto para votar?</h2>
            <p>
              Você escolherá um candidato para cada cargo. Ao final, a urna mostra
              o FIM. Não é preciso se identificar.
            </p>
          </div>

          <div class="alert alert-info">
            Após iniciar, você terá cerca de {{ tempoMinutos }} minuto(s) para
            concluir a votação. Se o tempo acabar, a sessão será cancelada.
          </div>

          <div v-if="erro" class="alert alert-erro" role="alert">{{ erro }}</div>
          <div v-if="urn.erro" class="alert alert-erro" role="alert">{{ urn.erro }}</div>

          <button
            class="btn btn-primary btn-bloco btn-grande"
            type="button"
            :disabled="carregando"
            @click="confirmar"
          >
            <span v-if="carregando" class="spinner spinner-pequeno"></span>
            <span>{{ carregando ? 'Liberando...' : 'Iniciar votação' }}</span>
            <Icone v-if="!carregando" nome="seta-direita" :tamanho="18" />
          </button>

          <p class="standby-privacidade">
            <Icone nome="cadeado" :tamanho="14" />
            Seu voto é secreto. O sistema não registra quem votou nem em quem votou.
          </p>
        </div>

        <div v-if="eleicao" class="standby-card-rodape">
          <span>{{ eleicao.escola_nome }}</span>
          <span v-if="eleicao.data_eleicao">{{ dataEleicao }}</span>
        </div>
      </section>
    </div>
  </div>
</template>
