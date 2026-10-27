import { describe, expect, it } from 'vitest'
import {
  candidatoDoNumero,
  cargoAtual,
  confirmar,
  corrigir,
  criarEstadoUrna,
  digitar,
  votarBranco
} from '@/lib/urnaMachine.js'

function criarCargos() {
  return [
    {
      id: 'cargo-presidente',
      nome: 'Presidente',
      digitos: 2,
      permite_branco: true,
      candidatos: [
        { id: 'candidato-10', numero: '10', nome: 'Chapa 10' },
        { id: 'candidato-20', numero: '20', nome: 'Chapa 20' }
      ]
    },
    {
      id: 'cargo-secretario',
      nome: 'Secretário',
      digitos: 2,
      permite_branco: false,
      candidatos: [{ id: 'candidato-30', numero: '30', nome: 'Chapa 30' }]
    }
  ]
}

function digitarNumero(estado, cargo, numero) {
  return String(numero)
    .split('')
    .reduce((atual, digito) => digitar(atual, cargo, digito), estado)
}

describe('máquina de estados da urna', () => {
  it('inicia no primeiro cargo sem votos parciais persistidos', () => {
    const estado = criarEstadoUrna()
    const cargos = criarCargos()

    expect(estado.etapa).toBe('votando')
    expect(estado.indice).toBe(0)
    expect(estado.votos).toEqual([])
    expect(cargoAtual(estado, cargos)).toBe(cargos[0])
  })

  it('limita a digitação à quantidade de dígitos do cargo', () => {
    const cargos = criarCargos()
    const estado = digitarNumero(criarEstadoUrna(), cargos[0], '1099')

    expect(estado.numero).toBe('10')
  })

  it('encontra o candidato pelo número e avança após confirmar', () => {
    const cargos = criarCargos()
    let estado = digitarNumero(criarEstadoUrna(), cargos[0], '10')

    expect(candidatoDoNumero(cargos[0], estado.numero)?.id).toBe('candidato-10')

    const resultado = confirmar(estado, cargos)
    estado = resultado.estado

    expect(resultado.evento).toBe('confirmado')
    expect(estado.indice).toBe(1)
    expect(estado.etapa).toBe('votando')
    expect(estado.numero).toBe('')
    expect(estado.votos).toEqual([
      {
        cargo_id: 'cargo-presidente',
        tipo: 'candidato',
        candidato_id: 'candidato-10'
      }
    ])
    expect(estado.ultimoVoto.candidato.id).toBe('candidato-10')
  })

  it('exige o número completo antes de confirmar', () => {
    const cargos = criarCargos()
    const estado = digitar(criarEstadoUrna(), cargos[0], '1')
    const resultado = confirmar(estado, cargos)

    expect(resultado.evento).toBe('erro')
    expect(resultado.estado).toBe(estado)
    expect(resultado.estado.votos).toEqual([])
  })

  it('exige dupla confirmação para registrar voto nulo', () => {
    const cargos = criarCargos()
    const digitado = digitarNumero(criarEstadoUrna(), cargos[0], '99')

    const aviso = confirmar(digitado, cargos)
    expect(aviso.evento).toBe('aviso')
    expect(aviso.estado.avisoNulo).toBe(true)
    expect(aviso.estado.votos).toEqual([])

    const confirmado = confirmar(aviso.estado, cargos)
    expect(confirmado.evento).toBe('confirmado')
    expect(confirmado.estado.votos[0]).toEqual({
      cargo_id: 'cargo-presidente',
      tipo: 'nulo',
      candidato_id: null
    })
  })

  it('permite corrigir depois do aviso de número inexistente', () => {
    const cargos = criarCargos()
    const digitado = digitarNumero(criarEstadoUrna(), cargos[0], '99')
    const aviso = confirmar(digitado, cargos)
    const corrigido = corrigir(aviso.estado)

    expect(corrigido.numero).toBe('')
    expect(corrigido.avisoNulo).toBe(false)
    expect(corrigido.votos).toEqual([])
  })

  it('registra voto em branco quando permitido', () => {
    const cargos = criarCargos()
    const branco = votarBranco(criarEstadoUrna(), cargos[0])
    const confirmado = confirmar(branco.estado, cargos)

    expect(branco.evento).toBe('branco')
    expect(branco.estado.tipo).toBe('branco')
    expect(confirmado.estado.votos[0].tipo).toBe('branco')
    expect(confirmado.estado.votos[0].candidato_id).toBeNull()
  })

  it('bloqueia voto em branco em cargo que não permite', () => {
    const cargos = criarCargos()
    const estado = { ...criarEstadoUrna(), indice: 1 }
    const resultado = votarBranco(estado, cargos[1])

    expect(resultado.evento).toBe('erro')
    expect(resultado.estado).toBe(estado)
  })

  it('limpa o modo branco ao digitar um número', () => {
    const cargos = criarCargos()
    const branco = votarBranco(criarEstadoUrna(), cargos[0]).estado
    const digitado = digitar(branco, cargos[0], '1')

    expect(digitado.tipo).toBeNull()
    expect(digitado.numero).toBe('1')
  })

  it('termina somente depois de confirmar todos os cargos', () => {
    const cargos = criarCargos()
    let estado = digitarNumero(criarEstadoUrna(), cargos[0], '10')
    estado = confirmar(estado, cargos).estado
    estado = digitarNumero(estado, cargos[1], '30')
    const resultado = confirmar(estado, cargos)

    expect(resultado.estado.etapa).toBe('fim')
    expect(resultado.estado.votos).toHaveLength(2)
    expect(cargoAtual(resultado.estado, cargos)).toBe(cargos[1])
  })

  it('não aceita novas teclas ou confirmações após o FIM', () => {
    const cargos = [criarCargos()[0]]
    const digitado = digitarNumero(criarEstadoUrna(), cargos[0], '10')
    const final = confirmar(digitado, cargos).estado

    expect(digitar(final, cargos[0], '2')).toBe(final)
    expect(confirmar(final, cargos).evento).toBe('')
    expect(final.votos).toHaveLength(1)
  })
})
