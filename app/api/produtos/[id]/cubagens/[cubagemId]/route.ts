import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { withAuthTyped } from '@/lib/middleware/auth'
import { parseRouteId } from '@/lib/utils/parse'
import { verifyOwnership } from '@/lib/utils/ownership'
import { invalidateProdutoCache } from '@/lib/cache'

interface RouteParams {
  id: string
  cubagemId: string
}

export const DELETE = withAuthTyped<RouteParams>(async (req, { userId }, params) => {
  try {
    const produtoId = parseRouteId(params!.id)
    const cubagemId = parseRouteId(params!.cubagemId)

    // Verificar ownership via produto pai (cubagem não tem usuarioId direto)
    const produto = await verifyOwnership(
      prisma.produto,
      produtoId,
      userId
    )

    if (!produto) {
      return NextResponse.json(
        { erro: 'Produto não encontrado ou sem permissão' },
        { status: 404 }
      )
    }

    // Verificar que cubagem pertence ao produto do usuário
    const cubagem = await prisma.produtoTransportadoraCubagem.findFirst({
      where: {
        id: cubagemId,
        produtoId: produtoId,
      },
    })

    if (!cubagem) {
      return NextResponse.json(
        { erro: 'Cubagem não encontrada neste produto' },
        { status: 404 }
      )
    }

    await prisma.produtoTransportadoraCubagem.delete({
      where: { id: cubagemId },
    })

    invalidateProdutoCache(userId).catch(() => {})
    return NextResponse.json({ sucesso: true })
  } catch (error) {
    logger.error('Erro ao deletar cubagem:', error)
    return NextResponse.json(
      { erro: 'Erro ao deletar cubagem' },
      { status: 500 }
    )
  }
})
