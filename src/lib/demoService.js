import { DEMO_ADMIN, STORAGE } from './constants.js'
import { criarSeedDemo } from './seed.js'
import { calcularApuracao } from './apuracao.js'
import { normalizarNome, normalizarTurma } from './normalizar.js'

export const mode = 'demo'

let cache = null

function id() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID()
    }
  } catch {
    /* fallback */
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

function agora() {
  return new Date().toISOString()
}

function clone(valor) {
  return valor == null ? valor : JSON.parse(JSON.stringify(valor))
}

function tokenAleatorio() {
  const bytes = new Uint8Array(32)
  try {
    crypto.getRandomValues(bytes)
  } catch {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256)
    }
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

function carregarEstado() {
  if (cache) return cache

  try {
    const bruto = localStorage.getItem(STORAGE.demoState)
    if (bruto) {
      const dados = JSON.parse(bruto)
      if (dados && Array.isArray(dados.eleicoes)) {
        cache = dados
        return cache
      }
    }
  } catch {
    /* estado inválido: recria */
  }

  cache = criarSeedDemo()
  persistir()
  return cache
}

function persistir() {
  if (!cache) return
  try {
    localStorage.setItem(STORAGE.demoState, JSON.stringify(cache))
  } catch (erro) {
    console.warn('Não foi possível persistir o estado de demonstração.', erro)
  }
}

function eleicaoAtual(estado = carregarEstado()) {
  return (
    [...estado.eleicoes]
      .filter((e) => e.status !== 'arquivada')
      .sort((a, b) => String(b.criado_em).localeCompare(String(a.criado_em)))[0] ||
    null
  )
}

function exigirEleicaoAtual(estado = carregarEstado()) {
  const eleicao = eleicaoAtual(estado)
  if (!eleicao) {
    throw new Error('Nenhuma eleição configurada.')
  }
  return eleicao
}

function exigirRascunho(eleicao) {
  if (eleicao.status !== 'rascunho') {
    throw new Error(
      'A configuração não pode ser alterada depois da abertura da eleição.'
    )
  }
}

function estaAutenticado() {
  try {
    return localStorage.getItem(STORAGE.demoAuth) === '1'
  } catch {
    return false
  }
}

function exigirAdmin() {
  if (!estaAutenticado()) {
    throw new Error('Faça login como administrador.')
  }
}

function registrarAuditoria(estado, eleicaoId, acao, detalhes = {}) {
  estado.auditoria.unshift({
    id: id(),
    eleicao_id: eleicaoId,
    actor_id: null,
    acao,
    detalhes,
    criado_em: agora()
  })
}

function validarVotosDaEleicao(estado, eleicao, votos) {
  const cargosAtivos = estado.cargos.filter(
    (c) => c.eleicao_id === eleicao.id && c.ativo
  )

  if (!Array.isArray(votos) || votos.length !== cargosAtivos.length) {
    throw new Error('Quantidade de votos diferente da quantidade de cargos.')
  }

  const ids = new Set()
  for (const voto of votos) {
    const cargo = cargosAtivos.find((c) => c.id === voto.cargo_id)
    if (!cargo) throw new Error('Cargo inválido ou inativo.')
    if (ids.has(cargo.id)) throw new Error('Há cargos repetidos na lista de votos.')
    ids.add(cargo.id)

    if (voto.tipo === 'candidato') {
      const candidato = estado.candidatos.find(
        (c) =>
          c.id === voto.candidato_id &&
          c.cargo_id === cargo.id &&
          c.eleicao_id === eleicao.id &&
          c.ativo
      )
      if (!candidato) throw new Error('Candidato inválido ou inativo.')
    } else if (voto.tipo === 'branco') {
      if (!cargo.permite_branco) {
        throw new Error('Este cargo não permite voto em branco.')
      }
    } else if (voto.tipo !== 'nulo') {
      throw new Error('Tipo de voto inválido.')
    }
  }

  return cargosAtivos
}

/* -------------------------------------------------------------------------- */
/* Autenticação                                                               */
/* -------------------------------------------------------------------------- */

export async function login(email, senha) {
  const emailLimpo = String(email ?? '').trim().toLowerCase()
  if (emailLimpo !== DEMO_ADMIN.email || String(senha ?? '') !== DEMO_ADMIN.senha) {
    throw new Error('E-mail ou senha inválidos.')
  }

  try {
    localStorage.setItem(STORAGE.demoAuth, '1')
  } catch {
    /* sem localStorage */
  }

  return {
    user: { id: 'demo-admin', email: DEMO_ADMIN.email },
    admin: {
      user_id: 'demo-admin',
      nome: DEMO_ADMIN.nome,
      papel: 'admin'
    }
  }
}

export async function logout() {
  try {
    localStorage.removeItem(STORAGE.demoAuth)
  } catch {
    /* sem localStorage */
  }
}

export async function getSession() {
  if (!estaAutenticado()) return null
  return {
    user: { id: 'demo-admin', email: DEMO_ADMIN.email },
    admin: {
      user_id: 'demo-admin',
      nome: DEMO_ADMIN.nome,
      papel: 'admin'
    }
  }
}

export function onAuthStateChange() {
  return { data: { subscription: { unsubscribe() {} } } }
}

/* -------------------------------------------------------------------------- */
/* Leitura administrativa                                                     */
/* -------------------------------------------------------------------------- */

export async function getAdminData() {
  exigirAdmin()
  const estado = carregarEstado()
  const eleicao = eleicaoAtual(estado)

  if (!eleicao) {
    return { eleicao: null, cargos: [], candidatos: [] }
  }

  return clone({
    eleicao,
    cargos: estado.cargos
      .filter((c) => c.eleicao_id === eleicao.id)
      .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome)),
    candidatos: estado.candidatos
      .filter((c) => c.eleicao_id === eleicao.id)
      .sort((a, b) => String(a.numero).localeCompare(String(b.numero)))
  })
}

