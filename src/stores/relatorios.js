import { defineStore } from 'pinia'
import { service } from '@/lib/service.js'
import {
  baixarBlob,
  gerarAta,
  gerarBoletim,
  gerarZeresima,
  hashBlob,
  hashSha256,
  nomeArquivoRelatorio,
  pdfParaBlob
} from '@/lib/pdf.js'

export const useRelatoriosStore = defineStore('relatorios', {
  state: () => ({
    lista: [],
    carregando: false,
    gerando: false,
    erro: ''
  }),
  actions: {
    async carregar(eleicaoId) {
      if (!service || !eleicaoId) {
        this.lista = []
        return
      }
      this.carregando = true
      this.erro = ''
      try {
        this.lista = await service.listarRelatorios(eleicaoId)
      } catch (erro) {
        this.erro = erro.message
      } finally {
        this.carregando = false
      }
    },
    async gerar({ eleicaoId, tipo, cargoId = null, parcial = false }) {
      if (!service) throw new Error('Serviço de dados não configurado.')
      if (this.gerando) throw new Error('Já existe um relatório sendo gerado.')

      this.gerando = true
      this.erro = ''
      try {
        let dados
        if (tipo === 'zeresima') {
          dados = await service.zeresima(eleicaoId)
        } else if (tipo === 'ata_encerramento') {
          dados = await service.apurar(eleicaoId, false)
        } else {
          dados = await service.apurar(eleicaoId, Boolean(parcial))
        }

        if (cargoId) {
          dados = {
            ...dados,
            cargos: (dados.cargos || []).filter((c) => c.id === cargoId)
          }
        }

        const geradoEm = new Date().toISOString()
        const hashDados = await hashSha256(
          JSON.stringify({
            tipo,
            cargoId,
            parcial: Boolean(parcial),
            geradoEm,
            dados
          })
        )

        let doc
        if (tipo === 'zeresima') {
          doc = gerarZeresima({
            eleicao: dados.eleicao,
            cargos: dados.cargos || [],
            hash: hashDados,
            geradoEm
          })
        } else if (tipo === 'ata_encerramento') {
          doc = gerarAta({
            apuracao: dados,
            hash: hashDados,
            geradoEm
          })
        } else {
          doc = gerarBoletim({
            apuracao: dados,
            cargoId,
            parcial: Boolean(parcial),
            hash: hashDados,
            geradoEm
          })
        }

        const blob = pdfParaBlob(doc)
        const hashArquivo = await hashBlob(blob)
        const meta = {
          eleicao_id: eleicaoId,
          cargo_id: cargoId || null,
          tipo,
          parcial: Boolean(parcial),
          hash_dados: hashDados,
          hash_arquivo: hashArquivo
        }

        const relatorio = await service.registrarRelatorio(meta, blob)
        const cargo = (dados.cargos || []).find((c) => c.id === cargoId) || null
        const nome = nomeArquivoRelatorio({
          tipo,
          eleicao: dados.eleicao,
          cargo,
          parcial
        })

        baixarBlob(blob, nome)
        await this.carregar(eleicaoId)
        return { relatorio, blob, nome }
      } catch (erro) {
        this.erro = erro.message
        throw erro
      } finally {
        this.gerando = false
      }
    },
    async baixar(relatorio, contexto = {}) {
      if (!service) throw new Error('Serviço de dados não configurado.')
      try {
        const cargo =
          (contexto.cargos || []).find((c) => c.id === relatorio.cargo_id) || null
        const nome = nomeArquivoRelatorio({
          tipo: relatorio.tipo,
          eleicao: contexto.eleicao,
          cargo,
          parcial: relatorio.parcial
        })
        const resultado = await service.baixarRelatorio(relatorio)

        if (resultado instanceof Blob) {
          baixarBlob(resultado, nome)
        } else if (resultado) {
          window.open(resultado, '_blank', 'noopener,noreferrer')
        }
      } catch (erro) {
        this.erro = erro.message
        throw erro
      }
    }
  }
})
