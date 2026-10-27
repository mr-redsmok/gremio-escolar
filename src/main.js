import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router/index.js'
import { useAuthStore } from './stores/auth.js'
import './styles/base.css'
import './styles/urna.css'
import './styles/admin.css'

async function iniciar() {
  const app = createApp(App)
  const pinia = createPinia()

  app.use(pinia)

  const auth = useAuthStore(pinia)
  await auth.init()

  app.use(router)
  await router.isReady()
  app.mount('#app')
}

iniciar().catch((erro) => {
  console.error('Não foi possível iniciar a aplicação.', erro)
})
