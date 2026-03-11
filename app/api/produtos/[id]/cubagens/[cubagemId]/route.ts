import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { withAuthTyped } from '@/lib/middleware/auth'
import { parseRouteId } from '@/lib/utils/parse'
import { verifyOwnership } from '@/lib/utils/ownership'

interface RouteParams {
  id: string
  cubagemId: string
}

export const DELETE = withAuthTyped<RouteParams>(async (req, { userId }, params) => {
  try {
    const produtoId = parseRouteId(params!.id)
    const cubagemId = parseRouteId(params!.cubagemId)

    const cubagem = await verifyOwnership(
      prisma.produtoTransportadoraCubagem,
      cubagemId,
      userId
    )

    if (!cubagem) {
      return NextResponse.json(
        { erro: 'Cubagem não encontrada ou sem permissão' },
        { status: 404 }
      )
    }

    await prisma.produtoTransportadoraCubagem.delete({
      where: { id: cubagemId },
    })

    return NextResponse.json({ sucesso: true })
  } catch (error) {
    logger.error('Erro ao deletar cubagem:', error)
    return NextResponse.json(
      { erro: 'Erro ao deletar cubagem' },
      { status: 500 }
    )
  }
})