export async function getEstadoPublico() {
  const estado = carregarEstado()
  const eleicao = eleicaoAtual(estado)

  if (!eleicao) {
    return { eleicao: null, cargos: [] }
  }

  const publica = {
    id: eleicao.id,
    escola_nome: eleicao.escola_nome,
    nome: eleicao.nome,
    descricao: eleicao.descricao,
    data_eleicao: eleicao.data_eleicao,
    status: eleicao.status,
    digitos_padrao: eleicao.digitos_padrao,
    som_ativo: eleicao.som_ativo,
    tempo_inatividade_segundos: eleicao.tempo_inatividade_segundos
  }

  if (eleicao.status !== 'aberta') {
    return { eleicao: publica, cargos: [] }
  }

  const cargos = estado.cargos
    .filter((c) => c.eleicao_id === eleicao.id && c.ativo)
    .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome))
    .map((cargo) => ({
      id: cargo.id,
      nome: cargo.nome,
      descricao: cargo.descricao,
      ordem: cargo.ordem,
      digitos: cargo.digitos,
      permite_branco: cargo.permite_branco,
      candidatos: estado.candidatos
        .filter(
          (c) => c.cargo_id === cargo.id && c.eleicao_id === eleicao.id && c.ativo
        )
        .sort((a, b) => String(a.numero).localeCompare(String(b.numero)))
        .map((c) => ({
          id: c.id,
          numero: c.numero,
          nome: c.nome,
          nome_urna: c.nome_urna,
          chapa: c.chapa,
          vice: c.vice,
          proposta: c.proposta
        }))
    }))

  return { eleicao: publica, cargos: clone(cargos) }
}

/* -------------------------------------------------------------------------- */
/* Configuração                                                               */
/* -------------------------------------------------------------------------- */

export async function salvarEleicao(_eleicaoId, patch) {
  exigirAdmin()
  const estado = carregarEstado()
  const eleicao = exigirEleicaoAtual(estado)
  exigirRascunho(eleicao)

  const permitidos = [
    'escola_nome',
    'nome',
    'descricao',
    'data_eleicao',
    'total_eleitores_aptos',
    'digitos_padrao',
    'som_ativo',
    'tempo_inatividade_segundos',
    'presidente_comissao',
    'secretario_comissao'
  ]

  for (const chave of permitidos) {
    if (Object.prototype.hasOwnProperty.call(patch, chave)) {
      eleicao[chave] = patch[chave]
    }
  }
  eleicao.atualizado_em = agora()

  registrarAuditoria(estado, eleicao.id, 'configuracao_atualizada', {
    escola_nome: eleicao.escola_nome,
    nome: eleicao.nome
  })
  persistir()
  return clone(eleicao)
}

