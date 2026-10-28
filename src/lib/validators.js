function texto(valor) {
  return String(valor ?? '').trim()
}

export function validarEleicao(dados = {}) {
  const erros = {}
  if (!texto(dados.escola_nome)) {
    erros.escola_nome = 'Informe o nome da escola.'
  }
  if (!texto(dados.nome)) {
    erros.nome = 'Informe o nome da eleição.'
  }

  const digitos = Number(dados.digitos_padrao)
  if (!Number.isInteger(digitos) || digitos < 2 || digitos > 4) {
    erros.digitos_padrao = 'A quantidade de dígitos deve ser entre 2 e 4.'
  }

  const tempo = Number(dados.tempo_inatividade_segundos)
  if (!Number.isInteger(tempo) || tempo < 30 || tempo > 600) {
    erros.tempo_inatividade_segundos = 'O tempo de inatividade deve ser entre 30 e 600 segundos.'
  }

  const aptos = dados.total_eleitores_aptos
  if (aptos !== '' && aptos !== null && aptos !== undefined) {
    const n = Number(aptos)
    if (!Number.isInteger(n) || n < 0) {
      erros.total_eleitores_aptos = 'Informe um número inteiro maior ou igual a zero.'
    }
  }

  return { ok: Object.keys(erros).length === 0, erros }
}

export function validarCargo(dados = {}, cargos = [], idAtual = null, candidatos = []) {
  const erros = {}
  const nome = texto(dados.nome)
  if (!nome) {
    erros.nome = 'Informe o nome do cargo.'
  } else {
    const duplicado = cargos.some(
      (c) =>
        c.id !== idAtual &&
        texto(c.nome).toLocaleLowerCase('pt-BR') === nome.toLocaleLowerCase('pt-BR')
    )
    if (duplicado) erros.nome = 'Já existe um cargo com esse nome.'
  }

  const ordem = Number(dados.ordem)
  if (!Number.isInteger(ordem) || ordem < 0) {
    erros.ordem = 'A ordem deve ser um número inteiro maior ou igual a zero.'
  }

  const digitos = Number(dados.digitos)
  if (!Number.isInteger(digitos) || digitos < 2 || digitos > 4) {
    erros.digitos = 'A quantidade de dígitos deve ser entre 2 e 4.'
  } else if (idAtual) {
    const cands = candidatos.filter((c) => c.cargo_id === idAtual)
    if (cands.some((c) => String(c.numero).length !== digitos)) {
      erros.digitos = 'Há candidatos deste cargo com número fora desse tamanho. Ajuste os números antes.'
    }
  }

  return { ok: Object.keys(erros).length === 0, erros }
}

export function validarCandidato(dados = {}, cargo = null, candidatos = [], idAtual = null) {
  const erros = {}
  const nome = texto(dados.nome)
  if (!nome) erros.nome = 'Informe o nome do candidato.'

  const numero = texto(dados.numero)
  const digitos = Number(cargo?.digitos) || 2
  if (!numero) {
    erros.numero = 'Informe o número do candidato.'
  } else if (!/^\d+$/.test(numero)) {
    erros.numero = 'O número deve conter apenas dígitos.'
  } else if (numero.length !== digitos) {
    erros.numero = `O número deve ter exatamente ${digitos} dígito(s).`
  } else {
    const duplicado = candidatos.some(
      (c) =>
        c.id !== idAtual &&
        c.cargo_id === cargo?.id &&
        String(c.numero) === numero
    )
    if (duplicado) erros.numero = 'Já existe um candidato com esse número neste cargo.'
  }

  if (!cargo?.id) erros.cargo_id = 'Selecione o cargo.'

  return { ok: Object.keys(erros).length === 0, erros }
}
