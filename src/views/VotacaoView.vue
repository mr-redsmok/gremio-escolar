<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUrnaStore } from '@/stores/urna.js'
import { useConfirmStore } from '@/stores/confirm.js'
import { useToastStore } from '@/stores/toast.js'
import {
  tocarBranco,
  tocarConfirmacao,
  tocarErro,
  tocarFim,
  tocarTecla
} from '@/lib/audio.js'
import Icone from '@/components/Icone.vue'
import NumerosVoto from '@/components/urna/NumerosVoto.vue'
import CartaoCandidato from '@/components/urna/CartaoCandidato.vue'
import TecladoUrna from '@/components/urna/TecladoUrna.vue'
import OverlayConfirmacao from '@/components/urna/OverlayConfirmacao.vue'
import TelaFim from '@/components/urna/TelaFim.vue'

const urn = useUrnaStore()
const confirm = useConfirmStore()
const toast = useToastStore()
const router = useRouter()

const overlay = ref(false)
const mensagem = ref('')
const restante = ref(null)
const carregando = ref(true)
let timerOverlay = null
let timerFim = null
let timerContador = null
let timerPausa = null

const cargo = computed(() => urn.cargoAtual)
const finalizando = computed(() => urn.estado.etapa === 'fim')
const som = computed(() => urn.eleicao?.som_ativo !== false)
const segundosInatividade = computed(
  () => Number(urn.eleicao?.tempo_inatividade_segundos) || 120
)

function limparTimers() {
  if (timerPausa) window.clearInterval(timerPausa)
  timerPausa = null
  if (timerOverlay) window.clearTimeout(timerOverlay)
  if (timerFim) window.clearTimeout(timerFim)
  if (timerContador) window.clearInterval(timerContador)
  timerOverlay = null
  timerFim = null
  timerContador = null
}

function pararContador() {
  if (timerContador) window.clearInterval(timerContador)
  timerContador = null
  restante.value = null
}

function tic() {
  if (overlay.value || finalizando.value || urn.processando || urn.eleicaoPausada) return
  if (restante.value == null) return
  restante.value -= 1
  if (restante.value <= 0) {
    pararContador()
    cancelarPorInatividade()
  }
}

function resetContador() {
  if (overlay.value || finalizando.value) return
  restante.value = segundosInatividade.value
  if (!timerContador) {
    timerContador = window.setInterval(tic, 1000)
  }
}

function iniciarContador() {
  pararContador()
  resetContador()
}

async function cancelarPorInatividade() {
  if (urn.finalizado) return
  await urn.cancelar()
  toast.info('Votação cancelada por inatividade. Inicie novamente.')
  router.replace({ name: 'urna' })
}

function digitar(digito) {
  if (overlay.value || finalizando.value || urn.processando) return
  urn.digitar(digito)
  mensagem.value = ''
  if (som.value) tocarTecla()
  resetContador()
}

function corrigir() {
  if (overlay.value || finalizando.value || urn.processando) return
  urn.corrigir()
  mensagem.value = ''
  if (som.value) tocarTecla()
  resetContador()
}

function branco() {
  if (overlay.value || finalizando.value || urn.processando) return
  const resultado = urn.branco()
  if (resultado.evento === 'erro') {
    mensagem.value = resultado.erro
    if (som.value) tocarErro()
  } else {
    mensagem.value = ''
    if (som.value) tocarBranco()
  }
  resetContador()
}

function confirmar() {
  if (overlay.value || finalizando.value || urn.processando) return
  const resultado = urn.confirmar()
  resetContador()

  if (resultado.evento === 'erro' || resultado.evento === 'aviso') {
    mensagem.value = resultado.erro
    if (som.value) tocarErro()
    return
  }

  if (resultado.evento === 'confirmado') {
    mensagem.value = ''
    mostrarOverlay()
  }
}

function mostrarOverlay() {
  overlay.value = true
  pararContador()
  if (som.value) tocarConfirmacao()

  timerOverlay = window.setTimeout(() => {
    overlay.value = false
    if (urn.estado.etapa === 'fim') {
      if (som.value) tocarFim()
      iniciarFinalizacao()
    } else {
      resetContador()
    }
  }, 1600)
}

async function iniciarFinalizacao() {
  if (timerFim) window.clearTimeout(timerFim)
  const resultado = await urn.finalizar()
  if (resultado.ok) {
    timerFim = window.setTimeout(() => {
      urn.reset()
      router.replace({ name: 'urna' })
    }, 5000)
  }
}

function tentarNovamente() {
  iniciarFinalizacao()
}

async function voltarInicio() {
  await urn.cancelar()
  router.replace({ name: 'urna' })
}

async function cancelarVotacao() {
  if (overlay.value || urn.processando) return
  const confirmado = await confirm.abrir({
    titulo: 'Cancelar votação?',
    texto:
      'Os votos já confirmados nesta sessão serão descartados. Você poderá recomeçar do início.',
    confirmLabel: 'Cancelar votação',
    cancelLabel: 'Continuar votando',
    perigo: true
  })
  if (!confirmado) return
  await urn.cancelar()
  router.replace({ name: 'urna' })
}

