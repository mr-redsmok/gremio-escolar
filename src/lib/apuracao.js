function arredondar(valor) {
  return Math.round((Number(valor) || 0) * 100) / 100
}

function compararTexto(a, b) {
  return String(a ?? '').localeCompare(String(b ?? ''), 'pt-BR', {
    sensitivity: 'base'
  })
}

/**
 * Calcula a apuração a partir dos dados brutos.
 * Usado no modo demonstração e nos testes. No Supabase, o mesmo formato
 * é devolvido pela função RPC urna_apurar.
 */
export function calcularApuracao({
  eleicao = null,
  cargos = [],
  candidatos = [],
  presencas = [],
  votos = [],
  parcial = false
} = {}) {
  const totalVotantes = (presencas || []).length

  const cargosOrdenados = [...(cargos || [])].sort((a, b) => {
    const ordem = (Number(a.ordem) || 0) - (Number(b.ordem) || 0)
    return ordem !== 0 ? ordem : compararTexto(a.nome, b.nome)
  })

  const cargosResultado = cargosOrdenados.map((cargo) => {
    const votosCargo = (votos || []).filter((v) => v.cargo_id === cargo.id)
    const validos = votosCargo.filter((v) => v.tipo === 'candidato').length
    const brancos = votosCargo.filter((v) => v.tipo === 'branco').length
    const nulos = votosCargo.filter((v) => v.tipo === 'nulo').length

    const candidatosCargo = (candidatos || [])
      .filter((c) => c.cargo_id === cargo.id)
      .map((c) => {
        const quantidade = votosCargo.filter(
          (v) => v.candidato_id === c.id
        ).length
        return {
          ...c,
          votos: quantidade,
          percentual: validos > 0 ? arredondar((quantidade / validos) * 100) : 0
        }
      })
      .sort((a, b) => {
        if (b.votos !== a.votos) return b.votos - a.votos
        return compararTexto(a.nome, b.nome)
      })

    const maiorVotacao = candidatosCargo.length
      ? Math.max(...candidatosCargo.map((c) => c.votos))
      : 0
    const quantidadeNoTopo = candidatosCargo.filter(
      (c) => c.votos === maiorVotacao && maiorVotacao > 0
    ).length
    const empate = quantidadeNoTopo > 1

    const candidatosFinal = candidatosCargo.map((c, indice) => ({
      ...c,
      posicao: indice + 1,
      eleito: !empate && maiorVotacao > 0 && c.votos === maiorVotacao,
      empate
    }))

    return {
      ...cargo,
      total_votos: votosCargo.length,
      validos,
      brancos,
      nulos,
      empate,
      candidatos: candidatosFinal
    }
  })

  const aptos = Number(eleicao?.total_eleitores_aptos)
  const comparecimento =
    Number.isFinite(aptos) && aptos > 0
      ? arredondar((totalVotantes / aptos) * 100)
      : null

  return {
    eleicao: eleicao ? { ...eleicao } : null,
    total_votantes: totalVotantes,
    comparecimento_percentual: comparecimento,
    parcial: Boolean(parcial),
    cargos: cargosResultado
  }
}
