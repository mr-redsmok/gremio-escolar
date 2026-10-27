import { defineStore } from 'pinia'
import { isDemo, service, serviceMode } from '@/lib/service.js'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    admin: null,
    loading: true,
    erro: '',
    inicializado: false
  }),
  getters: {
    isAdmin: (state) => Boolean(state.admin && state.admin.papel === 'admin'),
    semPermissao: (state) => Boolean(state.user && !state.admin),
    nome: (state) => state.admin?.nome || state.user?.email || 'Administrador',
    email: (state) => state.user?.email || '',
    modo: () => serviceMode,
    demo: () => isDemo
  },
  actions: {
    async init() {
      if (this.inicializado) return

      if (!service) {
        this.loading = false
        this.inicializado = true
        return
      }

      try {
        const sessao = await service.getSession()
        if (sessao) {
          this.user = sessao.user
          this.admin = sessao.admin
        }
      } catch (erro) {
        this.erro = erro.message
      } finally {
        this.loading = false
        this.inicializado = true
      }

      if (service.onAuthStateChange) {
        service.onAuthStateChange(({ user, admin }) => {
          this.user = user
          this.admin = admin
          this.loading = false
        })
      }
    },
    async login(email, senha) {
      if (!service) {
        throw new Error('Supabase não configurado.')
      }
      this.loading = true
      this.erro = ''
      try {
        const resultado = await service.login(email, senha)
        this.user = resultado.user
        this.admin = resultado.admin
        return resultado
      } catch (erro) {
        this.erro = erro.message
        throw erro
      } finally {
        this.loading = false
      }
    },
    async logout() {
      try {
        if (service) await service.logout()
      } finally {
        this.user = null
        this.admin = null
      }
    }
  }
})