export async function criarCargo(dados) {
  exigirAdmin()
  const estado = carregarEstado()
  const eleicao = exigirEleicaoAtual(estado)
  exigirRascunho(eleicao)

  const nome = String(dados.nome ?? '').trim()
  if (!nome) throw new Error('Informe o nome do cargo.')
  if (
    estado.cargos.some(
      (c) =>
        c.eleicao_id === eleicao.id &&
        c.nome.toLocaleLowerCase('pt-BR') === nome.toLocaleLowerCase('pt-BR')
    )
  ) {
    throw new Error('Já existe um cargo com esse nome.')
  }

  const cargo = {
    id: id(),
    eleicao_id: eleicao.id,
    nome,
    descricao: String(dados.descricao ?? '').trim() || null,
    ordem: Number.isInteger(Number(dados.ordem))
      ? Number(dados.ordem)
      : estado.cargos.filter((c) => c.eleicao_id === eleicao.id).length + 1,
    digitos: Number(dados.digitos) || eleicao.digitos_padrao || 2,
    permite_branco: dados.permite_branco !== false,
    ativo: dados.ativo !== false,
    criado_em: agora(),
    atualizado_em: agora()
  }

  estado.cargos.push(cargo)
  registrarAuditoria(estado, eleicao.id, 'cargo_criado', {
    cargo_id: cargo.id,
    nome: cargo.nome
  })
  persistir()
  return clone(cargo)
}

export async function atualizarCargo(cargoId, dados) {
  exigirAdmin()
  const estado = carregarEstado()
  const eleicao = exigirEleicaoAtual(estado)
  exigirRascunho(eleicao)

  const cargo = estado.cargos.find(
    (c) => c.id === cargoId && c.eleicao_id === eleicao.id
  )
  if (!cargo) throw new Error('Cargo não encontrado.')

  const nome = String(dados.nome ?? '').trim()
  if (!nome) throw new Error('Informe o nome do cargo.')
  if (
    estado.cargos.some(
      (c) =>
        c.id !== cargoId &&
        c.eleicao_id === eleicao.id &&
        c.nome.toLocaleLowerCase('pt-BR') === nome.toLocaleLowerCase('pt-BR')
    )
  ) {
    throw new Error('Já existe um cargo com esse nome.')
  }

  const digitos = Number(dados.digitos) || cargo.digitos
  const candidatosDoCargo = estado.candidatos.filter((c) => c.cargo_id === cargo.id)
  if (candidatosDoCargo.some((c) => String(c.numero).length !== digitos)) {
    throw new Error(
      'Há candidatos deste cargo com número fora do novo tamanho. Ajuste os números antes.'
    )
  }

  cargo.nome = nome
  cargo.descricao = String(dados.descricao ?? '').trim() || null
  cargo.ordem = Number.isInteger(Number(dados.ordem))
    ? Number(dados.ordem)
    : cargo.ordem
  cargo.digitos = digitos
  cargo.permite_branco = dados.permite_branco !== false
  cargo.ativo = dados.ativo !== false
  cargo.atualizado_em = agora()

  registrarAuditoria(estado, eleicao.id, 'cargo_atualizado', {
    cargo_id: cargo.id,
    nome: cargo.nome
  })
  persistir()
  return clone(cargo)
}

export async function removerCargo(cargoId) {
  exigirAdmin()
  const estado = carregarEstado()
  const eleicao = exigirEleicaoAtual(estado)
  exigirRascunho(eleicao)

  const cargo = estado.cargos.find(
    (c) => c.id === cargoId && c.eleicao_id === eleicao.id
  )
  if (!cargo) throw new Error('Cargo não encontrado.')

  estado.cargos = estado.cargos.filter((c) => c.id !== cargoId)
  estado.candidatos = estado.candidatos.filter((c) => c.cargo_id !== cargoId)
  registrarAuditoria(estado, eleicao.id, 'cargo_removido', {
    cargo_id: cargoId,
    nome: cargo.nome
  })
  persistir()
  return { ok: true }
}

