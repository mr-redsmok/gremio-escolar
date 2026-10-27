import { beforeEach, describe, expect, it } from 'vitest'
import { DEMO_ADMIN } from '@/lib/constants.js'
import * as demo from '@/lib/demoService.js'

async function criarRascunho() {
  const atual = (await demo.getAdminData()).eleicao
  if (atual.status === 'aberta') await demo.encerrarEleicao(atual.id)
  const criada = await demo.novaEleicao({
    escola_nome: 'Escola Teste',
    nome: 'Eleição Teste',
    data_eleicao: '2026-10-27'
  })
  return criada.eleicao
}

describe('serviço local de demonstração', () => {
  beforeEach(async () => {
    localStorage.clear()
    sessionStorage.clear()
    await demo.login(DEMO_ADMIN.email, DEMO_ADMIN.senha)
    await demo.resetDemo()
  })

  it('registra todos os cargos e o comparecimento sem permitir novo voto', async () => {
    const publico = await demo.getEstadoPublico()
    const eleitor = await demo.liberarEleitor(
      publico.eleicao.id,
      'João D’Ávila',
      '9º A'
    )
    const votos = publico.cargos.map((cargo, indice) =>
      indice === 0
        ? {
            cargo_id: cargo.id,
            tipo: 'candidato',
            candidato_id: cargo.candidatos[0].id
          }
        : { cargo_id: cargo.id, tipo: 'branco', candidato_id: null }
    )

    const registro = await demo.registrarVoto(eleitor.token, votos)
    expect(registro.protocolo).toBeTruthy()

    const repetido = await demo.registrarVoto(eleitor.token, votos)
    expect(repetido.ja_registrado).toBe(true)

    const apuracao = await demo.apurar(publico.eleicao.id, true)
    expect(apuracao.parcial).toBe(true)
    expect(apuracao.total_votantes).toBe(1)
    expect(apuracao.cargos[0].validos).toBe(1)
    expect(apuracao.cargos[1].brancos).toBe(1)

    const presencas = await demo.listarPresencas(publico.eleicao.id)
    expect(presencas).toHaveLength(1)
    expect(presencas[0].nome_eleitor).toBe('João D’Ávila')

    await expect(
      demo.liberarEleitor(publico.eleicao.id, 'joão d’ávila', '9A')
    ).rejects.toThrow('já votaram')
  })

  it('distingue apuração parcial de apuração oficial', async () => {
    const { eleicao } = await demo.getAdminData()

    await expect(demo.apurar(eleicao.id, false)).rejects.toThrow('não foi encerrada')
    await demo.encerrarEleicao(eleicao.id)

    const oficial = await demo.apurar(eleicao.id, false)
    expect(oficial.parcial).toBe(false)
  })

  it('mantém o motivo informado ao reabrir a eleição', async () => {
    const { eleicao } = await demo.getAdminData()
    await demo.encerrarEleicao(eleicao.id)
    await demo.reabrirEleicao(eleicao.id, 'Reabertura de teste')

    const auditoria = await demo.listarAuditoria(eleicao.id)
    const evento = auditoria.find((item) => item.acao === 'eleicao_reaberta')
    expect(evento.detalhes.motivo).toBe('Reabertura de teste')
  })

  it('salva a configuração da eleição em rascunho', async () => {
    const eleicao = await criarRascunho()

    await demo.salvarEleicao(eleicao.id, {
      escola_nome: 'Escola Atualizada',
      tempo_inatividade_segundos: 180
    })

    const dados = await demo.getAdminData()
    expect(dados.eleicao.escola_nome).toBe('Escola Atualizada')
    expect(dados.eleicao.tempo_inatividade_segundos).toBe(180)
  })
})
