import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { withAuth } from '@/lib/middleware/auth'
import { cepToEstado } from '@/lib/utils/cep-to-estado'

export const revalidate = 60

/**
 * GET /api/relatorios/stats?dias=7
 *
 * Agrega métricas de requisições e cotações do usuário:
 * - Cards: total, sucesso, erro, taxa
 * - Gráfico: cotações por dia no período
 * - Mapa: cotações por estado (UF)
 */
export const GET = withAuth(async (req, { userId }) => {
  try {
    const { searchParams } = new URL(req.url)
    const diasParam = searchParams.get('dias')
    const dias = diasParam ? parseInt(diasParam) : 7
    const diasValidos = [7, 30, 90]
    const diasFiltro = diasValidos.includes(dias) ? dias : 7

    const hoje = new Date()
    hoje.setHours(23, 59, 59, 999)
    const dataInicio = new Date(hoje)
    dataInicio.setDate(dataInicio.getDate() - (diasFiltro - 1))
    dataInicio.setHours(0, 0, 0, 0)

    // 1. Stats de requisições (IntegracaoLog) — total, sucesso, erro
    const [totalRequisicoes, sucessoCount, erroCount] = await Promise.all([
      prisma.integracaoLog.count({
        where: {
          criadoEm: { gte: dataInicio },
          usuarioCanal: { usuarioId: userId },
        },
      }),
      prisma.integracaoLog.count({
        where: {
          criadoEm: { gte: dataInicio },
          usuarioCanal: { usuarioId: userId },
          statusCode: { gte: 200, lt: 300 },
        },
      }),
      prisma.integracaoLog.count({
        where: {
          criadoEm: { gte: dataInicio },
          usuarioCanal: { usuarioId: userId },
          statusCode: { gte: 400 },
        },
      }),
    ])

    // 2. Cotações por dia + por CEP (uma só query)
    const cotacoes = await prisma.cotacaoLog.findMany({
      where: {
        dataCotacao: { gte: dataInicio },
        usuarioId: userId,
      },
      select: { dataCotacao: true, cep: true },
    })

    // 3. Agrupar por dia
    const porDiaMap = new Map<string, number>()
    cotacoes.forEach(c => {
      const dia = c.dataCotacao.toISOString().split('T')[0]
      porDiaMap.set(dia, (porDiaMap.get(dia) || 0) + 1)
    })

    const grafico = Array.from({ length: diasFiltro }, (_, i) => {
      const d = new Date(dataInicio)
      d.setDate(d.getDate() + i)
      const dia = d.toISOString().split('T')[0]
      return { data: dia, cotacoes: porDiaMap.get(dia) || 0 }
    })

    // 4. Agrupar por estado
    const porEstadoMap = new Map<string, number>()
    let cotacoesSemEstado = 0
    cotacoes.forEach(c => {
      const uf = cepToEstado(c.cep)
      if (uf) {
        porEstadoMap.set(uf, (porEstadoMap.get(uf) || 0) + 1)
      } else {
        cotacoesSemEstado++
      }
    })

    const porEstado = Array.from(porEstadoMap.entries())
      .map(([uf, total]) => ({ uf, total }))
      .sort((a, b) => b.total - a.total)

    return NextResponse.json({
      periodo: { dias: diasFiltro, inicio: dataInicio.toISOString(), fim: hoje.toISOString() },
      cards: {
        totalRequisicoes,
        sucesso: sucessoCount,
        erro: erroCount,
        taxaSucesso: totalRequisicoes > 0 ? Math.round((sucessoCount / totalRequisicoes) * 1000) / 10 : 0,
        totalCotacoes: cotacoes.length,
      },
      grafico,
      porEstado,
      cotacoesSemEstado,
    })
  } catch (error) {
    logger.error('Erro ao buscar relatórios:', error)
    return NextResponse.json({ erro: 'Erro ao buscar relatórios' }, { status: 500 })
  }
})
