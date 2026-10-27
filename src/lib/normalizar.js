export function normalizarNome(valor) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizarTurma(valor) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
}

export function nomeExibicao(nome) {
  return String(nome ?? '').trim().replace(/\s+/g, ' ')
}

export function turmaExibicao(turma) {
  return String(turma ?? '').trim().replace(/\s+/g, ' ')
}
