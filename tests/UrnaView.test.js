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

  it('mostra os erros de validação e avança com os dados normalizados', async () => {
    const wrapper = mount(UrnaView)
    await flushPromises()

    await wrapper.find('#eleitor-nome').setValue('Maria')
    await wrapper.find('#eleitor-turma').setValue('9º A')
    await wrapper.find('form.standby-form').trigger('submit')

    expect(wrapper.find('.field-error').text()).toContain('nome e sobrenome')
    expect(wrapper.text()).toContain('Vamos começar')

    await wrapper.find('#eleitor-nome').setValue('  Maria   Fernanda ')
    await wrapper.find('#eleitor-turma').setValue(' 9º  A ')
    await wrapper.find('form.standby-form').trigger('submit')

    expect(wrapper.text()).toContain('Confirme seus dados')
    expect(wrapper.find('.confirmacao-dados').text()).toContain('Maria Fernanda')
    expect(wrapper.find('.confirmacao-dados').text()).toContain('9º A')

    wrapper.unmount()
  })
})
