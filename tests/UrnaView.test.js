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

describe('identificação na tela da urna', () => {
  beforeEach(async () => {
    localStorage.clear()
    sessionStorage.clear()
    setActivePinia(createPinia())
    await demo.login(DEMO_ADMIN.email, DEMO_ADMIN.senha)
    await demo.resetDemo()
    push.mockReset()
  })

  it('mostra o erro quando o nome está vazio e avança com o primeiro nome', async () => {
    const wrapper = mount(UrnaView)
    await flushPromises()

    await wrapper.find('form.standby-form').trigger('submit')

    expect(wrapper.find('.field-error').text()).toContain('primeiro nome')
    expect(wrapper.text()).toContain('Vamos começar')

    await wrapper.find('#eleitor-nome').setValue('  Maria  ')
    await wrapper.find('form.standby-form').trigger('submit')

    expect(wrapper.text()).toContain('Confirme seus dados')
    expect(wrapper.find('.confirmacao-dados').text()).toContain('Maria')
    expect(wrapper.find('#eleitor-turma').exists()).toBe(false)

    wrapper.unmount()
  })
})
