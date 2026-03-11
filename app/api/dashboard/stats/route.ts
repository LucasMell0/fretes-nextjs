import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { withAuth } from '@/lib/middleware/auth'
import { getSessionUserId } from '@/lib/utils/parse'

// OTIMIZADO: Cache de 60 segundos para reduzir carga no banco
export const revalidate = 60

export const GET = withAuth(async (req, { userId }) => {
  try {
    // Obter parâmetro de dias (padrão: 90)
    const { searchParams } = new URL(req.url)
    const diasParam = searchParams.get('dias')
    const dias = diasParam ? parseInt(diasParam) : 7
    
    // Validar dias (apenas 7, 30 ou 90)
    const diasValidos = [7, 30, 90]
    const diasFiltro = diasValidos.includes(dias) ? dias : 7
    
    const hoje = new Date()
    hoje.setHours(23, 59, 59, 999) // Fim do dia de hoje
    
    const dataInicio = new Date(hoje)
    dataInicio.setDate(dataInicio.getDate() - (diasFiltro - 1))
    dataInicio.setHours(0, 0, 0, 0) // Início do dia

    const usuarioId = userId

    const [
      totalTransportadoras,
      totalRegioes,
      totalProdutos,
      todasCotacoes,
      produtosCotados,
    ] = await Promise.all([
      prisma.transportadora.count({ where: { ativo: true, usuarioId } }),
      prisma.transportadoraRegiao.count({ where: { ativo: true, usuarioId } }),
      prisma.produto.count({ where: { ativo: true, usuarioId } }),
      prisma.cotacaoLog.findMany({
        where: {
          dataCotacao: { gte: dataInicio },
          usuarioId,
        },
        select: {
          dataCotacao: true,
        },
      }),
      prisma.cotacaoLogProduto.findMany({
        where: {
          cotacao: {
            dataCotacao: { gte: dataInicio },
            usuarioId,
          },
        },
        select: {
          produtoId: true,
          produtoNome: true,
          produtoSku: true,
          cotacaoLogId: true,
        },
      }),
    ])

    // OTIMIZADO: Contar cotações de hoje a partir dos dados já carregados
    const hojeInicio = new Date()
    hojeInicio.setHours(0, 0, 0, 0)
    const hojeStr = hojeInicio.toISOString().split('T')[0]
    const cotacoesHoje = todasCotacoes.filter(c => 
      c.dataCotacao.toISOString().split('T')[0] === hojeStr
    ).length

    // OTIMIZADO: Agrupar cotações por dia em O(n) usando Map
    const cotacoesPorDiaMap = new Map<string, number>()
    
    // Preencher Map com contagem (O(n))
    todasCotacoes.forEach(c => {
      const dataStr = c.dataCotacao.toISOString().split('T')[0]
      cotacoesPorDiaMap.set(dataStr, (cotacoesPorDiaMap.get(dataStr) || 0) + 1)
    })

    // Gerar array de dias dinâmico
    const cotacoesPorDia = Array.from({ length: diasFiltro }, (_, i) => {
      const data = new Date(dataInicio)
      data.setDate(data.getDate() + i)
      const dataStr = data.toISOString().split('T')[0]
      
      return {
        data: dataStr,
        cotacoes: cotacoesPorDiaMap.get(dataStr) || 0,
      }
    })

    // Agrupar produtos e contar cotações
    const produtosMap = new Map<number, { nome: string; sku: string; count: number }>()
    
    produtosCotados.forEach(p => {
      const existing = produtosMap.get(p.produtoId)
      if (existing) {
        existing.count++
      } else {
        produtosMap.set(p.produtoId, {
          nome: p.produtoNome,
          sku: p.produtoSku,
          count: 1,
        })
      }
    })

    // Converter para array, ordenar e pegar TOP 5
    const topProdutos = Array.from(produtosMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map(p => ({
        nome: p.nome,
        sku: p.sku,
        total_cotacoes: p.count,
      }))

    return NextResponse.json({
      cards: {
        totalTransportadoras,
        totalRegioes,
        totalProdutos,
        cotacoesHoje,
      },
      grafico: cotacoesPorDia,
      topProdutos,
    })
  } catch (error) {
    logger.error('Erro ao buscar estatísticas:', error)
    return NextResponse.json(
      { erro: 'Erro ao buscar estatísticas' },
      { status: 500 }
    )
  }
})
