import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import { withAuthTyped } from '@/lib/middleware/auth'
import { parseRouteId } from '@/lib/utils/parse'
import { verifyOwnership } from '@/lib/utils/ownership'
import { invalidateRegiaoCache } from '@/lib/cache'

interface RouteParams {
  id: string
  precoId: string
}
import { verificarSobreposicaoFaixa } from '@/lib/validators/faixa-peso.validator'

const precoSchema = z.object({
  pesoInicial: z.number().min(0).optional(),
  pesoFinal: z.number().min(0).optional(),
  valor: z.number().min(0).optional(),
  prazo: z.number().int().min(0).optional(),
})

export const PUT = withAuthTyped<RouteParams>(async (req, { userId }, params) => {
  try {
    const regiaoId = parseRouteId(params!.id)
    const precoId = parseRouteId(params!.precoId)
    const body = await req.json()

    const validation = precoSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { erro: 'Dados inválidos', detalhes: validation.error.errors },
        { status: 400 }
      )
    }

    // Verificar se preço pertence à região
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

    const preco = await prisma.transportadoraRegiaoPreco.findFirst({
      where: {
        id: precoId,
        transportadoraRegiaoId: regiaoId,
      },
    })

    if (!preco) {
      return NextResponse.json(
        { erro: 'Preço não encontrado' },
        { status: 404 }
      )
    }

    // Validar faixa de peso se ambos foram informados
    const pesoInicial = validation.data.pesoInicial ?? Number(preco.pesoInicial)
    const pesoFinal = validation.data.pesoFinal ?? Number(preco.pesoFinal)
    
    if (pesoFinal < pesoInicial) {
      return NextResponse.json(
        { erro: 'Peso final não pode ser menor que peso inicial' },
        { status: 400 }
      )
    }

    // Verificar sobreposição com outras faixas (excluindo a atual)
    const verificacao = await verificarSobreposicaoFaixa(
      regiaoId,
      pesoInicial,
      pesoFinal,
      precoId
    )

    if (verificacao.sobrepoe) {
      return NextResponse.json(
        { erro: verificacao.mensagem || 'Faixa de peso se sobrepõe com uma faixa existente' },
        { status: 400 }
      )
    }

    const precoAtualizado = await prisma.transportadoraRegiaoPreco.update({
      where: { id: precoId },
      data: validation.data,
    })

    invalidateRegiaoCache(userId)
    return NextResponse.json(precoAtualizado)
  } catch (error) {
    logger.error('Erro ao atualizar preço:', error)
    return NextResponse.json(
      { erro: 'Erro ao atualizar preço' },
      { status: 500 }
    )
  }
})

export const DELETE = withAuthTyped<RouteParams>(async (req, { userId }, params) => {
  try {
    const regiaoId = parseRouteId(params!.id)
    const precoId = parseRouteId(params!.precoId)

    const regiao = await verifyOwnership(
      prisma.transportadoraRegiao,
      regiaoId,
      userId
    )

    if (!regiao) {
      return NextResponse.json(
        { erro: 'Preço não encontrado ou sem permissão' },
        { status: 404 }
      )
    }

    // Verificar que o preço pertence à região do usuário (previne IDOR)
    const preco = await prisma.transportadoraRegiaoPreco.findFirst({
      where: {
        id: precoId,
        transportadoraRegiaoId: regiaoId,
      },
    })

    if (!preco) {
      return NextResponse.json(
        { erro: 'Preço não encontrado nesta região' },
        { status: 404 }
      )
    }

    await prisma.transportadoraRegiaoPreco.delete({
      where: { id: precoId },
    })

    invalidateRegiaoCache(userId)
    return NextResponse.json({ sucesso: true })
  } catch (error) {
    logger.error('Erro ao excluir preço:', error)
    return NextResponse.json(
      { erro: 'Erro ao excluir preço' },
      { status: 500 }
    )
  }
})
