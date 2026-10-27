import { getActivePinia } from 'pinia'
import { useToastStore } from '@/stores/toast.js'

export function newId() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID()
    }
  } catch {
    /* fallback abaixo */
  }

  try {
    const b = new Uint8Array(16)
    crypto.getRandomValues(b)
    b[6] = (b[6] & 0x0f) | 0x40
    b[8] = (b[8] & 0x3f) | 0x80
    const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
    return (
      h.slice(0, 8) +
      '-' +
      h.slice(8, 12) +
      '-' +
      h.slice(12, 16) +
      '-' +
      h.slice(16, 20) +
      '-' +
      h.slice(20)
    )
  } catch {
    /* último recurso */
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

export function toast(msg, tipo = '') {
  try {
    if (getActivePinia()) {
      useToastStore().show(msg, tipo)
      return
    }
  } catch {
    /* sem Pinia ativa */
  }
  console.log(`[toast ${tipo}] ${msg}`)
}

export function formatarData(valor) {
  if (!valor) return '—'
  const data = valor instanceof Date ? valor : new Date(`${valor}T12:00:00`)
  if (Number.isNaN(data.getTime())) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(data)
}

export function formatarDataHora(valor) {
  if (!valor) return '—'
  const data = valor instanceof Date ? valor : new Date(valor)
  if (Number.isNaN(data.getTime())) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(data)
}

export function formatarHora(valor) {
  if (!valor) return '—'
  const data = valor instanceof Date ? valor : new Date(valor)
  if (Number.isNaN(data.getTime())) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(data)
}

export function formatarNumero(valor) {
  const n = Number(valor)
  if (!Number.isFinite(n)) return '0'
  return new Intl.NumberFormat('pt-BR').format(n)
}

export function formatarPercentual(valor) {
  const n = Number(valor)
  if (!Number.isFinite(n)) return '—'
  return `${n.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}%`
}

export function sanitizarNomeArquivo(valor) {
  return String(valor ?? 'relatorio')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
}

export function iniciais(nome) {
  const partes = String(nome ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!partes.length) return '?'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

export function agruparPor(lista, chave) {
  return (lista || []).reduce((acc, item) => {
    const k = item[chave]
    if (!acc[k]) acc[k] = []
    acc[k].push(item)
    return acc
  }, {})
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function traduzirErro(mensagem) {
  const msg = String(mensagem ?? '').trim()
  if (!msg) return 'Ocorreu um erro inesperado.'
  if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) {
    return 'Falha de conexão. Verifique a internet e tente novamente.'
  }
  if (/JWT expired|invalid JWT|refresh_token_not_found/i.test(msg)) {
    return 'Sua sessão expirou. Faça login novamente.'
  }
  if (/duplicate key value violates unique constraint/i.test(msg)) {
    return 'Já existe um registro com esses dados.'
  }
  if (/row-level security/i.test(msg)) {
    return 'Você não tem permissão para esta ação.'
  }
  return msg
}
