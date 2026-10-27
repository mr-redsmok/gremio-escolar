import { describe, expect, it } from 'vitest'
import { calcularApuracao } from '@/lib/apuracao.js'

const eleicao = {
  id: 'eleicao-1',
  nome: 'Eleição teste',
  total_eleitores_aptos: 8
}

const cargos = [
  { id: 'cargo-2', nome: 'Secretário', ordem: 2, digitos: 2 },
  { id: 'cargo-1', nome: 'Presidente', ordem: 1, digitos: 2 }
]

const candidatos = [
  { id: 'ana', cargo_id: 'cargo-1', numero: '10', nome: 'Ana' },
  { id: 'bruno', cargo_id: 'cargo-1', numero: '20', nome: 'Bruno' },
  { id: 'caio', cargo_id: 'cargo-2', numero: '30', nome: 'Caio' }
]

describe('apuração', () => {
  it('ordena cargos, totaliza votos e calcula percentuais sobre votos válidos', () => {
    const votos = [
      { cargo_id: 'cargo-1', tipo: 'candidato', candidato_id: 'ana' },
      { cargo_id: 'cargo-1', tipo: 'candidato', candidato_id: 'ana' },
      { cargo_id: 'cargo-1', tipo: 'candidato', candidato_id: 'bruno' },
      { cargo_id: 'cargo-1', tipo: 'branco', candidato_id: null },
      { cargo_id: 'cargo-1', tipo: 'nulo', candidato_id: null },
      { cargo_id: 'cargo-2', tipo: 'candidato', candidato_id: 'caio' }
    ]

    const resultado = calcularApuracao({
      eleicao,
      cargos,
      candidatos,
      presencas: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }, { id: 'p4' }, { id: 'p5' }],
      votos
    })

    expect(resultado.cargos.map((cargo) => cargo.id)).toEqual(['cargo-1', 'cargo-2'])

    const presidente = resultado.cargos[0]
    expect(presidente.total_votos).toBe(5)
    expect(presidente.validos).toBe(3)
    expect(presidente.brancos).toBe(1)
    expect(presidente.nulos).toBe(1)
    expect(presidente.candidatos.map((c) => c.id)).toEqual(['ana', 'bruno'])
    expect(presidente.candidatos[0]).toMatchObject({
      votos: 2,
      percentual: 66.67,
      posicao: 1,
      eleito: true
    })
    expect(presidente.candidatos[1]).toMatchObject({
      votos: 1,
      percentual: 33.33,
      posicao: 2,
      eleito: false
    })
    expect(presidente.empate).toBe(false)
    expect(resultado.comparecimento_percentual).toBe(62.5)
    expect(resultado.total_votantes).toBe(5)
  })

  it('marca empate quando dois candidatos lideram com votos', () => {
    const votos = [
      { cargo_id: 'cargo-1', tipo: 'candidato', candidato_id: 'ana' },
      { cargo_id: 'cargo-1', tipo: 'candidato', candidato_id: 'bruno' }
    ]

    const resultado = calcularApuracao({ eleicao, cargos, candidatos, votos })
    const presidente = resultado.cargos[0]

    expect(presidente.empate).toBe(true)
    expect(presidente.candidatos.every((c) => !c.eleito)).toBe(true)
    expect(presidente.candidatos.every((c) => c.empate)).toBe(true)
  })

  it('não declara vencedor nem empate quando não há votos válidos', () => {
    const resultado = calcularApuracao({
      eleicao,
      cargos,
      candidatos,
      votos: [{ cargo_id: 'cargo-1', tipo: 'branco', candidato_id: null }]
    })
    const presidente = resultado.cargos[0]

    expect(presidente.total_votos).toBe(1)
    expect(presidente.validos).toBe(0)
    expect(presidente.empate).toBe(false)
    expect(presidente.candidatos.every((c) => c.percentual === 0 && !c.eleito)).toBe(true)
  })

  it('calcula zerésima com todos os candidatos em zero', () => {
    const resultado = calcularApuracao({ eleicao, cargos, candidatos })

    expect(resultado.total_votantes).toBe(0)
    expect(resultado.comparecimento_percentual).toBe(0)
    expect(resultado.cargos.every((cargo) => cargo.total_votos === 0)).toBe(true)
    expect(
      resultado.cargos.every((cargo) => cargo.candidatos.every((c) => c.votos === 0))
    ).toBe(true)
  })

  it('retorna comparecimento nulo quando o total de aptos não foi informado', () => {
    const resultado = calcularApuracao({
      eleicao: { ...eleicao, total_eleitores_aptos: null },
      cargos,
      candidatos,
      presencas: [{ id: 'p1' }]
    })

    expect(resultado.comparecimento_percentual).toBeNull()
  })

  it('marca o resultado como parcial sem alterar os dados de entrada', () => {
    const cargosOriginais = structuredClone(cargos)
    const resultado = calcularApuracao({
      eleicao,
      cargos,
      candidatos,
      parcial: true
    })

    expect(resultado.parcial).toBe(true)
    expect(cargos).toEqual(cargosOriginais)
    expect(resultado.cargos[0]).not.toBe(cargos[1])
  })
})
