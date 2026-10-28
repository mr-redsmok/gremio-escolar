import { describe, expect, it } from 'vitest'
import {
  validarCandidato,
  validarCargo,
  validarEleicao,
  validarIdentificacao
} from '@/lib/validators.js'

describe('validação da eleição', () => {
  const dadosValidos = {
    escola_nome: 'Escola Municipal',
    nome: 'Eleição do Grêmio',
    digitos_padrao: 2,
    tempo_inatividade_segundos: 120,
    total_eleitores_aptos: 300
  }

  it('aceita dados válidos e total de aptos opcional', () => {
    expect(validarEleicao(dadosValidos).ok).toBe(true)
    expect(validarEleicao({ ...dadosValidos, total_eleitores_aptos: '' }).ok).toBe(true)
    expect(validarEleicao({ ...dadosValidos, total_eleitores_aptos: null }).ok).toBe(true)
  })

  it('exige escola e nome da eleição', () => {
    const resultado = validarEleicao({ ...dadosValidos, escola_nome: ' ', nome: '' })

    expect(resultado.ok).toBe(false)
    expect(resultado.erros.escola_nome).toBeTruthy()
    expect(resultado.erros.nome).toBeTruthy()
  })

  it.each([1, 5, 2.5, 'abc'])('rejeita quantidade de dígitos inválida: %s', (digitos) => {
    expect(validarEleicao({ ...dadosValidos, digitos_padrao: digitos }).ok).toBe(false)
  })

  it.each([29, 601, 30.5])('rejeita inatividade fora do intervalo: %s', (tempo) => {
    expect(
      validarEleicao({ ...dadosValidos, tempo_inatividade_segundos: tempo }).ok
    ).toBe(false)
  })

  it.each([-1, 1.5, 'abc'])('rejeita total de aptos inválido: %s', (aptos) => {
    expect(validarEleicao({ ...dadosValidos, total_eleitores_aptos: aptos }).ok).toBe(false)
  })
})

describe('validação de cargos', () => {
  const cargos = [
    { id: 'c1', nome: 'Presidente' },
    { id: 'c2', nome: 'Secretário' }
  ]

  it('aceita um cargo válido', () => {
    const resultado = validarCargo({ nome: 'Tesoureiro', ordem: 3, digitos: 2 }, cargos)
    expect(resultado.ok).toBe(true)
  })

  it('impede nomes duplicados sem diferenciar maiúsculas', () => {
    const resultado = validarCargo({ nome: ' presidente ', ordem: 1, digitos: 2 }, cargos)
    expect(resultado.erros.nome).toBeTruthy()
  })

  it('permite manter o próprio nome durante a edição', () => {
    const resultado = validarCargo(
      { nome: 'Presidente', ordem: 1, digitos: 2 },
      cargos,
      'c1'
    )
    expect(resultado.ok).toBe(true)
  })

  it('não reduz os dígitos se houver candidato com número incompatível', () => {
    const resultado = validarCargo(
      { nome: 'Presidente', ordem: 1, digitos: 3 },
      cargos,
      'c1',
      [{ id: 'a1', cargo_id: 'c1', numero: '10' }]
    )

    expect(resultado.ok).toBe(false)
    expect(resultado.erros.digitos).toContain('candidatos')
  })
})

describe('validação de candidatos', () => {
  const cargo = { id: 'c1', digitos: 2 }
  const candidatos = [{ id: 'a1', cargo_id: 'c1', numero: '10' }]

  it('aceita candidato com número correto', () => {
    const resultado = validarCandidato({ nome: 'Ana Silva', numero: '20' }, cargo, candidatos)
    expect(resultado.ok).toBe(true)
  })

  it('exige nome, cargo e somente dígitos no número', () => {
    expect(validarCandidato({ nome: '', numero: '20' }, cargo, candidatos).erros.nome).toBeTruthy()
    expect(validarCandidato({ nome: 'Ana', numero: '2A' }, cargo, candidatos).erros.numero).toBeTruthy()
    expect(validarCandidato({ nome: 'Ana', numero: '20' }, null, candidatos).erros.cargo_id).toBeTruthy()
  })

  it('respeita a quantidade de dígitos do cargo', () => {
    const resultado = validarCandidato({ nome: 'Ana', numero: '123' }, cargo, candidatos)
    expect(resultado.erros.numero).toContain('2 dígito')
  })

  it('impede número duplicado apenas dentro do mesmo cargo', () => {
    expect(
      validarCandidato({ nome: 'Ana', numero: '10' }, cargo, candidatos).erros.numero
    ).toBeTruthy()

    const outroCargo = { id: 'c2', digitos: 2 }
    expect(validarCandidato({ nome: 'Ana', numero: '10' }, outroCargo, candidatos).ok).toBe(true)
  })

  it('permite manter o próprio número durante a edição', () => {
    expect(
      validarCandidato({ nome: 'Ana', numero: '10' }, cargo, candidatos, 'a1').ok
    ).toBe(true)
  })
})

describe('validação da identificação do eleitor', () => {
  it('normaliza espaços e aceita somente o primeiro nome', () => {
    const resultado = validarIdentificacao('  Maria   ')

    expect(resultado.ok).toBe(true)
    expect(resultado.nome).toBe('Maria')
  })

  it('exige o primeiro nome', () => {
    const resultado = validarIdentificacao('   ')
    expect(resultado.ok).toBe(false)
    expect(resultado.erros.nome).toContain('primeiro nome')
  })

  it('rejeita um nome de uma letra', () => {
    const resultado = validarIdentificacao('M')
    expect(resultado.ok).toBe(false)
    expect(resultado.erros.nome).toBeTruthy()
  })
})
