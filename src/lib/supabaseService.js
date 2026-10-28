import { supabase } from './supabase.js'
import { traduzirErro } from './utils.js'

export const mode = 'supabase'

function client() {
  if (!supabase) {
    throw new Error(
      'Supabase não configurado. Preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.'
    )
  }
  return supabase
}

function falhar(error) {
  throw new Error(traduzirErro(error?.message || error))
}

async function rpc(nome, parametros = {}) {
  const { data, error } = await client().rpc(nome, parametros)
  if (error) falhar(error)
  return data
}

async function buscarAdmin(userId) {
  const { data, error } = await client()
    .from('urna_admins')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) falhar(error)
  return data || null
}

async function registrarAuditoria(eleicaoId, acao, detalhes = {}) {
  try {
    await rpc('urna_auditar', {
      p_eleicao_id: eleicaoId,
      p_acao: acao,
      p_detalhes: detalhes
    })
  } catch (erro) {
    console.warn('Não foi possível registrar a auditoria.', erro)
  }
}

/* -------------------------------------------------------------------------- */
/* Autenticação                                                               */
/* -------------------------------------------------------------------------- */

const DOMINIO_USUARIOS = '@urna-escolar.com'

function emailDoUsuario(usuario) {
  const texto = String(usuario ?? '').trim().toLowerCase()
  return texto.includes('@') ? texto : `${texto}${DOMINIO_USUARIOS}`
}

export async function login(usuario, senha) {
  const { data, error } = await client().auth.signInWithPassword({
    email: emailDoUsuario(usuario),
    password: String(senha ?? '')
  })
  if (error) falhar(error)

  const admin = await buscarAdmin(data.user.id)
  if (!admin) {
    await client().auth.signOut()
    throw new Error('Usuário sem permissão de administrador.')
  }

  return { user: data.user, admin }
}

export async function logout() {
  const { error } = await client().auth.signOut()
  if (error) falhar(error)
}

export async function getSession() {
  const { data, error } = await client().auth.getSession()
  if (error) falhar(error)

  const user = data.session?.user || null
  if (!user) return null

  const admin = await buscarAdmin(user.id)
  return { user, admin }
}

export function onAuthStateChange(callback) {
  if (!supabase) return { data: { subscription: { unsubscribe() {} } } }

  return supabase.auth.onAuthStateChange((_evento, sessao) => {
    const user = sessao?.user || null
    if (!user) {
      callback({ user: null, admin: null })
      return
    }

    // Evita chamadas concorrentes dentro do callback do GoTrue.
    setTimeout(async () => {
      try {
        const admin = await buscarAdmin(user.id)
        callback({ user, admin })
      } catch {
        callback({ user, admin: null })
      }
    }, 0)
  })
}

/* -------------------------------------------------------------------------- */
/* Leitura administrativa                                                     */
/* -------------------------------------------------------------------------- */

export async function getAdminData() {
  const { data: eleicao, error } = await client()
    .from('urna_eleicoes')
    .select('*')
    .neq('status', 'arquivada')
    .order('criado_em', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) falhar(error)
  if (!eleicao) {
    return { eleicao: null, cargos: [], candidatos: [] }
  }

  const [cargosRes, candidatosRes] = await Promise.all([
    client()
      .from('urna_cargos')
      .select('*')
      .eq('eleicao_id', eleicao.id)
      .order('ordem', { ascending: true })
      .order('nome', { ascending: true }),
    client()
      .from('urna_candidatos')
      .select('*')
      .eq('eleicao_id', eleicao.id)
      .order('numero', { ascending: true })
  ])

  if (cargosRes.error) falhar(cargosRes.error)
  if (candidatosRes.error) falhar(candidatosRes.error)

  return {
    eleicao,
    cargos: cargosRes.data || [],
    candidatos: candidatosRes.data || []
  }
}

export async function getEstadoPublico() {
  const data = await rpc('urna_estado_publico')
  return data || { eleicao: null, cargos: [] }
}

/* -------------------------------------------------------------------------- */
/* Configuração                                                               */
/* -------------------------------------------------------------------------- */

export async function salvarEleicao(eleicaoId, patch) {
  return rpc('urna_salvar_eleicao', {
    p_eleicao_id: eleicaoId,
    p_patch: patch
  })
}

export async function criarCargo(dados) {
  const { data, error } = await client()
    .from('urna_cargos')
    .insert({
      eleicao_id: dados.eleicao_id,
      nome: String(dados.nome ?? '').trim(),
      descricao: String(dados.descricao ?? '').trim() || null,
      ordem: Number(dados.ordem) || 0,
      digitos: Number(dados.digitos) || 2,
      permite_branco: dados.permite_branco !== false,
      ativo: dados.ativo !== false
    })
    .select()
    .single()

  if (error) falhar(error)

  await registrarAuditoria(dados.eleicao_id, 'cargo_criado', {
    cargo_id: data.id,
    nome: data.nome
  })

  return data
}

