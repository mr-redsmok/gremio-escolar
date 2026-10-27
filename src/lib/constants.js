export const STATUS_ELEICAO = {
  rascunho: {
    label: 'Rascunho',
    descricao: 'Configuração em andamento. A urna ainda não aceita votos.',
    classe: 'status-rascunho'
  },
  aberta: {
    label: 'Aberta',
    descricao: 'A urna está liberada para votação.',
    classe: 'status-aberta'
  },
  encerrada: {
    label: 'Encerrada',
    descricao: 'A votação foi encerrada. Os resultados estão disponíveis.',
    classe: 'status-encerrada'
  },
  arquivada: {
    label: 'Arquivada',
    descricao: 'Eleição antiga, mantida apenas para consulta.',
    classe: 'status-arquivada'
  }
}

export const TIPOS_RELATORIO = {
  zeresima: 'Zerésima',
  boletim_cargo: 'Boletim por cargo',
  ata_encerramento: 'Ata de encerramento'
}

export const ROTULOS_AUDITORIA = {
  eleicao_criada: 'Eleição criada',
  configuracao_atualizada: 'Configuração atualizada',
  cargo_criado: 'Cargo criado',
  cargo_atualizado: 'Cargo atualizado',
  cargo_removido: 'Cargo removido',
  cargos_reordenados: 'Cargos reordenados',
  candidato_criado: 'Candidato criado',
  candidato_atualizado: 'Candidato atualizado',
  candidato_removido: 'Candidato removido',
  eleicao_aberta: 'Eleição aberta',
  eleicao_encerrada: 'Eleição encerrada',
  eleicao_reaberta: 'Eleição reaberta',
  voto_registrado: 'Voto registrado',
  relatorio_gerado: 'Relatório gerado'
}

export const DEMO_ADMIN = {
  email: 'admin@escola.local',
  senha: 'admin123',
  nome: 'Administrador de Demonstração'
}

export const DEMO_BANNER =
  'MODO DEMONSTRAÇÃO — os votos e relatórios ficam apenas neste navegador.'

export const STORAGE = {
  sessao: 'urna_sessao_v1',
  demoState: 'urna_demo_v1',
  demoAuth: 'urna_demo_auth_v1'
}