export async function reordenarCargos(ids) {
  exigirAdmin()
  const estado = carregarEstado()
  const eleicao = exigirEleicaoAtual(estado)
  exigirRascunho(eleicao)

  ids.forEach((cargoId, indice) => {
    const cargo = estado.cargos.find(
      (c) => c.id === cargoId && c.eleicao_id === eleicao.id
    )
    if (cargo) {
      cargo.ordem = indice + 1
      cargo.atualizado_em = agora()
    }
  })

  registrarAuditoria(estado, eleicao.id, 'cargos_reordenados', { ordem: ids })
  persistir()
  return { ok: true }
}

export async function criarCandidato(dados) {
  exigirAdmin()
  const estado = carregarEstado()
  const eleicao = exigirEleicaoAtual(estado)
  exigirRascunho(eleicao)

  const cargo = estado.cargos.find(
    (c) => c.id === dados.cargo_id && c.eleicao_id === eleicao.id
  )
  if (!cargo) throw new Error('Selecione um cargo válido.')

  const numero = String(dados.numero ?? '').trim()
  if (!/^\d+$/.test(numero) || numero.length !== Number(cargo.digitos)) {
    throw new Error(`O número deve ter exatamente ${cargo.digitos} dígito(s).`)
  }
  if (
    estado.candidatos.some(
      (c) => c.cargo_id === cargo.id && String(c.numero) === numero
    )
  ) {
    throw new Error('Já existe um candidato com esse número neste cargo.')
  }

  const nome = String(dados.nome ?? '').trim()
  if (!nome) throw new Error('Informe o nome do candidato.')

  const candidato = {
    id: id(),
    eleicao_id: eleicao.id,
    cargo_id: cargo.id,
    numero,
    nome,
    nome_urna: String(dados.nome_urna ?? '').trim() || nome,
    chapa: String(dados.chapa ?? '').trim() || null,
    vice: String(dados.vice ?? '').trim() || null,
    proposta: String(dados.proposta ?? '').trim() || null,
    ativo: dados.ativo !== false,
    criado_em: agora(),
    atualizado_em: agora()
  }

  estado.candidatos.push(candidato)
  registrarAuditoria(estado, eleicao.id, 'candidato_criado', {
    candidato_id: candidato.id,
    cargo: cargo.nome,
    numero: candidato.numero
  })
  persistir()
  return clone(candidato)
}

export async function atualizarCandidato(candidatoId, dados) {
  exigirAdmin()
  const estado = carregarEstado()
  const eleicao = exigirEleicaoAtual(estado)
  exigirRascunho(eleicao)

  const candidato = estado.candidatos.find(
    (c) => c.id === candidatoId && c.eleicao_id === eleicao.id
  )
  if (!candidato) throw new Error('Candidato não encontrado.')

  const cargo = estado.cargos.find(
    (c) =>
      c.id === (dados.cargo_id || candidato.cargo_id) &&
      c.eleicao_id === eleicao.id
  )
  if (!cargo) throw new Error('Selecione um cargo válido.')

  const numero = String(dados.numero ?? candidato.numero).trim()
  if (!/^\d+$/.test(numero) || numero.length !== Number(cargo.digitos)) {
    throw new Error(`O número deve ter exatamente ${cargo.digitos} dígito(s).`)
  }
  if (
    estado.candidatos.some(
      (c) =>
        c.id !== candidatoId &&
        c.cargo_id === cargo.id &&
        String(c.numero) === numero
    )
  ) {
    throw new Error('Já existe um candidato com esse número neste cargo.')
  }

  const nome = String(dados.nome ?? candidato.nome).trim()
  if (!nome) throw new Error('Informe o nome do candidato.')

  candidato.cargo_id = cargo.id
  candidato.numero = numero
  candidato.nome = nome
  candidato.nome_urna = String(dados.nome_urna ?? '').trim() || nome
  candidato.chapa = String(dados.chapa ?? '').trim() || null
  candidato.vice = String(dados.vice ?? '').trim() || null
  candidato.proposta = String(dados.proposta ?? '').trim() || null
  candidato.ativo = dados.ativo !== false
  candidato.atualizado_em = agora()

  registrarAuditoria(estado, eleicao.id, 'candidato_atualizado', {
    candidato_id: candidato.id,
    cargo: cargo.nome,
    numero: candidato.numero
  })
  persistir()
  return clone(candidato)
}

