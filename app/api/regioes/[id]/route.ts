import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import { withAuthTyped } from '@/lib/middleware/auth'
import { parseRouteId } from '@/lib/utils/parse'
import { verifyOwnership } from '@/lib/utils/ownership'
import { verifyTransportadoraOwnership } from '@/lib/validators/relationship.validator'

interface RouteParams {
  id: string
}

const regiaoSchema = z.object({
  nome: z.string().min(3).optional(),
  cepInicio: z.string().length(8).optional(),
  cepFim: z.string().length(8).optional(),
  transportadoraId: z.number().int().positive().optional(),
  ativo: z.boolean().optional(),
})

export const GET = withAuthTyped<RouteParams>(async (req, { userId }, params) => {
  try {
    const regiaoId = parseRouteId(params!.id)

    const regiao = await verifyOwnership(
      prisma.transportadoraRegiao,
      regiaoId,
      userId,
      {
        include: {
          transportadora: true,
          precos: {
            orderBy: { pesoInicial: 'asc' },
          },
          _count: {
            select: {
              precos: true,
            },
          },
        },
      }
    )

    if (!regiao) {
      return NextResponse.json(
        { erro: 'Região não encontrada ou sem permissão' },
        { status: 404 }
      )
    }

    return NextResponse.json(regiao)
  } catch (error) {
    logger.error('Erro ao buscar região:', error)
    return NextResponse.json(
      { erro: 'Erro ao buscar região' },
      { status: 500 }
    )
  }
})

export const PUT = withAuthTyped<RouteParams>(async (req, { userId }, params) => {
  try {
    const regiaoId = parseRouteId(params!.id)

    const regiaoExistente = await verifyOwnership(
      prisma.transportadoraRegiao,
      regiaoId,
      userId,
      {}
    )

    if (!regiaoExistente) {
      return NextResponse.json(
        { erro: 'Região não encontrada ou sem permissão' },
        { status: 404 }
      )
    }

    const body = await req.json()
    const validation = regiaoSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { erro: 'Dados inválidos', detalhes: validation.error.errors },
        { status: 400 }
      )
    }

    // Se está alterando transportadora, verificar ownership
    if (validation.data.transportadoraId) {
      const transportadoraValida = await verifyTransportadoraOwnership(
        validation.data.transportadoraId,
        userId
      )

      if (!transportadoraValida) {
        return NextResponse.json(
          { erro: 'Transportadora não encontrada ou sem permissão' },
          { status: 404 }
        )
      }
    }

    const updated = await prisma.transportadoraRegiao.update({
      where: { id: regiaoId },
      data: validation.data,
      include: {
        transportadora: true,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    logger.error('Erro ao atualizar região:', error)
    return NextResponse.json(
      { erro: 'Erro ao atualizar região' },
      { status: 500 }
    )
  }
})

export const DELETE = withAuthTyped<RouteParams>(async (req, { userId }, params) => {
  try {
    const regiaoId = parseRouteId(params!.id)

    const regiao = await verifyOwnership(
      prisma.transportadoraRegiao,
      regiaoId,
      userId,
      {}
    )

    if (!regiao) {
      return NextResponse.json(
        { erro: 'Região não encontrada ou sem permissão' },
        { status: 404 }
      )
    }

    await prisma.transportadoraRegiao.delete({
      where: { id: regiaoId },
    })

    return NextResponse.json({ sucesso: true })
  } catch (error) {
    logger.error('Erro ao deletar região:', error)
    return NextResponse.json(
      { erro: 'Erro ao deletar região' },
      { status: 500 }
    )
  }
})
