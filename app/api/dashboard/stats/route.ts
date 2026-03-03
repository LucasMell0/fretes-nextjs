import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// OTIMIZADO: Cache de 60 segundos para reduzir carga no banco
export const revalidate = 60

export async function GET() {
  try {
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    
    const noventaDiasAtras = new Date(hoje)
    noventaDiasAtras.setDate(noventaDiasAtras.getDate() - 89)

    const [
      totalTransportadoras,
      totalRegioes,
      totalProdutos,
      todasCotacoes,
      produtosCotados,
    ] = await Promise.all([
      prisma.transportadora.count({ where: { ativo: true } }),
      prisma.transportadoraRegiao.count({ where: { ativo: true } }),
      prisma.produto.count({ where: { ativo: true } }),
      prisma.cotacaoLog.findMany({
        where: {
          dataCotacao: { gte: noventaDiasAtras },
        },
        select: {
          dataCotacao: true,
        },
      }),
      prisma.cotacaoLogProduto.findMany({
        where: {
          cotacao: {
            dataCotacao: { gte: noventaDiasAtras },
          },
        },
        select: {
          produtoId: true,
          produtoNome: true,
          produtoSku: true,
          cotacao: {
            select: {
              dataCotacao: true,
            },
          },
        },
      }),
    ])

    // OTIMIZADO: Contar cotações de hoje a partir dos dados já carregados
    const hojeStr = hoje.toISOString().split('T')[0]
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

    // Gerar array de 90 dias (O(90))
    const cotacoesPorDia = Array.from({ length: 90 }, (_, i) => {
      const data = new Date(noventaDiasAtras)
      data.setDate(data.getDate() + i)
      const dataStr = data.toISOString().split('T')[0]
      
      return {
        data: dataStr,
        cotacoes: cotacoesPorDiaMap.get(dataStr) || 0,
      }
    })

    // Retornar todos os produtos com data para filtragem no frontend
    const topProdutos = produtosCotados.map(p => ({
      nome: p.produtoNome,
      sku: p.produtoSku,
      total_cotacoes: 1,
      data_cotacao: p.cotacao.dataCotacao.toISOString().split('T')[0],
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
    console.error('Erro ao buscar estatísticas:', error)
    return NextResponse.json(
      { erro: 'Erro ao buscar estatísticas' },
      { status: 500 }
    )
  }
}
