import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/middleware/auth'
import { logger } from '@/lib/logger'

export const GET = withAuth(async (req, { userId }) => {
  try {
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '30')
    const skip = (page - 1) * limit
    const filtroOrigem = searchParams.get('origem')
    const filtroCep = searchParams.get('cep')

    const where: Record<string, unknown> = { usuarioId: userId }

    if (filtroOrigem && filtroOrigem !== 'todos') {
      where.origem = filtroOrigem
    }

    if (filtroCep) {
      where.cep = { contains: filtroCep.replace(/\D/g, '') }
    }

    const [logs, total] = await Promise.all([
      prisma.cotacaoLog.findMany({
        where,
        include: {
          transportadora: {
            select: { nome: true },
          },
          produtos: {
            select: {
              produtoSku: true,
              produtoNome: true,
              quantidade: true,
              pesoTotal: true,
            },
          },
        },
        orderBy: { dataCotacao: 'desc' },
        skip,
        take: limit,
      }),
      prisma.cotacaoLog.count({ where }),
    ])

    const logsFormatados = logs.map(log => {
      // Extrair resultados do JSON (formato novo ou legado)
      let resultados: Array<Record<string, unknown>> = []
      let erros: string[] = []
      let respostaCanal: Record<string, unknown> | null = null
      try {
        const parsed = JSON.parse(log.resultadoJson)
        if (Array.isArray(parsed)) {
          resultados = parsed
        } else if (parsed.cotacoes) {
          resultados = parsed.cotacoes || []
          erros = parsed._erros || []
          respostaCanal = parsed._respostaCanal || null
        }
      } catch { /* ignore */ }

      return {
        id: log.id,
        cep: log.cep,
        origem: log.origem,
        marketplace: log.marketplace,
        melhorValor: log.melhorValor,
        melhorPrazo: log.melhorPrazo,
        melhorTransportadora: log.transportadora?.nome || null,
        totalTransportadoras: log.totalTransportadoras,
        dataCotacao: log.dataCotacao,
        ipOrigem: log.ipOrigem,
        userAgent: log.userAgent,
        tempoMs: log.tempoMs,
        produtos: log.produtos.map(p => ({
          sku: p.produtoSku,
          nome: p.produtoNome,
          quantidade: p.quantidade,
          pesoTotal: Number(p.pesoTotal),
        })),
        resultados: resultados.map((r: Record<string, unknown>) => ({
          transportadora: r.transportadora_nome,
          valor: r.valor_frete,
          prazo: r.prazo_entrega,
          pesoReal: r.peso_real,
          pesoCubado: r.peso_cubado,
          pesoTaxado: r.peso_taxado,
        })),
        erros,
        respostaCanal,
        requestRaw: log.produtosJson,
        responseRaw: log.resultadoJson,
      }
    })

    return NextResponse.json({
      logs: logsFormatados,
      total,
      pagina: page,
      totalPaginas: Math.ceil(total / limit),
    })
  } catch (error) {
    logger.error('Erro ao buscar logs de requisições:', error)
    return NextResponse.json(
      { erro: 'Erro ao buscar logs' },
      { status: 500 }
    )
  }
})
