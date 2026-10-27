import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatarData, formatarDataHora, sanitizarNomeArquivo } from './utils.js'

const AZUL = [20, 58, 90]
const AZUL_CLARO = [232, 239, 246]
const VERDE = [31, 157, 85]
const VERMELHO = [190, 55, 55]
const CINZA = [100, 110, 120]
const MARGEM = 14

function hex(bytes) {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function hashFallback(texto) {
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  for (let i = 0; i < texto.length; i += 1) {
    const c = texto.charCodeAt(i)
    h1 ^= c
    h1 = Math.imul(h1, 0x01000193) >>> 0
    h2 ^= c + i
    h2 = Math.imul(h2, 0x85ebca6b) >>> 0
  }
  return (
    h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')
  ).repeat(4).slice(0, 64)
}

export async function hashSha256(texto) {
  const conteudo = String(texto ?? '')
  try {
    if (globalThis.crypto?.subtle) {
      const dados = new TextEncoder().encode(conteudo)
      const digest = await globalThis.crypto.subtle.digest('SHA-256', dados)
      return hex(digest)
    }
  } catch {
    /* fallback */
  }
  return hashFallback(conteudo)
}

export async function hashBlob(blob) {
  try {
    if (globalThis.crypto?.subtle) {
      const buffer = await blob.arrayBuffer()
      const digest = await globalThis.crypto.subtle.digest('SHA-256', buffer)
      return hex(digest)
    }
  } catch {
    /* fallback */
  }
  return hashFallback(await blob.text())
}

function criarDoc() {
  return new jsPDF({
    unit: 'mm',
    format: 'a4',
    orientation: 'portrait',
    compress: true
  })
}

function textoOuTraco(valor) {
  const texto = String(valor ?? '').trim()
  return texto || '—'
}

function cabecalho(doc, { eleicao, titulo, parcial = false }) {
  const largura = doc.internal.pageSize.getWidth()

  doc.setFillColor(...AZUL)
  doc.rect(0, 0, largura, 35, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12.5)
  doc.text(textoOuTraco(eleicao?.escola_nome), MARGEM, 12)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.text(textoOuTraco(eleicao?.nome), MARGEM, 19)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text(titulo, MARGEM, 29)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.text(
    `Gerado em ${formatarDataHora(new Date().toISOString())}`,
    largura - MARGEM,
    12,
    { align: 'right' }
  )
  doc.text(
    parcial ? 'DOCUMENTO PARCIAL' : 'DOCUMENTO OFICIAL',
    largura - MARGEM,
    19,
    { align: 'right' }
  )

  let y = 43
  if (parcial) {
    doc.setFillColor(255, 240, 235)
    doc.setDrawColor(...VERMELHO)
    doc.roundedRect(MARGEM, y - 5, largura - MARGEM * 2, 9, 1.5, 1.5, 'FD')
    doc.setTextColor(...VERMELHO)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text(
      'DOCUMENTO PARCIAL — NÃO OFICIAL. O resultado definitivo depende do encerramento da eleição.',
      largura / 2,
      y + 0.5,
      { align: 'center' }
    )
    y += 12
  }

  doc.setTextColor(30, 35, 40)
  return y
}

function rodape(doc, { hash, parcial = false }) {
  const largura = doc.internal.pageSize.getWidth()
  const altura = doc.internal.pageSize.getHeight()
  const total = doc.internal.getNumberOfPages()

  for (let pagina = 1; pagina <= total; pagina += 1) {
    doc.setPage(pagina)

    if (parcial) {
      doc.saveGraphicsState()
      doc.setGState(new doc.GState({ opacity: 0.075 }))
      doc.setTextColor(...VERMELHO)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(42)
      doc.text('DOCUMENTO PARCIAL', largura / 2, altura / 2, {
        align: 'center',
        angle: 35
      })
      doc.restoreGraphicsState()
    }

    doc.setDrawColor(210, 215, 222)
    doc.line(MARGEM, altura - 15, largura - MARGEM, altura - 15)

    doc.setTextColor(...CINZA)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.6)
    doc.text(
      `Urna Escolar · ${parcial ? 'via parcial' : 'via oficial'} · integridade SHA-256: ${
        hash || '—'
      }`,
      MARGEM,
      altura - 10
    )
    doc.text(`Página ${pagina} de ${total}`, largura - MARGEM, altura - 10, {
      align: 'right'
    })
  }
}

