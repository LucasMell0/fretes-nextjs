import Papa from 'papaparse'
import type { ImportacaoCSVRow, RegiaoParaImportar, ErroImportacao } from '@/types/importacao'

export interface ParseResult {
  regioes: RegiaoParaImportar[]
  erros: ErroImportacao[]
}

const COLUNAS_OBRIGATORIAS = ['REGIAO', 'CEP_INICIAL', 'CEP_FINAL']

const parseFloat = (value: string | undefined): number => {
  if (!value) return 0
  const cleaned = value.replace(',', '.')
  return Number(cleaned) || 0
}

const parseInt = (value: string | undefined): number => {
  if (!value) return 0
  return Number.parseInt(value, 10) || 0
}

const parseBoolean = (value: string | undefined): boolean => {
  if (!value) return false
  return value === '1' || value.toLowerCase() === 'true'
}

const normalizarTipo = (value: string | undefined): 'PERCENTUAL' | 'VALOR' => {
  if (!value) return 'VALOR'
  const lower = value.toLowerCase()
  return lower === 'percentual' ? 'PERCENTUAL' : 'VALOR'
}

export function parsearCSV(file: File): Promise<ParseResult> {
  return new Promise((resolve) => {
    const regioesMapa = new Map<string, RegiaoParaImportar>()
    const erros: ErroImportacao[] = []
    let linhaAtual = 1

    Papa.parse<ImportacaoCSVRow>(file, {
      header: true,
      skipEmptyLines: true,
      delimiter: '',
      delimitersToGuess: [';', ',', '\t'],
      transformHeader: (header) => header.trim().toUpperCase(),
      complete: (results) => {
        const cabecalho = results.meta.fields || []
        
        const faltando = COLUNAS_OBRIGATORIAS.filter(col => !cabecalho.includes(col))
        if (faltando.length > 0) {
          erros.push({
            linha: 0,
            mensagem: `Colunas obrigatórias não encontradas: ${faltando.join(', ')}`
          })
          resolve({ regioes: [], erros })
          return
        }

        results.data.forEach((linha, index) => {
          linhaAtual = index + 2

          const regiao = linha.REGIAO?.trim()
          const cepInicial = linha.CEP_INICIAL?.trim()
          const cepFinal = linha.CEP_FINAL?.trim()

          if (!regiao || !cepInicial || !cepFinal) {
            erros.push({
              linha: linhaAtual,
              mensagem: 'Região, CEP inicial ou CEP final vazio'
            })
            return
          }

          const chaveRegiao = `${regiao}|${cepInicial}|${cepFinal}`

          if (!regioesMapa.has(chaveRegiao)) {
            regioesMapa.set(chaveRegiao, {
              nome: regiao,
              cepInicio: cepInicial,
              cepFim: cepFinal,
              icms: parseFloat(linha.ICMS),
              kgAdicional: parseFloat(linha.KG_ADICIONAL),
              taxas: {
                freteTipo: normalizarTipo(linha.FRETE_VALOR_TIPO),
                freteValor: parseFloat(linha.FRETE_VALOR),
                freteMinimo: parseFloat(linha.FRETE_VALOR_MINIMO),
                grisTipo: normalizarTipo(linha.GRIS_TIPO),
                grisValor: parseFloat(linha.GRIS_VALOR),
                grisMinimo: parseFloat(linha.GRIS_MINIMO),
                despachoTipo: normalizarTipo(linha.DESPACHO_TIPO),
                despachoValor: parseFloat(linha.DESPACHO_VALOR),
                despachoMinimo: parseFloat(linha.DESPACHO_MINIMO),
                pedagioValor: parseFloat(linha.PEDAGIO_VALOR),
                tasTipo: normalizarTipo(linha.TAS_TIPO),
                tasValor: parseFloat(linha.TAS_VALOR),
                tasMinimo: parseFloat(linha.TAS_MINIMO),
                tdaAtivo: parseBoolean(linha.TDA_ATIVO),
                tdaTipo: normalizarTipo(linha.TDA_TIPO),
                tdaValor: parseFloat(linha.TDA_VALOR),
                tdaMinimo: parseFloat(linha.TDA_MINIMO),
                tdeAtivo: parseBoolean(linha.TDE_ATIVO),
                tdeTipo: normalizarTipo(linha.TDE_TIPO),
                tdeValor: parseFloat(linha.TDE_VALOR),
                tdeMinimo: parseFloat(linha.TDE_MINIMO),
                trfAtivo: parseBoolean(linha.TRF_ATIVO),
                trfTipo: normalizarTipo(linha.TRF_TIPO),
                trfValor: parseFloat(linha.TRF_VALOR),
                trfMinimo: parseFloat(linha.TRF_MINIMO),
                seguroFluvialAtivo: parseBoolean(linha.SEGURO_FLUVIAL_ATIVO),
                seguroFluvialTipo: normalizarTipo(linha.SEGURO_FLUVIAL_TIPO),
                seguroFluvialValor: parseFloat(linha.SEGURO_FLUVIAL_VALOR),
                seguroFluvialMinimo: parseFloat(linha.SEGURO_FLUVIAL_MINIMO),
                trtAtivo: parseBoolean(linha.TRT_ATIVO),
                trtTipo: normalizarTipo(linha.TRT_TIPO),
                trtValor: parseFloat(linha.TRT_VALOR),
                trtMinimo: parseFloat(linha.TRT_MINIMO),
                suframaAtivo: parseBoolean(linha.SUFRAMA_ATIVO),
                suframaTipo: normalizarTipo(linha.SUFRAMA_TIPO),
                suframaValor: parseFloat(linha.SUFRAMA_VALOR),
                suframaMinimo: parseFloat(linha.SUFRAMA_MINIMO),
              },
              faixas: []
            })
          }

          const pesoInicial = parseFloat(linha.PESO_INICIAL)
          const pesoFinal = parseFloat(linha.PESO_FINAL)
          const valor = parseFloat(linha.VALOR)
          const prazo = parseInt(linha.PRAZO)

          if (pesoFinal > 0 && valor > 0) {
            const regiaoDados = regioesMapa.get(chaveRegiao)!
            regiaoDados.faixas.push({
              pesoInicial,
              pesoFinal,
              valor,
              prazo
            })
          }
        })

        resolve({
          regioes: Array.from(regioesMapa.values()),
          erros
        })
      },
      error: (error) => {
        erros.push({
          linha: 0,
          mensagem: `Erro ao processar arquivo: ${error.message}`
        })
        resolve({ regioes: [], erros })
      }
    })
  })
}