export async function atualizarCargo(cargoId, dados) {
  const { data, error } = await client()
    .from('urna_cargos')
    .update({
      nome: String(dados.nome ?? '').trim(),
      descricao: String(dados.descricao ?? '').trim() || null,
      ordem: Number(dados.ordem) || 0,
      digitos: Number(dados.digitos) || 2,
      permite_branco: dados.permite_branco !== false,
      ativo: dados.ativo !== false
    })
    .eq('id', cargoId)
    .select()
    .single()

  if (error) falhar(error)

  await registrarAuditoria(data.eleicao_id, 'cargo_atualizado', {
    cargo_id: data.id,
    nome: data.nome
  })

  return data
}

export async function removerCargo(cargoId, eleicaoId) {
  const { data, error } = await client()
    .from('urna_cargos')
    .delete()
    .eq('id', cargoId)
    .select('id, nome, eleicao_id')
    .maybeSingle()

  if (error) falhar(error)

  await registrarAuditoria(eleicaoId, 'cargo_removido', {
    cargo_id: cargoId,
    nome: data?.nome || null
  })

  return { ok: true }
}

export async function reordenarCargos(ids, eleicaoId) {
  const resultados = await Promise.all(
    ids.map((cargoId, indice) =>
      client()
        .from('urna_cargos')
        .update({ ordem: indice + 1 })
        .eq('id', cargoId)
    )
  )

  const comErro = resultados.find((r) => r.error)
  if (comErro) falhar(comErro.error)

  await registrarAuditoria(eleicaoId, 'cargos_reordenados', { ordem: ids })
  return { ok: true }
}

export async function criarCandidato(dados) {
  const { data, error } = await client()
    .from('urna_candidatos')
    .insert({
      eleicao_id: dados.eleicao_id,
      cargo_id: dados.cargo_id,
      numero: String(dados.numero ?? '').trim(),
      nome: String(dados.nome ?? '').trim(),
      nome_urna: String(dados.nome_urna ?? '').trim() || null,
      chapa: String(dados.chapa ?? '').trim() || null,
      vice: String(dados.vice ?? '').trim() || null,
      proposta: String(dados.proposta ?? '').trim() || null,
      ativo: dados.ativo !== false
    })
    .select()
    .single()

  if (error) falhar(error)

  await registrarAuditoria(dados.eleicao_id, 'candidato_criado', {
    candidato_id: data.id,
    numero: data.numero
  })

  return data
}

export async function atualizarCandidato(candidatoId, dados) {
  const { data, error } = await client()
    .from('urna_candidatos')
    .update({
      cargo_id: dados.cargo_id,
      numero: String(dados.numero ?? '').trim(),
      nome: String(dados.nome ?? '').trim(),
      nome_urna: String(dados.nome_urna ?? '').trim() || null,
      chapa: String(dados.chapa ?? '').trim() || null,
      vice: String(dados.vice ?? '').trim() || null,
      proposta: String(dados.proposta ?? '').trim() || null,
      ativo: dados.ativo !== false
    })
    .eq('id', candidatoId)
    .select()
    .single()

  if (error) falhar(error)

  await registrarAuditoria(data.eleicao_id, 'candidato_atualizado', {
    candidato_id: data.id,
    numero: data.numero
  })

  return data
}

export async function removerCandidato(candidatoId, eleicaoId) {
  const { data, error } = await client()
    .from('urna_candidatos')
    .delete()
    .eq('id', candidatoId)
    .select('id, numero, eleicao_id')
    .maybeSingle()

  if (error) falhar(error)

  await registrarAuditoria(eleicaoId, 'candidato_removido', {
    candidato_id: candidatoId,
    numero: data?.numero || null
  })

  return { ok: true }
}

/* -------------------------------------------------------------------------- */
/* Ciclo de vida                                                              */
/* -------------------------------------------------------------------------- */

export async function abrirEleicao(eleicaoId) {
  return rpc('urna_abrir_eleicao', { p_eleicao_id: eleicaoId })
}

export async function pausarEleicao(eleicaoId, motivo = '') {
  return rpc('urna_pausar_eleicao', {
    p_eleicao_id: eleicaoId,
    p_motivo: String(motivo ?? '').trim() || null
  })
}

export async function retomarEleicao(eleicaoId) {
  return rpc('urna_retomar_eleicao', { p_eleicao_id: eleicaoId })
}

