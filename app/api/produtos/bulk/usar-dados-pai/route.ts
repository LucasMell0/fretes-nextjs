import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { withAuth } from '@/lib/middleware/auth'
import { invalidateProdutoCache } from '@/lib/cache'

/**
 * POST /api/produtos/bulk/usar-dados-pai
 *
 * Body opcional: { valor?: boolean }  (default true)
 *
 * Ativa (ou desativa) o flag usarDadosPaiParaVariacoes em TODOS os
 * produtos cadastrados pelo usuário logado.
 */
export const POST = withAuth(async (req, { userId }) => {
  try {
    let valor = true
    try {
      const body = await req.json()
      if (typeof body?.valor === 'boolean') valor = body.valor
    } catch {
      // sem body — usa default true
    }

    const result = await prisma.produto.updateMany({
      where: { usuarioId: userId },
      data: { usarDadosPaiParaVariacoes: valor },
    })

    invalidateProdutoCache(userId).catch(() => {})
    return NextResponse.json({ success: true, atualizados: result.count, valor })
  } catch (error) {
    logger.error('Erro ao aplicar usar-dados-pai em massa:', error)
    return NextResponse.json(
      { error: 'Erro ao aplicar configuração em massa' },
      { status: 500 }
    )
  }
})