function paragrafo(doc, texto, y, { tamanho = 9, negrito = false, cor = [30, 35, 40] } = {}) {
  doc.setTextColor(...cor)
  doc.setFont('helvetica', negrito ? 'bold' : 'normal')
  doc.setFontSize(tamanho)
  const linhas = doc.splitTextToSize(texto, doc.internal.pageSize.getWidth() - MARGEM * 2)
  doc.text(linhas, MARGEM, y)
  return y + linhas.length * (tamanho * 0.42) + 3
}

function tituloSecao(doc, texto, y) {
  if (y > 250) {
    doc.addPage()
    y = 20
  }
  doc.setTextColor(...AZUL)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(texto, MARGEM, y)
  doc.setDrawColor(...AZUL_CLARO)
  doc.setLineWidth(0.8)
  doc.line(MARGEM, y + 2, doc.internal.pageSize.getWidth() - MARGEM, y + 2)
  doc.setLineWidth(0.2)
  return y + 8
}

function situacaoCandidato(candidato, cargo) {
  if (candidato.eleito) return 'Eleito'
  if (cargo.empate && candidato.votos === cargo.candidatos?.[0]?.votos) return 'Empate'
  if (candidato.ativo === false) return 'Inativo'
  return '—'
}

function tabelaCandidatos(doc, cargo, y) {
  const body = (cargo.candidatos || []).map((c) => [
    c.numero,
    textoOuTraco(c.nome_urna || c.nome),
    textoOuTraco(c.chapa),
    textoOuTraco(c.vice),
    String(c.votos ?? 0),
    `${Number(c.percentual ?? 0).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}%`,
    situacaoCandidato(c, cargo)
  ])

  autoTable(doc, {
    startY: y,
    head: [['Nº', 'Candidato', 'Chapa', 'Vice', 'Votos', '% válidos', 'Situação']],
    body: body.length ? body : [['—', 'Nenhum candidato cadastrado', '—', '—', '0', '0,00%', '—']],
    theme: 'grid',
    margin: { left: MARGEM, right: MARGEM },
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      cellPadding: 2,
      textColor: [35, 40, 45],
      lineColor: [218, 224, 231],
      lineWidth: 0.15
    },
    headStyles: {
      fillColor: AZUL,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5
    },
    alternateRowStyles: { fillColor: [247, 249, 252] },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center', fontStyle: 'bold' },
      4: { cellWidth: 16, halign: 'right' },
      5: { cellWidth: 20, halign: 'right' },
      6: { cellWidth: 24, halign: 'center' }
    },
    didParseCell: (data) => {
      if (data.section !== 'body') return
      const candidato = cargo.candidatos?.[data.row.index]
      if (candidato?.eleito) {
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.textColor = VERDE
      }
    }
  })

  return (doc.lastAutoTable?.finalY || y) + 6
}

