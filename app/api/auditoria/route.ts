import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/middleware/auth'
import { logger } from '@/lib/logger'

/**
 * GET /api/auditoria
 *
 * Página unificada de Requisições + Auditoria.
 * Lista cotações de CotacaoLog (sucesso e falha) + retorna em separado
 * as falhas pendentes (AuditoriaCotacao) para serem mostradas numa seção.
 *
 * Query: page, limit, origem (MANUAL/API), cep, resultado (com/sem)
 */
export const GET = withAuth(async (req, { userId }) => {
  try {
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '30')
    const skip = (page - 1) * limit
    const filtroOrigem = searchParams.get('origem')
    const filtroCep = searchParams.get('cep')
    const filtroResultado = searchParams.get('resultado') // 'com' / 'sem' / null

    const where: Record<string, unknown> = { usuarioId: userId }

    if (filtroOrigem && filtroOrigem !== 'todos') {
      where.origem = filtroOrigem
    }

    if (filtroCep) {
      where.cep = { contains: filtroCep.replace(/\D/g, '') }
    }

    if (filtroResultado === 'com') {
      where.totalTransportadoras = { gt: 0 }
    } else if (filtroResultado === 'sem') {
      where.totalTransportadoras = 0
    }

    const auditoriaWhere = { usuarioId: userId }

    const [
      logs,
      totalFiltrado,
      total,
      totalComResultado,
      totalSemResultado,
      totalPendentesAuditoria,
      totalResolvidosAuditoria,
      tempoMedioAgg,
      auditoriaPendentes,
    ] = await Promise.all([
      prisma.cotacaoLog.findMany({
        where,
        include: {
          transportadora: { select: { nome: true } },
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
      prisma.cotacaoLog.count({ where: { usuarioId: userId } }),
      prisma.cotacaoLog.count({ where: { usuarioId: userId, totalTransportadoras: { gt: 0 } } }),
      prisma.cotacaoLog.count({ where: { usuarioId: userId, totalTransportadoras: 0 } }),
      prisma.auditoriaCotacao.count({ where: { ...auditoriaWhere, status: 'PENDENTE' } }),
      prisma.auditoriaCotacao.count({ where: { ...auditoriaWhere, status: 'RESOLVIDO' } }),
      prisma.cotacaoLog.aggregate({
        where: { usuarioId: userId, tempoMs: { not: null } },
        _avg: { tempoMs: true },
      }),
      // Lista compacta dos 50 pendentes mais recentes pra seção secundária
      prisma.auditoriaCotacao.findMany({
        where: { ...auditoriaWhere, status: 'PENDENTE' },
        include: {
          integracao: {
            select: {
              id: true,
              canal: { select: { nome: true, slug: true } },
            },
          },
        },
        orderBy: { criadoEm: 'desc' },
        take: 50,
      }),
    ])

    const logsFormatados = logs.map(log => {
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
      cards: {
        total,
        comResultado: totalComResultado,
        semResultado: totalSemResultado,
        pendentesAuditoria: totalPendentesAuditoria,
        resolvidosAuditoria: totalResolvidosAuditoria,
        tempoMedio: tempoMedioAgg._avg.tempoMs ? Math.round(tempoMedioAgg._avg.tempoMs) : null,
      },
      logs: logsFormatados,
      paginacao: {
        totalFiltrado,
        pagina: page,
        limit,
        totalPaginas: Math.ceil(totalFiltrado / limit),
      },
      auditoriaPendentes: auditoriaPendentes.map(a => ({
        id: a.id,
        tipo: a.tipo,
        descricao: a.descricao,
        cep: a.cep,
        skus: a.skus,
        origem: a.origem,
        marketplace: a.marketplace,
        criadoEm: a.criadoEm,
        integracao: a.integracao,
      })),
    })
  } catch (error) {
    logger.error('Erro ao buscar auditoria:', error)
    return NextResponse.json({ erro: 'Erro ao buscar auditoria' }, { status: 500 })
  }
})

/**
 * PATCH /api/auditoria - Atualiza status (individual ou em lote)
 */
export const PATCH = withAuth(async (req, { userId }) => {
  const body = await req.json()
  const { id, ids, status } = body

  if (!status || !['PENDENTE', 'RESOLVIDO'].includes(status)) {
    return NextResponse.json(
      { erro: 'status (PENDENTE ou RESOLVIDO) é obrigatório' },
      { status: 400 }
    )
  }

  const idsAlvo: number[] = Array.isArray(ids) ? ids.filter(n => Number.isInteger(n)) : (id ? [id] : [])

  if (idsAlvo.length === 0) {
    return NextResponse.json({ erro: 'Informe id ou ids' }, { status: 400 })
  }

  const result = await prisma.auditoriaCotacao.updateMany({
    where: { id: { in: idsAlvo }, usuarioId: userId },
    data: {
      status,
      resolvidoEm: status === 'RESOLVIDO' ? new Date() : null,
    },
  })

  return NextResponse.json({ atualizados: result.count })
})