export async function removerCandidato(candidatoId) {
  exigirAdmin()
  const estado = carregarEstado()
  const eleicao = exigirEleicaoAtual(estado)
  exigirRascunho(eleicao)

  const candidato = estado.candidatos.find(
    (c) => c.id === candidatoId && c.eleicao_id === eleicao.id
  )
  if (!candidato) throw new Error('Candidato não encontrado.')

  estado.candidatos = estado.candidatos.filter((c) => c.id !== candidatoId)
  registrarAuditoria(estado, eleicao.id, 'candidato_removido', {
    candidato_id: candidatoId,
    numero: candidato.numero
  })
  persistir()
  return { ok: true }
}

/* -------------------------------------------------------------------------- */
/* Ciclo de vida                                                              */
/* -------------------------------------------------------------------------- */

export async function abrirEleicao(_eleicaoId) {
  exigirAdmin()
  const estado = carregarEstado()
  const eleicao = exigirEleicaoAtual(estado)

  if (eleicao.status !== 'rascunho') {
    throw new Error('Somente eleições em rascunho podem ser abertas.')
  }
  if (!String(eleicao.escola_nome ?? '').trim() || !String(eleicao.nome ?? '').trim()) {
    throw new Error('Informe o nome da escola e o nome da eleição.')
  }

  const cargosAtivos = estado.cargos.filter(
    (c) => c.eleicao_id === eleicao.id && c.ativo
  )
  if (!cargosAtivos.length) throw new Error('Cadastre pelo menos um cargo ativo.')

  for (const cargo of cargosAtivos) {
    const candidatos = estado.candidatos.filter(
      (c) => c.cargo_id === cargo.id && c.ativo
    )
    if (!candidatos.length) {
      throw new Error(`O cargo ${cargo.nome} precisa de pelo menos um candidato ativo.`)
    }
    if (candidatos.some((c) => String(c.numero).length !== Number(cargo.digitos))) {
      throw new Error(`Há candidato com número fora do tamanho do cargo ${cargo.nome}.`)
    }
  }

  if (estado.votos.some((v) => v.eleicao_id === eleicao.id)) {
    throw new Error('Esta eleição já possui votos registrados.')
  }

  eleicao.status = 'aberta'
  eleicao.abertura_em = agora()
  eleicao.encerramento_em = null
  eleicao.atualizado_em = agora()
  registrarAuditoria(estado, eleicao.id, 'eleicao_aberta', {
    abertura_em: eleicao.abertura_em
  })
  persistir()
  return { ok: true, eleicao_id: eleicao.id }
}

export async function encerrarEleicao(_eleicaoId) {
  exigirAdmin()
  const estado = carregarEstado()
  const eleicao = exigirEleicaoAtual(estado)

  if (eleicao.status !== 'aberta') {
    throw new Error('Somente eleições abertas podem ser encerradas.')
  }

  eleicao.status = 'encerrada'
  eleicao.encerramento_em = agora()
  eleicao.atualizado_em = agora()
  registrarAuditoria(estado, eleicao.id, 'eleicao_encerrada', {
    encerramento_em: eleicao.encerramento_em
  })
  persistir()
  return { ok: true, eleicao_id: eleicao.id }
}

