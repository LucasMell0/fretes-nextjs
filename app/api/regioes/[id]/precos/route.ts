import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import { withAuthTyped } from '@/lib/middleware/auth'
import { parseRouteId } from '@/lib/utils/parse'
import { verifyOwnership } from '@/lib/utils/ownership'
import { verificarSobreposicaoFaixa } from '@/lib/validators/faixa-peso.validator'
import type { TransportadoraRegiaoWithRelations } from '@/lib/types/prisma-helpers'

interface RouteParams {
  id: string
}

const precoSchema = z.object({
  pesoInicial: z.number().min(0),
  pesoFinal: z.number().min(0),
  valor: z.number().min(0),
  prazo: z.number().int().min(0),
})

export const GET = withAuthTyped<RouteParams>(async (req, { userId }, params) => {
  try {
    const regiaoId = parseRouteId(params!.id)

    const regiao = await verifyOwnership<TransportadoraRegiaoWithRelations>(
      prisma.transportadoraRegiao,
      regiaoId,
      userId,
      {
        transportadora: true,
        precos: {
          orderBy: { pesoInicial: 'asc' },
        },
        kgAdicional: true,
      }
    )

    if (!regiao) {
      return NextResponse.json(
        { erro: 'Região não encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      regiao,
      precos: regiao.precos,
      kgAdicional: regiao.kgAdicional,
    })
  } catch (error) {
    logger.error('Erro ao buscar preços:', error)
    return NextResponse.json(
      { erro: 'Erro ao buscar preços' },
      { status: 500 }
    )
  }
})

export const POST = withAuthTyped<RouteParams>(async (req, { userId }, params) => {
  try {
    const regiaoId = parseRouteId(params!.id)
    const body = await req.json()

    const validation = precoSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { erro: 'Dados inválidos', detalhes: validation.error.errors },
        { status: 400 }
      )
    }

    const regiao = await verifyOwnership(
      prisma.transportadoraRegiao,
      regiaoId,
      userId
    )

    if (!regiao) {
      return NextResponse.json(
        { erro: 'Região não encontrada ou sem permissão' },
        { status: 404 }
      )
    }

    // Validar faixa de peso (permite faixa de ponto único, ex: 31-31)
    if (validation.data.pesoFinal < validation.data.pesoInicial) {
      return NextResponse.json(
        { erro: 'Peso final não pode ser menor que peso inicial' },
        { status: 400 }
      )
    }

    // Verificar sobreposição com faixas existentes
    const verificacao = await verificarSobreposicaoFaixa(
      regiaoId,
      validation.data.pesoInicial,
      validation.data.pesoFinal
    )

    if (verificacao.sobrepoe) {
      return NextResponse.json(
        { erro: verificacao.mensagem || 'Faixa de peso se sobrepõe com uma faixa existente' },
        { status: 400 }
      )
    }

    // Criar faixa de preço
    const preco = await prisma.transportadoraRegiaoPreco.create({
      data: {
        transportadoraRegiaoId: regiaoId,
        ...validation.data,
      },
    })

    return NextResponse.json(preco, { status: 201 })
  } catch (error) {
    logger.error('Erro ao criar preço:', error)
    return NextResponse.json(
      { erro: 'Erro ao criar preço' },
      { status: 500 }
    )
  }
})
