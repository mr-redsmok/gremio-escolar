import { defineStore } from 'pinia'
import { service } from '@/lib/service.js'

function ordenarCargos(cargos) {
  return [...cargos].sort(
    (a, b) =>
      Number(a.ordem) - Number(b.ordem) ||
      String(a.nome).localeCompare(String(b.nome), 'pt-BR')
  )
}

function ordenarCandidatos(candidatos) {
  return [...candidatos].sort((a, b) =>
    String(a.numero).localeCompare(String(b.numero))
  )
}

export const useEleicaoStore = defineStore('eleicao', {
  state: () => ({
    eleicao: null,
    cargos: [],
    candidatos: [],
    carregando: false,
    carregado: false,
    erro: ''
  }),
  getters: {
    temEleicao: (state) => Boolean(state.eleicao),
    status: (state) => state.eleicao?.status || null,
    podeEditar: (state) => state.eleicao?.status === 'rascunho',
    cargosComCandidatos: (state) =>
      ordenarCargos(state.cargos).map((cargo) => ({
        ...cargo,
        candidatos: ordenarCandidatos(
          state.candidatos.filter((c) => c.cargo_id === cargo.id)
        )
      })),
    totalCargos: (state) => state.cargos.length,
    totalCandidatos: (state) => state.candidatos.length,
    candidatosDoCargo: (state) => (cargoId) =>
      ordenarCandidatos(state.candidatos.filter((c) => c.cargo_id === cargoId))
  },
  actions: {
    async carregar(forcar = false) {
      if (!service) return
      if (this.carregando) return
      if (this.carregado && !forcar) return

      this.carregando = true
      this.erro = ''
      try {
        const dados = await service.getAdminData()
        this.eleicao = dados.eleicao
        this.cargos = ordenarCargos(dados.cargos || [])
        this.candidatos = ordenarCandidatos(dados.candidatos || [])
        this.carregado = true
      } catch (erro) {
        this.erro = erro.message
      } finally {
        this.carregando = false
      }
    },
    async recarregar() {
      await this.carregar(true)
    },
    async salvarEleicao(patch) {
      if (!this.eleicao) throw new Error('Nenhuma eleição configurada.')
      const atualizada = await service.salvarEleicao(this.eleicao.id, patch)
      this.eleicao = { ...this.eleicao, ...atualizada }
      return atualizada
    },
    async criarCargo(dados) {
      if (!this.eleicao) throw new Error('Nenhuma eleição configurada.')
      const cargo = await service.criarCargo({
        ...dados,
        eleicao_id: this.eleicao.id
      })
      this.cargos = ordenarCargos([...this.cargos, cargo])
      return cargo
    },
    async atualizarCargo(cargoId, dados) {
      if (!this.eleicao) throw new Error('Nenhuma eleição configurada.')
      const cargo = await service.atualizarCargo(cargoId, {
        ...dados,
        eleicao_id: this.eleicao.id
      })
      this.cargos = ordenarCargos(
        this.cargos.map((c) => (c.id === cargoId ? cargo : c))
      )
      return cargo
    },
    async removerCargo(cargoId) {
      if (!this.eleicao) throw new Error('Nenhuma eleição configurada.')
      await service.removerCargo(cargoId, this.eleicao.id)
      this.cargos = this.cargos.filter((c) => c.id !== cargoId)
      this.candidatos = this.candidatos.filter((c) => c.cargo_id !== cargoId)
    },
    async reordenarCargos(ids) {
      if (!this.eleicao) throw new Error('Nenhuma eleição configurada.')
      await service.reordenarCargos(ids, this.eleicao.id)
      const mapa = new Map(this.cargos.map((c) => [c.id, c]))
      this.cargos = ordenarCargos(
        ids.map((id, indice) => ({ ...mapa.get(id), ordem: indice + 1 }))
      )
    },
    async criarCandidato(dados) {
      if (!this.eleicao) throw new Error('Nenhuma eleição configurada.')
      const candidato = await service.criarCandidato({
        ...dados,
        eleicao_id: this.eleicao.id
      })
      this.candidatos = ordenarCandidatos([...this.candidatos, candidato])
      return candidato
    },
    async atualizarCandidato(candidatoId, dados) {
      if (!this.eleicao) throw new Error('Nenhuma eleição configurada.')
      const candidato = await service.atualizarCandidato(candidatoId, {
        ...dados,
        eleicao_id: this.eleicao.id
      })
      this.candidatos = ordenarCandidatos(
        this.candidatos.map((c) => (c.id === candidatoId ? candidato : c))
      )
      return candidato
    },
    async removerCandidato(candidatoId) {
      if (!this.eleicao) throw new Error('Nenhuma eleição configurada.')
      await service.removerCandidato(candidatoId, this.eleicao.id)
      this.candidatos = this.candidatos.filter((c) => c.id !== candidatoId)
    },
    async abrir() {
      if (!this.eleicao) throw new Error('Nenhuma eleição configurada.')
      const resultado = await service.abrirEleicao(this.eleicao.id)
      await this.recarregar()
      return resultado
    },
    async encerrar() {
      if (!this.eleicao) throw new Error('Nenhuma eleição configurada.')
      const resultado = await service.encerrarEleicao(this.eleicao.id)
      await this.recarregar()
      return resultado
    },
    async reabrir(motivo = '') {
      if (!this.eleicao) throw new Error('Nenhuma eleição configurada.')
      const resultado = await service.reabrirEleicao(this.eleicao.id, motivo)
      await this.recarregar()
      return resultado
    },
    async excluir() {
      if (!this.eleicao) throw new Error('Nenhuma eleição configurada.')
      const resultado = await service.excluirEleicao(this.eleicao.id)
      await this.carregar(true)
      return resultado
    },
    async nova(dados) {
      const resultado = await service.novaEleicao(dados)
      await this.recarregar()
      return resultado
    }
  }
})