export async function reabrirEleicao(_eleicaoId, motivo = '') {
  exigirAdmin()
  const estado = carregarEstado()
  const eleicao = exigirEleicaoAtual(estado)

  if (eleicao.status !== 'encerrada') {
    throw new Error('Somente eleições encerradas podem ser reabertas.')
  }

  eleicao.status = 'aberta'
  eleicao.encerramento_em = null
  eleicao.atualizado_em = agora()
  registrarAuditoria(estado, eleicao.id, 'eleicao_reaberta', {
    motivo: String(motivo ?? '').trim() || null
  })
  persistir()
  return { ok: true, eleicao_id: eleicao.id }
}

export async function novaEleicao({ escola_nome, nome, data_eleicao }) {
  exigirAdmin()
  const estado = carregarEstado()

  if (estado.eleicoes.some((e) => e.status === 'aberta')) {
    throw new Error('Encerre a eleição atual antes de criar outra.')
  }
  if (!String(escola_nome ?? '').trim() || !String(nome ?? '').trim()) {
    throw new Error('Informe o nome da escola e o nome da eleição.')
  }

  estado.eleicoes.forEach((e) => {
    if (e.status === 'rascunho' || e.status === 'encerrada') {
      e.status = 'arquivada'
      e.atualizado_em = agora()
    }
  })

  const nova = {
    id: id(),
    escola_nome: String(escola_nome).trim(),
    nome: String(nome).trim(),
    descricao: '',
    data_eleicao: data_eleicao || null,
    status: 'rascunho',
    total_eleitores_aptos: null,
    digitos_padrao: 2,
    som_ativo: true,
    tempo_inatividade_segundos: 120,
    presidente_comissao: '',
    secretario_comissao: '',
    abertura_em: null,
    encerramento_em: null,
    created_by: null,
    criado_em: agora(),
    atualizado_em: agora()
  }

  estado.eleicoes.push(nova)
  registrarAuditoria(estado, nova.id, 'eleicao_criada', {
    escola_nome: nova.escola_nome,
    nome: nova.nome
  })
  persistir()
  return { ok: true, eleicao: clone(nova) }
}

/* -------------------------------------------------------------------------- */
/* Votação pública                                                            */
/* -------------------------------------------------------------------------- */

export async function liberarEleitor(eleicaoId, nome, turma) {
  const estado = carregarEstado()
  const eleicao = estado.eleicoes.find(
    (e) => e.id === eleicaoId && e.status === 'aberta'
  )
  if (!eleicao) throw new Error('A votação não está aberta.')

  const nomeLimpo = String(nome ?? '').trim().replace(/\s+/g, ' ')
  const turmaLimpa = String(turma ?? '').trim().replace(/\s+/g, ' ')
  const nomeNorm = normalizarNome(nomeLimpo)
  const turmaNorm = normalizarTurma(turmaLimpa)

  if (nomeNorm.length < 2) throw new Error('Digite seu primeiro nome.')

  const jaVotou = estado.presencas.some(
    (p) =>
      p.eleicao_id === eleicao.id &&
      p.nome_normalizado === nomeNorm &&
      p.turma_normalizada === turmaNorm
  )
  if (jaVotou) {
    throw new Error('Este nome já votou nesta eleição.')
  }

  const agoraMs = Date.now()
  estado.sessoes.forEach((s) => {
    if (
      s.eleicao_id === eleicao.id &&
      s.nome_normalizado === nomeNorm &&
      s.turma_normalizada === turmaNorm &&
      s.status === 'ativa' &&
      new Date(s.expira_em).getTime() <= agoraMs
    ) {
      s.status = 'expirada'
    }
  })

  const ativa = estado.sessoes.find(
    (s) =>
      s.eleicao_id === eleicao.id &&
      s.nome_normalizado === nomeNorm &&
      s.turma_normalizada === turmaNorm &&
      s.status === 'ativa' &&
      new Date(s.expira_em).getTime() > agoraMs
  )

  if (ativa) {
    const minutos = Math.max(
      1,
      Math.ceil((new Date(ativa.expira_em).getTime() - agoraMs) / 60000)
    )
    throw new Error(
      `Já existe uma votação em andamento para este nome e turma. Aguarde ${minutos} minuto(s) ou procure o responsável.`
    )
  }

  const expiraEm = new Date(
    agoraMs + (Number(eleicao.tempo_inatividade_segundos) + 60) * 1000
  ).toISOString()

  const sessao = {
    id: id(),
    eleicao_id: eleicao.id,
    nome_eleitor: nomeLimpo,
    nome_normalizado: nomeNorm,
    turma: turmaLimpa,
    turma_normalizada: turmaNorm,
    token: tokenAleatorio(),
    status: 'ativa',
    expira_em: expiraEm,
    usada_em: null,
    criada_em: agora()
  }

  estado.sessoes.push(sessao)
  persistir()

  return {
    token: sessao.token,
    nome: sessao.nome_eleitor,
    turma: sessao.turma,
    expira_em: sessao.expira_em
  }
}

