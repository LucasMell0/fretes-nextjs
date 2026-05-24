import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import { withAuthTyped } from '@/lib/middleware/auth'
import { parseRouteId } from '@/lib/utils/parse'
import { verifyOwnership } from '@/lib/utils/ownership'
import type { TransportadoraRegiaoWithKgAdicional } from '@/lib/types/prisma-helpers'
import { invalidateRegiaoCache } from '@/lib/cache'

interface RouteParams {
  id: string
}

const kgAdicionalSchema = z.object({
  valorKgAdicional: z.number().min(0),
})

export const PUT = withAuthTyped<RouteParams>(async (req, { userId }, params) => {
  try {
    const regiaoId = parseRouteId(params!.id)
    const body = await req.json()

    const validation = kgAdicionalSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { erro: 'Dados inválidos', detalhes: validation.error.errors },
        { status: 400 }
      )
    }

    const regiao = await verifyOwnership<TransportadoraRegiaoWithKgAdicional>(
      prisma.transportadoraRegiao,
      regiaoId,
      userId,
      {
        kgAdicional: true,
      }
    )

    if (!regiao) {
      return NextResponse.json(
        { erro: 'Região não encontrada ou sem permissão' },
        { status: 404 }
      )
    }

    let kgAdicional

    if (regiao.kgAdicional) {
      // Atualizar existente
      kgAdicional = await prisma.transportadoraRegiaoKgAdicional.update({
        where: { id: regiao.kgAdicional.id },
        data: validation.data,
      })
    } else {
      // Criar novo
      kgAdicional = await prisma.transportadoraRegiaoKgAdicional.create({
        data: {
          transportadoraRegiaoId: regiaoId,
          ...validation.data,
        },
      })
    }

    invalidateRegiaoCache(userId).catch(() => {})
    return NextResponse.json(kgAdicional)
  } catch (error) {
    logger.error('Erro ao salvar KG adicional:', error)
    return NextResponse.json(
      { erro: 'Erro ao salvar KG adicional' },
      { status: 500 }
    )
  }
})