function resumoCargo(doc, cargo, y) {
  if (y > 255) {
    doc.addPage()
    y = 20
  }

  const largura = doc.internal.pageSize.getWidth()
  const vencedores = (cargo.candidatos || []).filter((c) => c.eleito)
  const textoVencedor = cargo.empate
    ? 'Empate — não há vencedor definido'
    : vencedores.length
      ? `Eleito: ${vencedores.map((c) => c.nome_urna || c.nome).join(', ')}`
      : 'Sem votos válidos'

  doc.setFillColor(246, 249, 252)
  doc.setDrawColor(220, 227, 235)
  doc.roundedRect(MARGEM, y - 5, largura - MARGEM * 2, 18, 2, 2, 'FD')

  doc.setTextColor(40, 45, 50)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.8)
  doc.text(
    `Total de votos: ${cargo.total_votos ?? 0}   ·   Válidos: ${cargo.validos ?? 0}   ·   Brancos: ${
      cargo.brancos ?? 0
    }   ·   Nulos: ${cargo.nulos ?? 0}`,
    MARGEM + 4,
    y + 1
  )

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...(cargo.empate ? VERMELHO : VERDE))
  doc.text(textoVencedor, MARGEM + 4, y + 8)

  return y + 19
}

function assinaturas(doc, eleicao, y) {
  if (y > 235) {
    doc.addPage()
    y = 30
  }

  const largura = doc.internal.pageSize.getWidth()
  const metade = (largura - MARGEM * 2) / 2
  const linhas = [
    ['Presidente da comissão', eleicao?.presidente_comissao],
    ['Secretário(a) da comissão', eleicao?.secretario_comissao]
  ]

  doc.setTextColor(40, 45, 50)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('Assinaturas da comissão eleitoral', MARGEM, y)
  y += 18

  linhas.forEach(([cargo, nome], indice) => {
    const x = MARGEM + indice * metade
    doc.setDrawColor(120, 128, 138)
    doc.line(x, y, x + metade - 12, y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.text(cargo, x, y + 4)
    doc.setFont('helvetica', 'bold')
    doc.text(textoOuTraco(nome), x, y + 8.5)
  })

  return y + 20
}

export function gerarZeresima({ eleicao, cargos = [], hash = '', geradoEm = new Date().toISOString() }) {
  const doc = criarDoc()
  let y = cabecalho(doc, { eleicao, titulo: 'ZERÉSIMA' })

  y = paragrafo(
    doc,
    `Aos ${formatarData(eleicao?.data_eleicao)} , foi gerada a zerésima da eleição "${textoOuTraco(
      eleicao?.nome
    )}" da ${textoOuTraco(
      eleicao?.escola_nome
    )}, antes do início da votação. Todos os cargos e candidatos abaixo constam com zero votos registrados.`,
    y,
    { tamanho: 9 }
  )

  y = paragrafo(
    doc,
    `Total de eleitores aptos: ${
      eleicao?.total_eleitores_aptos != null ? eleicao.total_eleitores_aptos : 'não informado'
    }   ·   Total de votos registrados: 0   ·   Gerado em ${formatarDataHora(geradoEm)}`,
    y,
    { tamanho: 8.5, cor: CINZA }
  )

  for (const cargo of cargos) {
    y = tituloSecao(doc, `${cargo.nome} — ${cargo.digitos} dígito(s)`, y)
    y = tabelaCandidatos(
      doc,
      {
        ...cargo,
        total_votos: 0,
        validos: 0,
        brancos: 0,
        nulos: 0,
        candidatos: (cargo.candidatos || []).map((c) => ({
          ...c,
          votos: 0,
          percentual: 0,
          eleito: false
        }))
      },
      y
    )
  }

  y = paragrafo(
    doc,
    'A zerésima atesta que a urna não possuía votos antes da abertura. Este documento deve ser assinado pela comissão eleitoral e arquivado junto à ata de encerramento.',
    y,
    { tamanho: 8, cor: CINZA }
  )

  y = assinaturas(doc, eleicao, y)
  rodape(doc, { hash })
  return doc
}

export function gerarBoletim({
  apuracao,
  cargoId = null,
  parcial = false,
  hash = '',
  geradoEm = new Date().toISOString()
}) {
  const doc = criarDoc()
  const eleicao = apuracao?.eleicao || null
  const cargos = cargoId
    ? (apuracao?.cargos || []).filter((c) => c.id === cargoId)
    : apuracao?.cargos || []
  const titulo = cargoId && cargos[0] ? `BOLETIM — ${cargos[0].nome}` : 'BOLETIM DE URNA'

  let y = cabecalho(doc, { eleicao, titulo, parcial })

  y = paragrafo(
    doc,
    `Eleição: ${textoOuTraco(eleicao?.nome)}   ·   Data: ${formatarData(
      eleicao?.data_eleicao
    )}   ·   Status: ${textoOuTraco(eleicao?.status)}`,
    y,
    { tamanho: 8.5 }
  )

  y = paragrafo(
    doc,
    `Comparecimento: ${apuracao?.total_votantes ?? 0} eleitor(es)${
      apuracao?.comparecimento_percentual != null
        ? ` · ${apuracao.comparecimento_percentual.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })}% dos aptos`
        : ''
    }   ·   Gerado em ${formatarDataHora(geradoEm)}`,
    y,
    { tamanho: 8.5, cor: CINZA }
  )

  if (!cargoId) {
    y = tituloSecao(doc, 'Resumo geral', y)
    const resumo = cargos.map((cargo) => {
      const vencedores = (cargo.candidatos || []).filter((c) => c.eleito)
      const situacao = cargo.empate
        ? 'Empate'
        : vencedores.length
          ? vencedores.map((c) => c.nome_urna || c.nome).join(', ')
          : 'Sem votos'
      return [
        cargo.nome,
        String(cargo.total_votos ?? 0),
        String(cargo.validos ?? 0),
        String(cargo.brancos ?? 0),
        String(cargo.nulos ?? 0),
        situacao
      ]
    })

    autoTable(doc, {
      startY: y,
      head: [['Cargo', 'Total', 'Válidos', 'Brancos', 'Nulos', 'Eleito / situação']],
      body: resumo.length
        ? resumo
        : [['Nenhum cargo cadastrado', '0', '0', '0', '0', '—']],
      theme: 'grid',
      margin: { left: MARGEM, right: MARGEM },
      styles: {
        font: 'helvetica',
        fontSize: 7.8,
        cellPadding: 2,
        textColor: [35, 40, 45],
        lineColor: [218, 224, 231],
        lineWidth: 0.15
      },
      headStyles: {
        fillColor: AZUL,
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      },
      alternateRowStyles: { fillColor: [247, 249, 252] },
      columnStyles: {
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' }
      }
    })

    y = (doc.lastAutoTable?.finalY || y) + 8
  }

  for (const cargo of cargos) {
    y = tituloSecao(doc, `${cargo.nome} — ${cargo.digitos} dígito(s)`, y)
    y = tabelaCandidatos(doc, cargo, y)
    y = resumoCargo(doc, cargo, y)
  }

  y = paragrafo(
    doc,
    parcial
      ? 'Este boletim é uma via parcial, gerada durante a votação. Não substitui o boletim oficial emitido após o encerramento.'
      : 'Este boletim é a via oficial da urna e deve ser assinado pela comissão eleitoral.',
    y,
    { tamanho: 8, cor: parcial ? VERMELHO : CINZA }
  )

  y = assinaturas(doc, eleicao, y)
  rodape(doc, { hash, parcial })
  return doc
}