export async function registrarVoto(token, votos) {
  const estado = carregarEstado()
  const sessao = estado.sessoes.find((s) => s.token === token)

  if (!sessao) throw new Error('Sessão de votação inválida.')

  if (sessao.status === 'usada') {
    return { ok: true, ja_registrado: true }
  }
  if (sessao.status !== 'ativa') {
    throw new Error('Sessão de votação expirada ou cancelada.')
  }
  if (new Date(sessao.expira_em).getTime() <= Date.now()) {
    sessao.status = 'expirada'
    persistir()
    throw new Error('Sessão de votação expirada. Reinicie a votação.')
  }

  const eleicao = estado.eleicoes.find(
    (e) => e.id === sessao.eleicao_id && e.status === 'aberta'
  )
  if (!eleicao) throw new Error('A votação não está aberta.')

  const presenca = estado.presencas.find(
    (p) =>
      p.eleicao_id === eleicao.id &&
      p.nome_normalizado === sessao.nome_normalizado &&
      p.turma_normalizada === sessao.turma_normalizada
  )
  if (presenca) {
    sessao.status = 'usada'
    sessao.usada_em = agora()
    persistir()
    return { ok: true, ja_registrado: true }
  }

  validarVotosDaEleicao(estado, eleicao, votos)

  for (const voto of votos) {
    estado.votos.push({
      id: id(),
      eleicao_id: eleicao.id,
      cargo_id: voto.cargo_id,
      candidato_id: voto.tipo === 'candidato' ? voto.candidato_id : null,
      tipo: voto.tipo
    })
  }

  sessao.status = 'usada'
  sessao.usada_em = agora()

  estado.presencas.push({
    id: id(),
    eleicao_id: eleicao.id,
    nome_eleitor: sessao.nome_eleitor,
    nome_normalizado: sessao.nome_normalizado,
    turma: sessao.turma,
    turma_normalizada: sessao.turma_normalizada,
    sessao_id: sessao.id,
    votou_em: agora()
  })

  const protocolo = id().replace(/-/g, '').slice(0, 12).toUpperCase()
  registrarAuditoria(estado, eleicao.id, 'voto_registrado', { protocolo })
  persistir()

  return { ok: true, protocolo }
}

export async function cancelarSessao(token) {
  const estado = carregarEstado()
  const sessao = estado.sessoes.find((s) => s.token === token)
  if (sessao && sessao.status === 'ativa') {
    sessao.status = 'cancelada'
    persistir()
  }
  return { ok: true }
}

/* -------------------------------------------------------------------------- */
/* Consultas e relatórios                                                     */
/* -------------------------------------------------------------------------- */

export async function conferirVotante(eleicaoId, nome, turma) {
  exigirAdmin()
  const estado = carregarEstado()
  const nomeNorm = normalizarNome(nome)
  const turmaNorm = normalizarTurma(turma)
  const presenca = estado.presencas.find(
    (p) =>
      p.eleicao_id === eleicaoId &&
      p.nome_normalizado === nomeNorm &&
      p.turma_normalizada === turmaNorm
  )
  return presenca ? clone(presenca) : null
}

export async function listarPresencas(eleicaoId) {
  exigirAdmin()
  const estado = carregarEstado()
  return clone(
    estado.presencas
      .filter((p) => p.eleicao_id === eleicaoId)
      .sort((a, b) => String(b.votou_em).localeCompare(String(a.votou_em)))
  )
}