export async function encerrarEleicao(eleicaoId) {
  return rpc('urna_encerrar_eleicao', { p_eleicao_id: eleicaoId })
}

export async function reabrirEleicao(eleicaoId, motivo = '') {
  return rpc('urna_reabrir_eleicao', {
    p_eleicao_id: eleicaoId,
    p_motivo: String(motivo ?? '').trim() || null
  })
}

export async function excluirEleicao(eleicaoId) {
  const { data: relatorios, error } = await client()
    .from('urna_relatorios')
    .select('storage_path')
    .eq('eleicao_id', eleicaoId)

  if (error) falhar(error)

  const caminhos = (relatorios || []).map((r) => r.storage_path).filter(Boolean)
  if (caminhos.length) {
    const remocao = await client().storage.from('urna-relatorios').remove(caminhos)
    if (remocao.error) falhar(remocao.error)
  }

  return rpc('urna_excluir_eleicao', { p_eleicao_id: eleicaoId })
}

export async function novaEleicao({ escola_nome, nome, data_eleicao }) {
  return rpc('urna_nova_eleicao', {
    p_escola_nome: escola_nome,
    p_nome: nome,
    p_data_eleicao: data_eleicao || null
  })
}

/* -------------------------------------------------------------------------- */
/* Votação pública                                                            */
/* -------------------------------------------------------------------------- */

export async function liberarEleitor(eleicaoId, nome, turma) {
  return rpc('urna_liberar_eleitor', {
    p_eleicao_id: eleicaoId,
    p_nome: nome,
    p_turma: turma
  })
}

export async function registrarVoto(token, votos) {
  return rpc('urna_registrar_voto', {
    p_token: token,
    p_votos: votos
  })
}

export async function cancelarSessao(token) {
  return rpc('urna_cancelar_sessao', { p_token: token })
}

/* -------------------------------------------------------------------------- */
/* Consultas e relatórios                                                     */
/* -------------------------------------------------------------------------- */

export async function conferirVotante(eleicaoId, nome, turma) {
  return rpc('urna_conferir_votante', {
    p_eleicao_id: eleicaoId,
    p_nome: nome,
    p_turma: turma
  })
}

export async function listarPresencas(eleicaoId) {
  const { data, error } = await client()
    .from('urna_presencas')
    .select('id, nome_eleitor, turma, votou_em')
    .eq('eleicao_id', eleicaoId)
    .order('votou_em', { ascending: false })

  if (error) falhar(error)
  return data || []
}

export async function apurar(eleicaoId, parcial = false) {
  return rpc('urna_apurar', {
    p_eleicao_id: eleicaoId,
    p_parcial: Boolean(parcial)
  })
}

export async function zeresima(eleicaoId) {
  return rpc('urna_zeresima', { p_eleicao_id: eleicaoId })
}

export async function listarRelatorios(eleicaoId) {
  const { data, error } = await client()
    .from('urna_relatorios')
    .select('*')
    .eq('eleicao_id', eleicaoId)
    .order('criado_em', { ascending: false })

  if (error) falhar(error)
  return data || []
}

export async function registrarRelatorio(meta, blob) {
  const caminho = `${meta.eleicao_id}/${meta.tipo}-${Date.now()}${
    meta.cargo_id ? `-${meta.cargo_id}` : ''
  }.pdf`

  const upload = await client()
    .storage.from('urna-relatorios')
    .upload(caminho, blob, {
      contentType: 'application/pdf',
      cacheControl: '3600',
      upsert: false
    })

  if (upload.error) falhar(upload.error)

  return rpc('urna_registrar_relatorio', {
    p_eleicao_id: meta.eleicao_id,
    p_tipo: meta.tipo,
    p_parcial: Boolean(meta.parcial),
    p_cargo_id: meta.cargo_id || null,
    p_storage_path: caminho,
    p_hash_dados: meta.hash_dados || null,
    p_hash_arquivo: meta.hash_arquivo || null
  })
}

export async function baixarRelatorio(relatorio) {
  if (!relatorio?.storage_path) {
    throw new Error('Este relatório não possui arquivo armazenado.')
  }

  const { data, error } = await client()
    .storage.from('urna-relatorios')
    .createSignedUrl(relatorio.storage_path, 120)

  if (error) falhar(error)
  return data.signedUrl
}

export async function listarAuditoria(eleicaoId) {
  const { data, error } = await client()
    .from('urna_auditoria')
    .select('*')
    .eq('eleicao_id', eleicaoId)
    .order('criado_em', { ascending: false })
    .limit(200)

  if (error) falhar(error)
  return data || []
}

export async function auditar(eleicaoId, acao, detalhes = {}) {
  await registrarAuditoria(eleicaoId, acao, detalhes)
  return { ok: true }
}
