import { prisma } from '@/lib/prisma'
import type { RegiaoParaImportar, ResultadoImportacao, ErroImportacao } from '@/types/importacao'
import { validarFaixasEmLote } from '@/lib/validators/faixa-peso.validator'

export class ImportacaoService {
  async importarRegioes(
    transportadoraId: number,
    tenantId: number,
    regioes: RegiaoParaImportar[]
  ): Promise<ResultadoImportacao> {
    const erros: ErroImportacao[] = []
    let regioesImportadas = 0
    let faixasImportadas = 0

    try {
      await prisma.$transaction(async (tx) => {
        const transportadora = await tx.transportadora.findUnique({
          where: {
            id: transportadoraId,
          },
        })

        if (!transportadora) {
          throw new Error('Transportadora não encontrada')
        }

        for (const regiao of regioes) {
          try {
            // Validar faixas de peso da região
            if (regiao.faixas.length > 0) {
              const validacaoFaixas = validarFaixasEmLote(regiao.faixas)
              if (!validacaoFaixas.valido) {
                erros.push({
                  linha: 0,
                  mensagem: `Região "${regiao.nome}": ${validacaoFaixas.mensagem}`,
                })
                continue
              }
            }

            const regiaoNoBanco = await tx.transportadoraRegiao.create({
              data: {
                transportadoraId: transportadoraId,
                nome: regiao.nome,
                cepInicio: regiao.cepInicio,
                cepFim: regiao.cepFim,
                ativo: true,
                usuarioId: tenantId,
              },
            })

            if (regiao.faixas.length > 0) {
              await tx.transportadoraRegiaoPreco.createMany({
                data: regiao.faixas.map((faixa) => ({
                  transportadoraRegiaoId: regiaoNoBanco.id,
                  pesoInicial: faixa.pesoInicial,
                  pesoFinal: faixa.pesoFinal,
                  valor: faixa.valor,
                  prazo: faixa.prazo,
                })),
              })
              faixasImportadas += regiao.faixas.length
            }

            if (regiao.kgAdicional > 0) {
              await tx.transportadoraRegiaoKgAdicional.create({
                data: {
                  transportadoraRegiaoId: regiaoNoBanco.id,
                  valorKgAdicional: regiao.kgAdicional,
                },
              })
            }

            await tx.transportadoraRegiaoTaxa.create({
              data: {
                transportadoraRegiaoId: regiaoNoBanco.id,
                freteTipo: regiao.taxas.freteTipo,
                freteValor: regiao.taxas.freteValor,
                freteMinimo: regiao.taxas.freteMinimo,
                grisTipo: regiao.taxas.grisTipo,
                grisValor: regiao.taxas.grisValor,
                grisMinimo: regiao.taxas.grisMinimo,
                despachoTipo: regiao.taxas.despachoTipo,
                despachoValor: regiao.taxas.despachoValor,
                despachoMinimo: regiao.taxas.despachoMinimo,
                pedagioValor: regiao.taxas.pedagioValor,
                tasTipo: regiao.taxas.tasTipo,
                tasValor: regiao.taxas.tasValor,
                tasMinimo: regiao.taxas.tasMinimo,
                icms: regiao.icms,
                tdaAtivo: regiao.taxas.tdaAtivo,
                tdaTipo: regiao.taxas.tdaTipo,
                tdaValor: regiao.taxas.tdaValor,
                tdaMinimo: regiao.taxas.tdaMinimo,
                tdeAtivo: regiao.taxas.tdeAtivo,
                tdeTipo: regiao.taxas.tdeTipo,
                tdeValor: regiao.taxas.tdeValor,
                tdeMinimo: regiao.taxas.tdeMinimo,
                trfAtivo: regiao.taxas.trfAtivo,
                trfTipo: regiao.taxas.trfTipo,
                trfValor: regiao.taxas.trfValor,
                trfMinimo: regiao.taxas.trfMinimo,
                seguroFluvialAtivo: regiao.taxas.seguroFluvialAtivo,
                seguroFluvialTipo: regiao.taxas.seguroFluvialTipo,
                seguroFluvialValor: regiao.taxas.seguroFluvialValor,
                seguroFluvialMinimo: regiao.taxas.seguroFluvialMinimo,
                trtAtivo: regiao.taxas.trtAtivo,
                trtTipo: regiao.taxas.trtTipo,
                trtValor: regiao.taxas.trtValor,
                trtMinimo: regiao.taxas.trtMinimo,
                suframaAtivo: regiao.taxas.suframaAtivo,
                suframaTipo: regiao.taxas.suframaTipo,
                suframaValor: regiao.taxas.suframaValor,
                suframaMinimo: regiao.taxas.suframaMinimo,
              },
            })

            regioesImportadas++
          } catch (error) {
            erros.push({
              linha: 0,
              mensagem: `Erro ao importar região "${regiao.nome}": ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
            })
          }
        }
      })

      return {
        sucesso: erros.length === 0,
        regioesImportadas,
        faixasImportadas,
        erros,
      }
    } catch (error) {
      return {
        sucesso: false,
        regioesImportadas: 0,
        faixasImportadas: 0,
        erros: [
          {
            linha: 0,
            mensagem: `Erro na transação: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
          },
        ],
      }
    }
  }
}