export async function apurar(_eleicaoId, parcial = false) {
  exigirAdmin()
  const estado = carregarEstado()
  const eleicao = exigirEleicaoAtual(estado)

  if (eleicao.status !== 'encerrada' && !parcial) {
    throw new Error('A eleição ainda não foi encerrada.')
  }

  return calcularApuracao({
    eleicao,
    cargos: estado.cargos.filter((c) => c.eleicao_id === eleicao.id),
    candidatos: estado.candidatos.filter((c) => c.eleicao_id === eleicao.id),
    presencas: estado.presencas.filter((p) => p.eleicao_id === eleicao.id),
    votos: estado.votos.filter((v) => v.eleicao_id === eleicao.id),
    parcial
  })
}

export async function zeresima(_eleicaoId) {
  exigirAdmin()
  const estado = carregarEstado()
  const eleicao = exigirEleicaoAtual(estado)

  if (estado.votos.some((v) => v.eleicao_id === eleicao.id)) {
    throw new Error('A zerésima só pode ser gerada antes do primeiro voto.')
  }

  const resultado = calcularApuracao({
    eleicao,
    cargos: estado.cargos.filter((c) => c.eleicao_id === eleicao.id),
    candidatos: estado.candidatos.filter((c) => c.eleicao_id === eleicao.id),
    presencas: [],
    votos: [],
    parcial: false
  })

  return {
    ...resultado,
    zeresima: true,
    gerado_em: agora()
  }
}

export async function listarRelatorios(eleicaoId) {
  exigirAdmin()
  const estado = carregarEstado()
  return clone(
    estado.relatorios
      .filter((r) => r.eleicao_id === eleicaoId)
      .sort((a, b) => String(b.criado_em).localeCompare(String(a.criado_em)))
  )
}

function blobParaDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader()
    leitor.onload = () => resolve(leitor.result)
    leitor.onerror = () => reject(new Error('Não foi possível preparar o PDF.'))
    leitor.readAsDataURL(blob)
  })
}

export async function registrarRelatorio(meta, blob) {
  exigirAdmin()
  const estado = carregarEstado()
  const dataUrl = await blobParaDataUrl(blob)

  const relatorio = {
    id: id(),
    eleicao_id: meta.eleicao_id,
    cargo_id: meta.cargo_id || null,
    tipo: meta.tipo,
    parcial: Boolean(meta.parcial),
    storage_path: null,
    hash_dados: meta.hash_dados || null,
    hash_arquivo: meta.hash_arquivo || null,
    gerado_por: 'demo-admin',
    criado_em: agora(),
    data_url: dataUrl
  }

  estado.relatorios.unshift(relatorio)
  estado.relatorios = estado.relatorios.slice(0, 8)
  registrarAuditoria(estado, meta.eleicao_id, 'relatorio_gerado', {
    tipo: relatorio.tipo,
    parcial: relatorio.parcial,
    hash_dados: relatorio.hash_dados
  })
  persistir()

  const semData = { ...relatorio }
  delete semData.data_url
  return clone(semData)
}

export async function baixarRelatorio(relatorio) {
  exigirAdmin()
  const estado = carregarEstado()
  const encontrado = estado.relatorios.find((r) => r.id === relatorio.id)
  if (!encontrado?.data_url) {
    throw new Error('O PDF não está mais disponível neste navegador.')
  }
  const resposta = await fetch(encontrado.data_url)
  return resposta.blob()
}

export async function listarAuditoria(eleicaoId) {
  exigirAdmin()
  const estado = carregarEstado()
  return clone(
    estado.auditoria
      .filter((a) => a.eleicao_id === eleicaoId)
      .sort((a, b) => String(b.criado_em).localeCompare(String(a.criado_em)))
      .slice(0, 200)
  )
}

export async function auditar(eleicaoId, acao, detalhes = {}) {
  exigirAdmin()
  const estado = carregarEstado()
  registrarAuditoria(estado, eleicaoId, acao, detalhes)
  persistir()
  return { ok: true }
}

export async function resetDemo() {
  exigirAdmin()
  cache = criarSeedDemo()
  persistir()
  return { ok: true }
}