export function gerarAta({ apuracao, hash = '', geradoEm = new Date().toISOString() }) {
  const doc = criarDoc()
  const eleicao = apuracao?.eleicao || null
  let y = cabecalho(doc, { eleicao, titulo: 'ATA DE ENCERRAMENTO' })

  y = paragrafo(
    doc,
    `Aos ${formatarData(eleicao?.data_eleicao)}, a comissão eleitoral da ${textoOuTraco(
      eleicao?.escola_nome
    )} declara encerrada a votação da eleição "${textoOuTraco(
      eleicao?.nome
    )}", realizada das ${formatarDataHora(eleicao?.abertura_em)} às ${formatarDataHora(
      eleicao?.encerramento_em
    )}.`,
    y,
    { tamanho: 9 }
  )

  y = paragrafo(
    doc,
    `Compareceram ${apuracao?.total_votantes ?? 0} eleitor(es)${
      apuracao?.comparecimento_percentual != null
        ? `, correspondendo a ${apuracao.comparecimento_percentual.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })}% dos ${eleicao?.total_eleitores_aptos ?? '—'} aptos`
        : ''
    }. Foram registrados votos para ${apuracao?.cargos?.length ?? 0} cargo(s).`,
    y,
    { tamanho: 9 }
  )

  y = tituloSecao(doc, 'Resultado por cargo', y)

  const resumo = (apuracao?.cargos || []).map((cargo) => {
    const vencedores = (cargo.candidatos || []).filter((c) => c.eleito)
    return [
      cargo.nome,
      String(cargo.total_votos ?? 0),
      String(cargo.validos ?? 0),
      String(cargo.brancos ?? 0),
      String(cargo.nulos ?? 0),
      cargo.empate
        ? 'Empate'
        : vencedores.length
          ? vencedores.map((c) => `${c.numero} — ${c.nome_urna || c.nome}`).join(', ')
          : 'Sem votos'
    ]
  })

  autoTable(doc, {
    startY: y,
    head: [['Cargo', 'Total', 'Válidos', 'Brancos', 'Nulos', 'Resultado']],
    body: resumo.length
      ? resumo
      : [['Nenhum cargo cadastrado', '0', '0', '0', '0', '—']],
    theme: 'grid',
    margin: { left: MARGEM, right: MARGEM },
    styles: {
      font: 'helvetica',
      fontSize: 7.6,
      cellPadding: 2,
      textColor: [35, 40, 45],
      lineColor: [218, 224, 231],
      lineWidth: 0.15
    },
    headStyles: {
      fillColor: AZUL,
      textColor: [255, 255, 255],
      fontStyle: 'bold'
    },
    alternateRowStyles: { fillColor: [247, 249, 252] },
    columnStyles: {
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' }
    }
  })

  y = (doc.lastAutoTable?.finalY || y) + 8

  y = paragrafo(
    doc,
    'A comissão eleitoral declara que os resultados acima correspondem à apuração da urna, que os votos são anônimos e que o sistema não permite identificar individualmente o voto de cada eleitor. A lista de comparecimento foi conferida e não possui vínculo com os votos registrados.',
    y,
    { tamanho: 8.5 }
  )

  y = paragrafo(
    doc,
    `Documento gerado em ${formatarDataHora(geradoEm)}. A integridade deste arquivo pode ser conferida pelo hash SHA-256 informado no rodapé.`,
    y,
    { tamanho: 8, cor: CINZA }
  )

  y = assinaturas(doc, eleicao, y)
  rodape(doc, { hash })
  return doc
}

export function pdfParaBlob(doc) {
  return doc.output('blob')
}

export function baixarBlob(blob, nomeArquivo) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = nomeArquivo
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export function nomeArquivoRelatorio({ tipo, eleicao, cargo, parcial }) {
  const data = new Date()
  const stamp = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(
    2,
    '0'
  )}-${String(data.getDate()).padStart(2, '0')}-${String(data.getHours()).padStart(
    2,
    '0'
  )}${String(data.getMinutes()).padStart(2, '0')}`

  const escola = sanitizarNomeArquivo(eleicao?.nome || 'eleicao')
  if (tipo === 'zeresima') return `zeresima-${escola}-${stamp}.pdf`
  if (tipo === 'ata_encerramento') return `ata-encerramento-${escola}-${stamp}.pdf`
  return `boletim-${sanitizarNomeArquivo(cargo?.nome || 'todos')}-${
    parcial ? 'parcial-' : 'oficial-'
  }${escola}-${stamp}.pdf`
}
