import { describe, expect, it } from 'vitest'
import {
  nomeExibicao,
  normalizarNome,
  normalizarTurma,
  turmaExibicao
} from '@/lib/normalizar.js'

describe('normalização de eleitores', () => {
  it('remove acentos, pontuação e diferenças de caixa do nome', () => {
    expect(normalizarNome('  João   D’Ávila-Silva  ')).toBe('joao davilasilva')
    expect(normalizarNome('MARIA fernanda')).toBe('maria fernanda')
  })

  it('normaliza turmas para impedir duplicidade por formatação', () => {
    expect(normalizarTurma(' 9º - A ')).toBe('9A')
    expect(normalizarTurma('9a')).toBe('9A')
    expect(normalizarTurma('2º EM B')).toBe('2EMB')
  })

  it('preserva uma apresentação legível dos dados informados', () => {
    expect(nomeExibicao('  Maria   Fernanda  ')).toBe('Maria Fernanda')
    expect(turmaExibicao('  9º   A ')).toBe('9º A')
  })

  it('tolera valores ausentes', () => {
    expect(normalizarNome(null)).toBe('')
    expect(normalizarTurma(undefined)).toBe('')
    expect(nomeExibicao(null)).toBe('')
    expect(turmaExibicao(undefined)).toBe('')
  })
})
