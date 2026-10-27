import { defineStore } from 'pinia'

let resolverAtual = null

export const useConfirmStore = defineStore('confirm', {
  state: () => ({
    aberto: false,
    titulo: 'Confirmar ação',
    texto: '',
    confirmLabel: 'Confirmar',
    cancelLabel: 'Cancelar',
    perigo: false
  }),
  actions: {
    abrir({
      titulo = 'Confirmar ação',
      texto = '',
      confirmLabel = 'Confirmar',
      cancelLabel = 'Cancelar',
      perigo = false
    } = {}) {
      if (resolverAtual) {
        resolverAtual(false)
        resolverAtual = null
      }

      this.titulo = titulo
      this.texto = texto
      this.confirmLabel = confirmLabel
      this.cancelLabel = cancelLabel
      this.perigo = Boolean(perigo)
      this.aberto = true

      return new Promise((resolve) => {
        resolverAtual = resolve
      })
    },
    responder(valor) {
      this.aberto = false
      const resolver = resolverAtual
      resolverAtual = null
      if (resolver) resolver(Boolean(valor))
    }
  }
})
