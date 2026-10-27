export function criarEstadoUrna() {
  return {
    indice: 0,
    numero: '',
    tipo: null,
    avisoNulo: false,
    votos: [],
    ultimoVoto: null,
    etapa: 'votando'
  }
}

export function cargoAtual(estado, cargos = []) {
  if (!estado) return null
  return cargos[estado.indice] || null
}

export function candidatoDoNumero(cargo, numero) {
  if (!cargo || !numero) return null
  return (cargo.candidatos || []).find((c) => String(c.numero) === String(numero)) || null
}

export function digitar(estado, cargo, digito) {
  if (!estado || !cargo || estado.etapa !== 'votando') return estado
  const d = String(digito ?? '').replace(/\D/g, '')
  if (!d) return estado

  const max = Number(cargo.digitos) || 2
  const base = estado.tipo === 'branco' ? '' : estado.numero
  const numero = base + d
  if (numero.length > max) return estado

  return {
    ...estado,
    numero,
    tipo: null,
    avisoNulo: false
  }
}

export function corrigir(estado) {
  if (!estado) return estado
  return {
    ...estado,
    numero: '',
    tipo: null,
    avisoNulo: false
  }
}

export function votarBranco(estado, cargo) {
  if (!estado || !cargo || estado.etapa !== 'votando') {
    return { estado, erro: '', evento: '' }
  }
  if (!cargo.permite_branco) {
    return {
      estado,
      erro: 'Este cargo não permite voto em branco.',
      evento: 'erro'
    }
  }
  return {
    estado: {
      ...estado,
      numero: '',
      tipo: 'branco',
      avisoNulo: false
    },
    erro: '',
    evento: 'branco'
  }
}

export function confirmar(estado, cargos = []) {
  const cargo = cargoAtual(estado, cargos)
  if (!estado || !cargo || estado.etapa !== 'votando') {
    return { estado, erro: '', evento: '' }
  }

  if (estado.tipo === 'branco') {
    return registrar(estado, cargos, cargo, {
      tipo: 'branco',
      candidato_id: null
    })
  }

  const max = Number(cargo.digitos) || 2
  if (estado.numero.length < max) {
    return {
      estado,
      erro: 'Digite o número completo ou pressione BRANCO.',
      evento: 'erro'
    }
  }

  const candidato = candidatoDoNumero(cargo, estado.numero)
  if (!candidato) {
    if (!estado.avisoNulo) {
      return {
        estado: { ...estado, avisoNulo: true },
        erro:
          'NÚMERO ERRADO. Pressione CONFIRMA novamente para votar NULO ou CORRIGE para corrigir.',
        evento: 'aviso'
      }
    }
    return registrar(estado, cargos, cargo, {
      tipo: 'nulo',
      candidato_id: null
    })
  }

  return registrar(estado, cargos, cargo, {
    tipo: 'candidato',
    candidato_id: candidato.id
  })
}

function registrar(estado, cargos, cargo, voto) {
  const candidato =
    voto.tipo === 'candidato'
      ? candidatoDoNumero(cargo, estado.numero)
      : null

  const votos = [...estado.votos, { cargo_id: cargo.id, ...voto }]
  const ultimoVoto = {
    cargo,
    tipo: voto.tipo,
    candidato
  }
  const fim = estado.indice + 1 >= cargos.length

  return {
    estado: {
      ...estado,
      votos,
      ultimoVoto,
      etapa: fim ? 'fim' : 'votando',
      indice: fim ? estado.indice : estado.indice + 1,
      numero: '',
      tipo: null,
      avisoNulo: false
    },
    erro: '',
    evento: 'confirmado'
  }
}
