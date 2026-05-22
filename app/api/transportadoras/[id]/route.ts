import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import { parseRouteId } from '@/lib/utils/parse'
import { verifyOwnership } from '@/lib/utils/ownership'
import { withAuthTyped } from '@/lib/middleware/auth'
import { invalidateRegiaoCache, invalidateProdutoCache } from '@/lib/cache'

const transportadoraSchema = z.object({
  nome: z.string().min(3).optional(),
  fatorCubagem: z.number().min(0).optional(),
  margemLucro: z.number().min(0).max(100).optional(),
  ativo: z.boolean().optional(),
})

interface RouteParams {
  id: string
}

export const GET = withAuthTyped<RouteParams>(async (req, { userId }, params) => {
  try {
    const transportadoraId = parseRouteId(params!.id)

    const transportadora = await verifyOwnership(
      prisma.transportadora,
      transportadoraId,
      userId,
      {
        regioes: true,
        _count: { select: { regioes: true } },
      }
    )

    if (!transportadora) {
      return NextResponse.json(
        { erro: 'Transportadora não encontrada ou sem permissão' },
        { status: 404 }
      )
    }

    return NextResponse.json(transportadora)
  } catch (error) {
    logger.error('Erro ao buscar transportadora:', error)
    return NextResponse.json(
      { erro: 'Erro ao buscar transportadora' },
      { status: 500 }
    )
  }
})

export const PUT = withAuthTyped<RouteParams>(async (req, { userId }, params) => {
  try {
    const transportadoraId = parseRouteId(params!.id)

    const transportadora = await verifyOwnership(
      prisma.transportadora,
      transportadoraId,
      userId
    )

    if (!transportadora) {
      return NextResponse.json(
        { erro: 'Transportadora não encontrada ou sem permissão' },
        { status: 404 }
      )
    }

    const body = await req.json()
    const validation = transportadoraSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { erro: 'Dados inválidos', detalhes: validation.error.errors },
        { status: 400 }
      )
    }

    const updated = await prisma.transportadora.update({
      where: { id: transportadoraId },
      data: validation.data,
    })

    invalidateRegiaoCache(userId)
    invalidateProdutoCache(userId) // produtos têm cubagens por transportadora
    return NextResponse.json(updated)
  } catch (error) {
    logger.error('Erro ao atualizar transportadora:', error)
    return NextResponse.json(
      { erro: 'Erro ao atualizar transportadora' },
      { status: 500 }
    )
  }
})

export const DELETE = withAuthTyped<RouteParams>(async (req, { userId }, params) => {
  try {
    const transportadoraId = parseRouteId(params!.id)

    const transportadora = await verifyOwnership(
      prisma.transportadora,
      transportadoraId,
      userId
    )

    if (!transportadora) {
      return NextResponse.json(
        { erro: 'Transportadora não encontrada ou sem permissão' },
        { status: 404 }
      )
    }

    await prisma.transportadora.delete({
      where: { id: transportadoraId }
    })

    invalidateRegiaoCache(userId)
    invalidateProdutoCache(userId)
    return NextResponse.json({ sucesso: true })
  } catch (error) {
    logger.error('Erro ao deletar transportadora:', error)
    return NextResponse.json(
      { erro: 'Erro ao deletar transportadora' },
      { status: 500 }
    )
  }
})
