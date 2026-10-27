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

export function criarSeedDemo() {
  const agora = new Date().toISOString()
  const dataEleicao = new Date().toISOString().slice(0, 10)
  const eleicaoId = id()

  const cargoPresidente = id()
  const cargoVice = id()

  const cargos = [
    {
      id: cargoPresidente,
      eleicao_id: eleicaoId,
      nome: 'Presidente',
      descricao: 'Representa o grêmio estudantil.',
      ordem: 1,
      digitos: 2,
      permite_branco: true,
      ativo: true,
      criado_em: agora,
      atualizado_em: agora
    },
    {
      id: cargoVice,
      eleicao_id: eleicaoId,
      nome: 'Vice-Presidente',
      descricao: 'Apoia a presidência e substitui o presidente quando necessário.',
      ordem: 2,
      digitos: 2,
      permite_branco: true,
      ativo: true,
      criado_em: agora,
      atualizado_em: agora
    }
  ]

  const candidatos = [
    {
      id: id(),
      eleicao_id: eleicaoId,
      cargo_id: cargoPresidente,
      numero: '10',
      nome: 'Ana Beatriz Ferreira',
      nome_urna: 'Ana Beatriz',
      chapa: 'Chapa Renovação',
      vice: 'Lucas Martins',
      proposta: 'Mais diálogo, cultura e participação estudantil.',
      ativo: true,
      criado_em: agora,
      atualizado_em: agora
    },
    {
      id: id(),
      eleicao_id: eleicaoId,
      cargo_id: cargoPresidente,
      numero: '20',
      nome: 'Carlos Eduardo Souza',
      nome_urna: 'Carlos Eduardo',
      chapa: 'Chapa União',
      vice: 'Beatriz Nunes',
      proposta: 'União entre as turmas e melhoria dos espaços escolares.',
      ativo: true,
      criado_em: agora,
      atualizado_em: agora
    },
    {
      id: id(),
      eleicao_id: eleicaoId,
      cargo_id: cargoPresidente,
      numero: '30',
      nome: 'Marina Oliveira',
      nome_urna: 'Marina Oliveira',
      chapa: 'Chapa Nova Escola',
      vice: 'Rafael Costa',
      proposta: 'Esporte, arte e voz para todos os estudantes.',
      ativo: true,
      criado_em: agora,
      atualizado_em: agora
    },
    {
      id: id(),
      eleicao_id: eleicaoId,
      cargo_id: cargoVice,
      numero: '10',
      nome: 'Lucas Martins',
      nome_urna: 'Lucas Martins',
      chapa: 'Chapa Renovação',
      vice: null,
      proposta: 'Apoio à chapa Renovação.',
      ativo: true,
      criado_em: agora,
      atualizado_em: agora
    },
    {
      id: id(),
      eleicao_id: eleicaoId,
      cargo_id: cargoVice,
      numero: '20',
      nome: 'Beatriz Nunes',
      nome_urna: 'Beatriz Nunes',
      chapa: 'Chapa União',
      vice: null,
      proposta: 'Apoio à chapa União.',
      ativo: true,
      criado_em: agora,
      atualizado_em: agora
    },
    {
      id: id(),
      eleicao_id: eleicaoId,
      cargo_id: cargoVice,
      numero: '30',
      nome: 'Rafael Costa',
      nome_urna: 'Rafael Costa',
      chapa: 'Chapa Nova Escola',
      vice: null,
      proposta: 'Apoio à chapa Nova Escola.',
      ativo: true,
      criado_em: agora,
      atualizado_em: agora
    }
  ]

  return {
    eleicoes: [
      {
        id: eleicaoId,
        escola_nome: 'Escola Estadual de Demonstração',
        nome: 'Eleição do Grêmio Estudantil 2026',
        descricao:
          'Eleição demonstrativa para apresentar o funcionamento da urna escolar.',
        data_eleicao: dataEleicao,
        status: 'aberta',
        total_eleitores_aptos: 320,
        digitos_padrao: 2,
        som_ativo: true,
        tempo_inatividade_segundos: 120,
        presidente_comissao: 'Prof.ª Ana Paula Ribeiro',
        secretario_comissao: 'Prof. Carlos Henrique Lima',
        abertura_em: agora,
        encerramento_em: null,
        created_by: null,
        criado_em: agora,
        atualizado_em: agora
      }
    ],
    cargos,
    candidatos,
    sessoes: [],
    presencas: [],
    votos: [],
    relatorios: [],
    auditoria: [
      {
        id: id(),
        eleicao_id: eleicaoId,
        actor_id: null,
        acao: 'eleicao_criada',
        detalhes: {
          escola_nome: 'Escola Estadual de Demonstração',
          nome: 'Eleição do Grêmio Estudantil 2026'
        },
        criado_em: agora
      },
      {
        id: id(),
        eleicao_id: eleicaoId,
        actor_id: null,
        acao: 'eleicao_aberta',
        detalhes: { abertura_em: agora },
        criado_em: agora
      }
    ]
  }
}
