import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import { withAuth } from '@/lib/middleware/auth'
import { sanitizeTransform } from '@/lib/utils/sanitize'
import { invalidateRegiaoCache } from '@/lib/cache'

const transportadoraSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório').transform(sanitizeTransform),
  fatorCubagem: z.number().min(0, 'Fator de cubagem deve ser positivo').optional().default(300),
  margemLucro: z.number().min(0, 'Margem de lucro não pode ser negativa').optional().default(0),
  ativo: z.boolean().optional().default(true),
})

export const GET = withAuth(async (req, { userId }) => {
  try {
    const transportadoras = await prisma.transportadora.findMany({
      where: {
        usuarioId: userId,
      },
      orderBy: { nome: 'asc' },
      include: {
        _count: {
          select: { regioes: true },
        },
      },
    })

    return NextResponse.json(transportadoras)
  } catch (error) {
    logger.error('Erro ao buscar transportadoras:', error)
    return NextResponse.json(
      { erro: 'Erro ao buscar transportadoras' },
      { status: 500 }
    )
  }
})

export const POST = withAuth(async (req, { userId }) => {
  try {
    const body = await req.json()
    const validation = transportadoraSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { erro: 'Dados inválidos', detalhes: validation.error.errors },
        { status: 400 }
      )
    }

    const transportadora = await prisma.transportadora.create({
      data: {
        ...validation.data,
        usuarioId: userId,
      }
    })

    invalidateRegiaoCache(userId).catch(() => {})
    return NextResponse.json(transportadora, { status: 201 })
  } catch (error) {
    logger.error('Erro ao criar transportadora:', error)
    return NextResponse.json(
      { erro: 'Erro ao criar transportadora' },
      { status: 500 }
    )
  }
})
