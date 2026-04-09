import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import { withAuth } from '@/lib/middleware/auth'
import { verifyTransportadoraOwnership } from '@/lib/validators/relationship.validator'
import { sanitizeTransform } from '@/lib/utils/sanitize'

// OTIMIZADO: Cache de 30 segundos
export const revalidate = 30

const regiaoSchema = z.object({
  transportadoraId: z.number().int().positive(),
  nome: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres').max(200).transform(sanitizeTransform),
  cepInicio: z.string().length(8, 'CEP deve ter 8 dígitos'),
  cepFim: z.string().length(8, 'CEP deve ter 8 dígitos'),
  ativo: z.boolean().optional().default(true),
})

export const GET = withAuth(async (req, { userId }) => {
  try {
    const regioes = await prisma.transportadoraRegiao.findMany({
      where: {
        usuarioId: userId
      },
      include: {
        transportadora: {
          select: {
            id: true,
            nome: true,
          },
        },
        _count: {
          select: {
            precos: true,
          },
        },
      },
    })

    return NextResponse.json(regioes)
  } catch (error) {
    logger.error('Erro ao buscar regiões:', error)
    return NextResponse.json(
      { erro: 'Erro ao buscar regiões' },
      { status: 500 }
    )
  }
})

export const POST = withAuth(async (req, { userId }) => {
  try {
    const body = await req.json()
    const validation = regiaoSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { erro: 'Dados inválidos', detalhes: validation.error.errors },
        { status: 400 }
      )
    }

    // Verificar se transportadora pertence ao usuário
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

    // Verificar sobreposição de faixa de CEP na mesma transportadora
    const sobreposicao = await prisma.transportadoraRegiao.findFirst({
      where: {
        transportadoraId: validation.data.transportadoraId,
        usuarioId: userId,
        cepInicio: { lte: validation.data.cepFim },
        cepFim: { gte: validation.data.cepInicio },
      },
    })

    if (sobreposicao) {
      return NextResponse.json(
        { erro: `Faixa de CEP sobreposta com a região "${sobreposicao.nome}" (${sobreposicao.cepInicio} - ${sobreposicao.cepFim}) da mesma transportadora` },
        { status: 409 }
      )
    }

    const regiao = await prisma.transportadoraRegiao.create({
      data: {
        ...validation.data,
        usuarioId: userId
      },
      include: {
        transportadora: true,
      },
    })

    return NextResponse.json(regiao, { status: 201 })
  } catch (error) {
    logger.error('Erro ao criar região:', error)
    return NextResponse.json(
      { erro: 'Erro ao criar região' },
      { status: 500 }
    )
  }
})
