import { defineStore } from 'pinia'

export const useToastStore = defineStore('toast', {
  state: () => ({
    itens: [],
    sequencia: 0
  }),
  actions: {
    show(mensagem, tipo = '', duracao = 4200) {
      const texto = String(mensagem ?? '').trim()
      if (!texto) return
      this.sequencia += 1
      const id = this.sequencia
      this.itens.push({ id, mensagem: texto, tipo })
      window.setTimeout(() => this.remove(id), duracao)
    },
    sucesso(mensagem) {
      this.show(mensagem, 'sucesso')
    },
    erro(mensagem) {
      this.show(mensagem, 'erro', 6000)
    },
    info(mensagem) {
      this.show(mensagem, 'info')
    },
    remove(id) {
      this.itens = this.itens.filter((item) => item.id !== id)
    }
  }
})