function aoTeclar(event) {
  if (overlay.value || finalizando.value || urn.processando) return

  if (event.key >= '0' && event.key <= '9') {
    event.preventDefault()
    digitar(event.key)
    return
  }

  if (event.key === 'Backspace') {
    event.preventDefault()
    corrigir()
    return
  }

  if (event.key === 'Enter') {
    event.preventDefault()
    confirmar()
    return
  }

  const tecla = event.key.toLowerCase()
  if (tecla === 'b') {
    event.preventDefault()
    branco()
  } else if (tecla === 'c') {
    event.preventDefault()
    corrigir()
  }
}

function antesDeSair(event) {
  if (urn.finalizado) return
  event.preventDefault()
  event.returnValue = ''
}

onMounted(async () => {
  await urn.carregar()
  timerPausa = window.setInterval(() => urn.carregar(), 10000)

  if (!urn.temSessao) {
    const restaurou = urn.restaurarSessao()
    if (!restaurou) {
      router.replace({ name: 'urna' })
      return
    }
  }

  if (!urn.cargos.length) {
    router.replace({ name: 'urna' })
    return
  }

  carregando.value = false
  iniciarContador()
  window.addEventListener('keydown', aoTeclar)
  window.addEventListener('beforeunload', antesDeSair)
})

onUnmounted(() => {
  limparTimers()
  window.removeEventListener('keydown', aoTeclar)
  window.removeEventListener('beforeunload', antesDeSair)
})
</script>

<template>
  <div v-if="carregando" class="votacao-carregando">
    <span class="spinner spinner-grande"></span>
    <p>Preparando a urna...</p>
  </div>

  <div v-else-if="!cargo" class="votacao-indisponivel">
    <div class="standby-status-icone erro">
      <Icone nome="alerta" :tamanho="30" />
    </div>
    <h1>Votação indisponível</h1>
    <p>A sessão não está mais válida ou a eleição foi encerrada.</p>
    <button class="btn btn-primary" type="button" @click="voltarInicio">
      Voltar ao início
    </button>
  </div>

  <div v-else class="votacao">
    <div v-if="urn.eleicaoPausada" class="alert alert-aviso votacao-pausa">
      <Icone nome="relogio" :tamanho="18" />
      <span>
        Votação pausada pelo responsável. O tempo está parado e a sua cédula continua
        salva. Você pode concluir o voto quando a votação for retomada.
      </span>
    </div>

    <div class="votacao-cabecalho">
      <div class="votacao-cargo">
        <span class="votacao-kicker">
          Voto {{ urn.numeroCargo }} de {{ urn.totalCargos }}
        </span>
        <h1>{{ cargo.nome }}</h1>
        <p v-if="cargo.descricao">{{ cargo.descricao }}</p>
        <div class="progresso-cargos" aria-hidden="true">
          <span
            v-for="(item, indice) in urn.cargos"
            :key="item.id"
            :class="{
              concluido: indice < urn.estado.indice,
              atual: indice === urn.estado.indice
            }"
          ></span>
        </div>
      </div>

      <div class="votacao-sessao">
        <div
          v-if="restante != null"
          class="votacao-contador"
          :class="{ alerta: restante <= 30 }"
          :title="'Tempo restante antes do cancelamento por inatividade'"
        >
          <Icone nome="relogio" :tamanho="17" />
          <span>{{ restante }}s</span>
        </div>
      </div>
    </div>

    <div class="votacao-corpo">
      <section class="votacao-esquerda" aria-label="Cédula de votação">
        <div class="votacao-instrucao">
          <div>
            <h2>Digite o número do seu candidato</h2>
            <p>Confira o número e pressione CONFIRMA. Para votar em branco, use BRANCO.</p>
          </div>
          <span class="votacao-digitos">{{ cargo.digitos }} dígitos</span>
        </div>

        <NumerosVoto
          :digitos="cargo.digitos"
          :numero="urn.estado.numero"
          :tipo="urn.estado.tipo"
          :aviso-nulo="urn.estado.avisoNulo"
        />

        <CartaoCandidato
          :cargo="cargo"
          :numero="urn.estado.numero"
          :candidato="urn.candidatoAtual"
          :tipo="urn.estado.tipo"
          :aviso-nulo="urn.estado.avisoNulo"
        />

        <div v-if="mensagem" class="alerta-voto" role="alert">
          <Icone nome="alerta" :tamanho="18" />
          <span>{{ mensagem }}</span>
        </div>
      </section>

      <aside class="votacao-direita" aria-label="Teclado da urna">
        <TecladoUrna
          :desabilitado="overlay || finalizando || urn.processando"
          :permite-branco="cargo.permite_branco"
          @digito="digitar"
          @branco="branco"
          @corrige="corrigir"
          @confirma="confirmar"
        />
        <button class="link-cancelar" type="button" @click="cancelarVotacao">
          Cancelar votação
        </button>
      </aside>
    </div>

    <OverlayConfirmacao :aberto="overlay" :voto="urn.estado.ultimoVoto" />

    <TelaFim
      v-if="finalizando"
      :processando="urn.processando"
      :erro="urn.erroVoto"
      :protocolo="urn.protocolo"
      :finalizado="urn.finalizado"
      @tentar="tentarNovamente"
      @sair="voltarInicio"
    />
  </div>
</template>
