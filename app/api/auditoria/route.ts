import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/middleware/auth'
import { logger } from '@/lib/logger'

/**
 * GET /api/auditoria
 *
 * Tabela unificada: lista CotacaoLog (sucesso/sem-resultado) +
 * AuditoriaCotacao (pendente/resolvido) numa lista só, ordenada por
 * data desc.
 *
 * Filtros: origem, cep, status (todos/sucesso/sem_resultado/pendente/resolvido)
 */
export const GET = withAuth(async (req, { userId }) => {
  try {
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '30')
    const skip = (page - 1) * limit
    const filtroOrigem = searchParams.get('origem')
    const filtroCep = searchParams.get('cep')
    const filtroStatus = searchParams.get('status') // todos | sucesso | sem_resultado | pendente | resolvido

    const cepLimpo = filtroCep ? filtroCep.replace(/\D/g, '') : null

    // ===== Decide quais sources buscar =====
    const wantCotacao = !filtroStatus || filtroStatus === 'todos' || filtroStatus === 'sucesso' || filtroStatus === 'sem_resultado'
    const wantAuditoria = !filtroStatus || filtroStatus === 'todos' || filtroStatus === 'pendente' || filtroStatus === 'resolvido'

    // ===== Where comuns =====
    const cotacaoWhere: Record<string, unknown> = { usuarioId: userId }
    const auditoriaWhere: Record<string, unknown> = { usuarioId: userId }

    if (filtroOrigem && filtroOrigem !== 'todos') {
      cotacaoWhere.origem = filtroOrigem
      auditoriaWhere.origem = filtroOrigem
    }
    if (cepLimpo) {
      cotacaoWhere.cep = { contains: cepLimpo }
      auditoriaWhere.cep = { contains: cepLimpo }
    }
    if (filtroStatus === 'sucesso') {
      cotacaoWhere.totalTransportadoras = { gt: 0 }
    } else if (filtroStatus === 'sem_resultado') {
      cotacaoWhere.totalTransportadoras = 0
    }
    if (filtroStatus === 'pendente') {
      auditoriaWhere.status = 'PENDENTE'
    } else if (filtroStatus === 'resolvido') {
      auditoriaWhere.status = 'RESOLVIDO'
    }

    // ===== Fetch (top N de cada pra mesclar) =====
    // Pra paginação correta sem UNION SQL, pega (skip+limit)*2 de cada lado
    const fetchSize = (skip + limit) * 2

    const [cotacoes, auditorias, totalCotacoes, totalAuditorias, statsCotacao, statsAuditoria, tempoMedioAgg] = await Promise.all([
      wantCotacao ? prisma.cotacaoLog.findMany({
        where: cotacaoWhere,
        include: {
          transportadora: { select: { nome: true } },
          produtos: {
            select: { produtoSku: true, produtoNome: true, quantidade: true, pesoTotal: true },
          },
        },
        orderBy: { dataCotacao: 'desc' },
        take: fetchSize,
      }) : [],
      wantAuditoria ? prisma.auditoriaCotacao.findMany({
        where: auditoriaWhere,
        include: {
          integracao: {
            select: {
              id: true,
              canal: { select: { nome: true, slug: true } },
            },
          },
        },
        orderBy: { criadoEm: 'desc' },
        take: fetchSize,
      }) : [],
      wantCotacao ? prisma.cotacaoLog.count({ where: cotacaoWhere }) : 0,
      wantAuditoria ? prisma.auditoriaCotacao.count({ where: auditoriaWhere }) : 0,
      // Stats globais respeitando filtros (origem + cep)
      prisma.cotacaoLog.groupBy({
        by: ['usuarioId'],
        where: {
          usuarioId: userId,
          ...(filtroOrigem && filtroOrigem !== 'todos' ? { origem: filtroOrigem } : {}),
          ...(cepLimpo ? { cep: { contains: cepLimpo } } : {}),
        },
        _count: true,
      }),
      prisma.auditoriaCotacao.groupBy({
        by: ['status'],
        where: {
          usuarioId: userId,
          ...(filtroOrigem && filtroOrigem !== 'todos' ? { origem: filtroOrigem } : {}),
          ...(cepLimpo ? { cep: { contains: cepLimpo } } : {}),
        },
        _count: true,
      }),
      prisma.cotacaoLog.aggregate({
        where: {
          usuarioId: userId,
          tempoMs: { not: null },
          ...(filtroOrigem && filtroOrigem !== 'todos' ? { origem: filtroOrigem } : {}),
          ...(cepLimpo ? { cep: { contains: cepLimpo } } : {}),
        },
        _avg: { tempoMs: true },
      }),
    ])

    // Counts por status para os cards (auditoria)
    const pendentes = statsAuditoria.find(s => s.status === 'PENDENTE')?._count || 0
    const resolvidos = statsAuditoria.find(s => s.status === 'RESOLVIDO')?._count || 0
    const totalCotacaoGlobal = statsCotacao[0]?._count || 0

    // Counts sucesso/sem-resultado precisam de queries extras (totalTransportadoras)
    const [cotacoesComResultado, cotacoesSemResultado] = await Promise.all([
      prisma.cotacaoLog.count({
        where: {
          usuarioId: userId,
          totalTransportadoras: { gt: 0 },
          ...(filtroOrigem && filtroOrigem !== 'todos' ? { origem: filtroOrigem } : {}),
          ...(cepLimpo ? { cep: { contains: cepLimpo } } : {}),
        },
      }),
      prisma.cotacaoLog.count({
        where: {
          usuarioId: userId,
          totalTransportadoras: 0,
          ...(filtroOrigem && filtroOrigem !== 'todos' ? { origem: filtroOrigem } : {}),
          ...(cepLimpo ? { cep: { contains: cepLimpo } } : {}),
        },
      }),
    ])

    // ===== Mescla =====
    type ItemCotacao = {
      kind: 'cotacao'
      id: number
      data: string
      cep: string
      origem: string
      marketplace: string | null
      statusGeral: 'sucesso' | 'sem_resultado'
      tempoMs: number | null
      melhorValor: number | null
      melhorPrazo: number | null
      totalTransportadoras: number
      produtos: Array<{ sku: string; nome: string; quantidade: number; pesoTotal: number }>
      // detalhes para modal
      melhorTransportadora: string | null
      resultados: Array<Record<string, unknown>>
      erros: string[]
      respostaCanal: Record<string, unknown> | null
      requestRaw: string
      responseRaw: string
      ipOrigem: string | null
    }
    type ItemAuditoria = {
      kind: 'auditoria'
      id: number
      data: string
      cep: string | null
      origem: string
      marketplace: string | null
      statusGeral: 'pendente' | 'resolvido'
      tipo: 'SKU_NAO_ENCONTRADO' | 'CEP_NAO_ATENDIDO'
      descricao: string
      skus: string[]
      integracao: { id: number; canal: { nome: string; slug: string } } | null
    }
    type Item = ItemCotacao | ItemAuditoria

    const itensCotacao: ItemCotacao[] = cotacoes.map(log => {
      let resultados: Array<Record<string, unknown>> = []
      let erros: string[] = []
      let respostaCanal: Record<string, unknown> | null = null
      try {
        const parsed = JSON.parse(log.resultadoJson)
        if (Array.isArray(parsed)) resultados = parsed
        else if (parsed.cotacoes) {
          resultados = parsed.cotacoes || []
          erros = parsed._erros || []
          respostaCanal = parsed._respostaCanal || null
        }
      } catch { /* ignore */ }

      return {
        kind: 'cotacao',
        id: log.id,
        data: log.dataCotacao.toISOString(),
        cep: log.cep,
        origem: log.origem,
        marketplace: log.marketplace,
        statusGeral: log.totalTransportadoras > 0 ? 'sucesso' : 'sem_resultado',
        tempoMs: log.tempoMs,
        melhorValor: log.melhorValor ? Number(log.melhorValor) : null,
        melhorPrazo: log.melhorPrazo,
        totalTransportadoras: log.totalTransportadoras,
        melhorTransportadora: log.transportadora?.nome || null,
        produtos: log.produtos.map(p => ({
          sku: p.produtoSku, nome: p.produtoNome, quantidade: p.quantidade, pesoTotal: Number(p.pesoTotal),
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
        ipOrigem: log.ipOrigem,
      }
    })

    const itensAuditoria: ItemAuditoria[] = auditorias.map(a => ({
      kind: 'auditoria',
      id: a.id,
      data: a.criadoEm.toISOString(),
      cep: a.cep,
      origem: a.origem,
      marketplace: a.marketplace,
      statusGeral: a.status === 'PENDENTE' ? 'pendente' : 'resolvido',
      tipo: a.tipo as 'SKU_NAO_ENCONTRADO' | 'CEP_NAO_ATENDIDO',
      descricao: a.descricao,
      skus: a.skus,
      integracao: a.integracao,
    }))

    const merged: Item[] = [...itensCotacao, ...itensAuditoria]
      .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())

    const totalFiltrado = totalCotacoes + totalAuditorias
    const paginated = merged.slice(skip, skip + limit)

    return NextResponse.json({
      cards: {
        total: totalCotacaoGlobal,
        comResultado: cotacoesComResultado,
        semResultado: cotacoesSemResultado,
        pendentesAuditoria: pendentes,
        resolvidosAuditoria: resolvidos,
        tempoMedio: tempoMedioAgg._avg.tempoMs ? Math.round(tempoMedioAgg._avg.tempoMs) : null,
      },
      itens: paginated,
      paginacao: {
        totalFiltrado,
        pagina: page,
        limit,
        totalPaginas: Math.ceil(totalFiltrado / limit),
      },
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
