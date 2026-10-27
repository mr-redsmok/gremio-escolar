import { createRouter, createWebHistory } from 'vue-router'
import UrnaLayout from '@/layouts/UrnaLayout.vue'
import UrnaView from '@/views/UrnaView.vue'
import VotacaoView from '@/views/VotacaoView.vue'
import AdminLoginView from '@/views/AdminLoginView.vue'
import AdminLayout from '@/layouts/AdminLayout.vue'
import { useAuthStore } from '@/stores/auth.js'
import { STORAGE } from '@/lib/constants.js'

const routes = [
  {
    path: '/',
    component: UrnaLayout,
    children: [
      {
        path: '',
        name: 'urna',
        component: UrnaView,
        meta: { titulo: 'Urna' }
      },
      {
        path: 'votar',
        name: 'votar',
        component: VotacaoView,
        meta: { titulo: 'Votação', requiresSessao: true }
      }
    ]
  },
  {
    path: '/admin/login',
    name: 'admin-login',
    component: AdminLoginView,
    meta: { titulo: 'Acesso administrativo' }
  },
  {
    path: '/admin',
    component: AdminLayout,
    meta: { requiresAdmin: true },
    children: [
      {
        path: '',
        redirect: { name: 'admin-painel' }
      },
      {
        path: 'painel',
        name: 'admin-painel',
        component: () => import('@/views/PainelView.vue'),
        meta: { titulo: 'Painel' }
      },
      {
        path: 'configuracoes',
        name: 'admin-configuracoes',
        component: () => import('@/views/ConfiguracoesView.vue'),
        meta: { titulo: 'Configurações' }
      },
      {
        path: 'votantes',
        name: 'admin-votantes',
        component: () => import('@/views/VotantesView.vue'),
        meta: { titulo: 'Votantes' }
      },
      {
        path: 'relatorios',
        name: 'admin-relatorios',
        component: () => import('@/views/RelatoriosView.vue'),
        meta: { titulo: 'Relatórios' }
      },
      {
        path: 'auditoria',
        name: 'admin-auditoria',
        component: () => import('@/views/AuditoriaView.vue'),
        meta: { titulo: 'Auditoria' }
      }
    ]
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior() {
    return { top: 0 }
  }
})

router.beforeEach((to) => {
  const auth = useAuthStore()

  if (to.meta.requiresAdmin && !auth.isAdmin) {
    return {
      name: 'admin-login',
      query: { redirect: to.fullPath }
    }
  }

  if (to.name === 'admin-login' && auth.isAdmin) {
    return { name: 'admin-painel' }
  }

  if (to.meta.requiresSessao) {
    let temSessao = false
    try {
      temSessao = Boolean(sessionStorage.getItem(STORAGE.sessao))
    } catch {
      temSessao = false
    }
    if (!temSessao) {
      return { name: 'urna' }
    }
  }

  return true
})

router.afterEach((to) => {
  const titulo = to.meta.titulo
    ? `${to.meta.titulo} · Urna Escolar`
    : 'Urna Escolar · Eleição do Grêmio'
  document.title = titulo
})

export default router
