import { defineStore } from 'pinia'
import { service } from '@/lib/service.js'
import { STORAGE } from '@/lib/constants.js'
import {
  candidatoDoNumero,
  cargoAtual as obterCargoAtual,
  confirmar as confirmarMaquina,
  corrigir as corrigirMaquina,
  criarEstadoUrna,
  digitar as digitarMaquina,
  votarBranco
} from '@/lib/urnaMachine.js'

function lerSessaoPersistida(ignorarExpiracao = false) {
  try {
    const bruto = sessionStorage.getItem(STORAGE.sessao)
    if (!bruto) return null
    const sessao = JSON.parse(bruto)
    if (!sessao?.token || !sessao?.expira_em) return null
    if (!ignorarExpiracao && new Date(sessao.expira_em).getTime() <= Date.now()) {
      sessionStorage.removeItem(STORAGE.sessao)
      return null
    }
    return sessao
  } catch {
    return null
  }
}

export const useUrnaStore = defineStore('urna', {
  state: () => ({
    estadoPublico: { eleicao: null, cargos: [] },
    carregando: false,
    erro: '',
    sessao: null,
    estado: criarEstadoUrna(),
    processando: false,
    erroVoto: '',
    protocolo: '',
    finalizado: false
  }),
  getters: {
    eleicao: (state) => state.estadoPublico.eleicao,
    cargos: (state) => state.estadoPublico.cargos || [],
    cargoAtual: (state) => obterCargoAtual(state.estado, state.estadoPublico.cargos || []),
    candidatoAtual: (state) => {
      const cargo = obterCargoAtual(state.estado, state.estadoPublico.cargos || [])
      return candidatoDoNumero(cargo, state.estado.numero)
    },
    totalCargos: (state) => (state.estadoPublico.cargos || []).length,
    numeroCargo: (state) => Math.min(state.estado.indice + 1, state.estadoPublico.cargos?.length || 1),
    eleicaoAberta: (state) => state.estadoPublico.eleicao?.status === 'aberta',
    temSessao: (state) => Boolean(state.sessao?.token),
    eleicaoPausada: (state) =>
      state.estadoPublico.eleicao?.status === 'aberta' &&
      Boolean(state.estadoPublico.eleicao?.pausada)
  },
  actions: {
    async carregar() {
      if (!service) return
      if (this.carregando) return
      this.carregando = true
      this.erro = ''
      try {
        const dados = await service.getEstadoPublico()
        this.estadoPublico = dados || { eleicao: null, cargos: [] }
      } catch (erro) {
        this.erro = erro.message
      } finally {
        this.carregando = false
      }
    },
    async iniciar() {
      if (!this.eleicao) throw new Error('Nenhuma eleição disponível.')
      if (this.eleicao.status !== 'aberta') {
        throw new Error('A votação não está aberta.')
      }

      const resposta = await service.liberarEleitor(this.eleicao.id, '', '')
      this.sessao = {
        ...resposta,
        eleicao_id: this.eleicao.id
      }
      this.estado = criarEstadoUrna()
      this.protocolo = ''
      this.erroVoto = ''
      this.finalizado = false
      this.persistirSessao()
      return this.sessao
    },
    restaurarSessao() {
      const sessao = lerSessaoPersistida(Boolean(this.eleicao?.pausada))
      if (!sessao) return false
      if (this.eleicao?.id && sessao.eleicao_id && sessao.eleicao_id !== this.eleicao.id) {
        this.limparSessao()
        return false
      }
      this.sessao = sessao
      this.estado = criarEstadoUrna()
      this.protocolo = ''
      this.erroVoto = ''
      this.finalizado = false
      return true
    },
    persistirSessao() {
      if (!this.sessao) return
      try {
        sessionStorage.setItem(STORAGE.sessao, JSON.stringify(this.sessao))
      } catch {
        /* sessionStorage indisponível */
      }
    },
    limparSessao() {
      this.sessao = null
      try {
        sessionStorage.removeItem(STORAGE.sessao)
      } catch {
        /* sessionStorage indisponível */
      }
    },
    digitar(digito) {
      this.estado = digitarMaquina(this.estado, this.cargoAtual, digito)
    },
    corrigir() {
      this.estado = corrigirMaquina(this.estado)
    },
    branco() {
      const resultado = votarBranco(this.estado, this.cargoAtual)
      this.estado = resultado.estado
      return resultado
    },
    confirmar() {
      const resultado = confirmarMaquina(this.estado, this.cargos)
      this.estado = resultado.estado
      return resultado
    },
    async finalizar() {
      if (this.finalizado) return { ok: true }
      if (this.processando) return { ok: false, erro: 'Aguarde o registro do voto.' }
      if (!this.sessao?.token) {
        this.erroVoto = 'Sessão de votação não encontrada.'
        return { ok: false, erro: this.erroVoto }
      }
      if (!this.estado.votos.length) {
        this.erroVoto = 'Nenhum voto foi registrado.'
        return { ok: false, erro: this.erroVoto }
      }

      this.processando = true
      this.erroVoto = ''
      try {
        const resposta = await service.registrarVoto(
          this.sessao.token,
          this.estado.votos
        )
        this.protocolo = resposta?.protocolo || ''
        this.finalizado = true
        this.limparSessao()
        return { ok: true, ...resposta }
      } catch (erro) {
        this.erroVoto = erro.message
        return { ok: false, erro: erro.message }
      } finally {
        this.processando = false
      }
    },
    async cancelar() {
      const token = this.sessao?.token
      this.reset()
      if (token && service) {
        try {
          await service.cancelarSessao(token)
        } catch {
          /* melhor esforço */
        }
      }
    },
    reset() {
      this.sessao = null
      this.estado = criarEstadoUrna()
      this.processando = false
      this.erroVoto = ''
      this.protocolo = ''
      this.finalizado = false
      try {
        sessionStorage.removeItem(STORAGE.sessao)
      } catch {
        /* sessionStorage indisponível */
      }
    }
  }
})
