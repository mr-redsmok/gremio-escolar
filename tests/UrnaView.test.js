import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import UrnaView from '@/views/UrnaView.vue'
import { DEMO_ADMIN } from '@/lib/constants.js'
import * as demo from '@/lib/demoService.js'

const { push } = vi.hoisted(() => ({ push: vi.fn() }))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push })
}))

describe('início da votação na tela da urna', () => {
  beforeEach(async () => {
    localStorage.clear()
    sessionStorage.clear()
    setActivePinia(createPinia())
    await demo.login(DEMO_ADMIN.email, DEMO_ADMIN.senha)
    await demo.resetDemo()
    push.mockReset()
  })

  it('inicia a votação sem pedir identificação e abre a tela de votação', async () => {
    const wrapper = mount(UrnaView)
    await flushPromises()

    expect(wrapper.find('input').exists()).toBe(false)
    expect(wrapper.text()).toContain('Pronto para votar?')

    const botao = wrapper.findAll('button').find((b) => b.text().includes('Iniciar votação'))
    await botao.trigger('click')
    await flushPromises()

    expect(push).toHaveBeenCalledWith({ name: 'votar' })

    wrapper.unmount()
  })
})
